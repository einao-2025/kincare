import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateOtpauthURL, generateRecoveryCodes, generateTotpSecret, verifyTotp,
} from '@kincare/auth';
import { decryptField, encryptField, hashPassword, verifyPassword } from '@kincare/shared';
import { PrismaService } from '../../common/prisma/prisma.module';

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  private get phiKey(): string { return this.cfg.getOrThrow('PHI_ENCRYPTION_KEY'); }

  /** Generate a new TOTP secret + recovery codes; returns provisioning URI for QR. */
  async setupBegin(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = generateTotpSecret();
    const otpauth = generateOtpauthURL({
      issuer: this.cfg.get('MFA_ISSUER') ?? 'Kincare',
      account: user.email, secret,
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: encryptField(secret, this.phiKey), mfaEnabled: false },
    });
    return { secret, otpauth };
  }

  /** Confirm MFA setup with first valid code; issues recovery codes (one-time view). */
  async setupConfirm(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecretEnc) throw new BadRequestException('MFA setup not started');
    const secret = decryptField(user.mfaSecretEnc, this.phiKey);
    if (!verifyTotp(code, secret)) throw new BadRequestException('Invalid code');
    const recovery = generateRecoveryCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaRecoveryCodes: recovery.map((c) => hashPassword(c, this.cfg.get('PASSWORD_PEPPER') ?? '')),
      },
    });
    return { recoveryCodes: recovery };
  }

  async disable(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEnc: null, mfaRecoveryCodes: [] },
    });
  }

  async verify(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecretEnc) return false;
    const secret = decryptField(user.mfaSecretEnc, this.phiKey);
    if (verifyTotp(code, secret)) return true;
    // Try recovery code
    const pepper = this.cfg.get('PASSWORD_PEPPER') ?? '';
    const idx = user.mfaRecoveryCodes.findIndex((h) => verifyPassword(code, h, pepper));
    if (idx >= 0) {
      const remaining = [...user.mfaRecoveryCodes];
      remaining.splice(idx, 1);
      await this.prisma.user.update({ where: { id: userId }, data: { mfaRecoveryCodes: remaining } });
      return true;
    }
    return false;
  }
}
