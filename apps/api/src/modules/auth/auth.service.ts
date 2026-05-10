import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  signAccessToken, signRefreshToken, verifyRefreshToken, type TokenConfig,
} from '@kincare/auth';
import {
  encryptField, generateMRN, generateToken, hashPassword, sha256Hex, verifyPassword,
} from '@kincare/shared';
import { Roles, type Role } from '@kincare/shared';
import { UserRole, UserStatus } from '@kincare/db';
import { PrismaService } from '../../common/prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { MfaService } from './mfa.service';
import type { LoginDto, RegisterDto } from './dto';

const MAX_FAILED = 8;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
  ) {}

  private get tokenCfg(): TokenConfig {
    return {
      accessSecret: this.cfg.getOrThrow('JWT_ACCESS_SECRET'),
      refreshSecret: this.cfg.getOrThrow('JWT_REFRESH_SECRET'),
      accessTtlSeconds: this.cfg.getOrThrow<number>('JWT_ACCESS_TTL'),
      refreshTtlSeconds: this.cfg.getOrThrow<number>('JWT_REFRESH_TTL'),
      issuer: this.cfg.get('MFA_ISSUER'),
    };
  }

  async register(dto: RegisterDto, ctx: { ip?: string; ua?: string }) {
    const role: Role = dto.role ?? Roles.PATIENT;
    if (role !== Roles.PATIENT) {
      throw new UnauthorizedException('Self-registration only allowed for patients');
    }
    const tenantId = (ctx as any).tenantId ?? process.env.DEFAULT_TENANT_ID ?? 'default';
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email.toLowerCase() } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = hashPassword(dto.password, this.cfg.get('PASSWORD_PEPPER') ?? '');
    const seq = (await this.prisma.patientProfile.count()) + 1;

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        role: UserRole.PATIENT,
        status: UserStatus.PENDING_VERIFICATION,
        patientProfile: {
          create: {
            tenantId,
            mrn: generateMRN(seq),
            dateOfBirth: new Date('1970-01-01'), // placeholder; user updates in profile flow
          },
        },
      },
    });

    await this.audit.record({
      action: 'CREATE', resourceType: 'User', resourceId: user.id,
      actorUserId: user.id, actorRole: user.role,
      ipAddress: ctx.ip, userAgent: ctx.ua,
    });

    return { id: user.id, email: user.email, role: user.role, status: user.status };
  }

  async login(dto: LoginDto, ctx: { ip?: string; ua?: string }) {
    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: (ctx as any).tenantId ?? process.env.DEFAULT_TENANT_ID ?? 'default',
          email: dto.email.toLowerCase(),
        },
      },
    });
    if (!user || user.deletedAt) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }
    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException('Account is not active');
    }

    const ok = verifyPassword(dto.password, user.passwordHash, this.cfg.get('PASSWORD_PEPPER') ?? '');
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: failed, lockedUntil: lock },
      });
      await this.audit.record({
        action: 'LOGIN_FAILED', resourceType: 'User', resourceId: user.id,
        actorUserId: user.id, actorRole: user.role, outcome: 'failure',
        ipAddress: ctx.ip, userAgent: ctx.ua,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    let mfaVerified = !user.mfaEnabled;
    if (user.mfaEnabled) {
      if (!dto.mfaCode) throw new UnauthorizedException('MFA code required');
      mfaVerified = await this.mfa.verify(user.id, dto.mfaCode);
      if (!mfaVerified) throw new UnauthorizedException('Invalid MFA code');
    }

    // Reset lockout, create session + tokens.
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceLabel: dto.deviceLabel,
        userAgent: ctx.ua,
        ipAddress: ctx.ip,
      },
    });

    const tokens = await this.issueTokens({
      userId: user.id, role: user.role, email: user.email,
      sessionId: session.id, mfaVerified, tenantId: user.tenantId,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await this.audit.record({
      action: 'LOGIN', resourceType: 'Session', resourceId: session.id,
      actorUserId: user.id, actorRole: user.role,
      ipAddress: ctx.ip, userAgent: ctx.ua,
    });

    return {
      ...tokens,
      user: {
        id: user.id, email: user.email, role: user.role,
        firstName: user.firstName, lastName: user.lastName,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  async refresh(refreshToken: string, ctx: { ip?: string; ua?: string }) {
    const claims = (() => {
      try { return verifyRefreshToken(refreshToken, this.tokenCfg); }
      catch { throw new UnauthorizedException('Invalid refresh token'); }
    })();

    const tokenHash = sha256Hex(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true, session: true },
    });
    if (!stored || stored.revokedAt || stored.rotatedAt) {
      // Possible token replay → revoke entire session as a safety measure.
      if (stored?.sessionId) {
        await this.prisma.refreshToken.updateMany({
          where: { sessionId: stored.sessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.prisma.session.update({
          where: { id: stored.sessionId },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Refresh token is invalid');
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');
    if (stored.userId !== claims.sub) throw new UnauthorizedException('Token mismatch');

    // Rotate
    const rotated = await this.issueTokens({
      userId: stored.user.id,
      role: stored.user.role,
      email: stored.user.email,
      sessionId: stored.sessionId,
      mfaVerified: stored.user.mfaEnabled ? true : true, // refresh assumes prior MFA in session
      tenantId: stored.user.tenantId,
    });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { rotatedAt: new Date(), replacedById: rotated.refreshTokenId },
    });
    await this.prisma.session.update({
      where: { id: stored.sessionId },
      data: { lastSeenAt: new Date(), ipAddress: ctx.ip, userAgent: ctx.ua },
    });

    return rotated;
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      action: 'LOGOUT', resourceType: 'Session', resourceId: sessionId,
      actorUserId: userId,
    });
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true, deviceLabel: true, userAgent: true, ipAddress: true,
        createdAt: true, lastSeenAt: true,
      },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const sess = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!sess) throw new UnauthorizedException('Session not found');
    return this.logout(userId, sessionId);
  }

  // ── Internal helpers ────────────────────────────────────────

  private async issueTokens(input: {
    userId: string; role: Role; email: string; sessionId: string; mfaVerified: boolean; tenantId?: string;
  }) {
    const cfg = this.tokenCfg;
    const refreshId = crypto.randomUUID();
    const accessToken = signAccessToken({
      sub: input.userId, role: input.role, email: input.email,
      sid: input.sessionId, mfa: input.mfaVerified,
      tid: input.tenantId ?? process.env.DEFAULT_TENANT_ID ?? 'default',
    }, cfg);
    const refreshToken = signRefreshToken({
      sub: input.userId, sid: input.sessionId, jti: refreshId,
    }, cfg);
    const stored = await this.prisma.refreshToken.create({
      data: {
        id: refreshId,
        userId: input.userId,
        sessionId: input.sessionId,
        tokenHash: sha256Hex(refreshToken),
        expiresAt: new Date(Date.now() + cfg.refreshTtlSeconds * 1000),
      },
    });
    return {
      accessToken, refreshToken,
      accessTokenExpiresIn: cfg.accessTtlSeconds,
      refreshTokenId: stored.id,
    };
  }
}
