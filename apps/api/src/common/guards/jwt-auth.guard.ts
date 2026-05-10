import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { verifyAccessToken } from '@kincare/auth';
import { permissionsForRole, type AuthPrincipal } from '@kincare/shared';
import { MFA_REQUIRED_KEY, PUBLIC_KEY } from '../decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cfg: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');

    const token = auth.slice('Bearer '.length);
    try {
      const claims = verifyAccessToken(token, {
        accessSecret: this.cfg.getOrThrow('JWT_ACCESS_SECRET'),
        refreshSecret: this.cfg.getOrThrow('JWT_REFRESH_SECRET'),
        accessTtlSeconds: this.cfg.getOrThrow<number>('JWT_ACCESS_TTL'),
        refreshTtlSeconds: this.cfg.getOrThrow<number>('JWT_REFRESH_TTL'),
        issuer: this.cfg.get('MFA_ISSUER'),
      });
      const principal: AuthPrincipal = {
        userId: claims.sub,
        role: claims.role,
        email: claims.email,
        sessionId: claims.sid,
        mfaVerified: claims.mfa,
        permissions: permissionsForRole(claims.role),
      };
      req.user = principal;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const mfaRequired = this.reflector.getAllAndOverride<boolean>(MFA_REQUIRED_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (mfaRequired && !req.user.mfaVerified) {
      throw new UnauthorizedException('MFA verification required');
    }
    return true;
  }
}
