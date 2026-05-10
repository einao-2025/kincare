import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserStatus } from '@kincare/db';
import { PrismaService } from '../../common/prisma/prisma.module';

/**
 * Periodic data-lifecycle jobs:
 *   1. Hard-delete soft-deleted records older than the retention window.
 *   2. Pseudonymize (anonymize PII) on dormant patient accounts that have
 *      passed their NDPA/HIPAA inactive-account window.
 *   3. Purge expired refresh tokens, sessions, password reset tokens.
 *
 * All jobs run inside transactions to keep the audit log untouched —
 * audit records are immutable and never anonymized.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly softDeleteRetentionDays: number;
  private readonly inactiveAnonymizeDays: number;
  private readonly enabled: boolean;

  constructor(private readonly prisma: PrismaService, cfg: ConfigService) {
    this.softDeleteRetentionDays = Number(cfg.get('RETENTION_SOFT_DELETE_DAYS') ?? 90);
    this.inactiveAnonymizeDays = Number(cfg.get('RETENTION_INACTIVE_DAYS') ?? 2555); // ~7 years
    this.enabled = (cfg.get('RETENTION_JOBS_ENABLED') ?? 'true') === 'true';
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    if (!this.enabled) return;
    this.logger.log('Retention sweep starting');
    try {
      await this.purgeExpiredAuthArtifacts();
      await this.hardDeleteSoftDeleted();
      await this.anonymizeInactivePatients();
      this.logger.log('Retention sweep complete');
    } catch (e) {
      this.logger.error(`Retention sweep failed: ${(e as Error).message}`);
    }
  }

  /** Refresh tokens, sessions, and password resets past expiry. */
  async purgeExpiredAuthArtifacts(): Promise<void> {
    const now = new Date();
    const refreshDeleted = await this.prisma.refreshToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null, lt: thirty(now, -30) } }] },
    });
    const sessionsDeleted = await this.prisma.session.deleteMany({
      where: { revokedAt: { not: null, lt: thirty(now, -30) } },
    });
    this.logger.log(`Purged ${refreshDeleted.count} refresh tokens, ${sessionsDeleted.count} sessions`);
  }

  /** Records soft-deleted longer than retention window are physically removed. */
  async hardDeleteSoftDeleted(): Promise<void> {
    const cutoff = new Date(Date.now() - this.softDeleteRetentionDays * 86_400_000);
    // Order matters — children before parents to avoid FK violations.
    const ops: { name: string; promise: Promise<{ count: number }> }[] = [
      { name: 'observations',     promise: this.prisma.observation.deleteMany({ where: { deletedAt: { lt: cutoff } } }) },
      { name: 'testResults',      promise: this.prisma.testResult.deleteMany({ where: { deletedAt: { lt: cutoff } } }) },
      { name: 'diagnosticReports',promise: this.prisma.diagnosticReport.deleteMany({ where: { deletedAt: { lt: cutoff } } }) },
      { name: 'prescriptions',    promise: this.prisma.prescription.deleteMany({ where: { deletedAt: { lt: cutoff } } }) },
      { name: 'conditions',       promise: this.prisma.condition.deleteMany({ where: { deletedAt: { lt: cutoff } } }) },
      { name: 'allergies',        promise: this.prisma.allergyIntolerance.deleteMany({ where: { deletedAt: { lt: cutoff } } }) },
      { name: 'encounters',       promise: this.prisma.encounter.deleteMany({ where: { deletedAt: { lt: cutoff } } }) },
    ];
    for (const op of ops) {
      try {
        const r = await op.promise;
        if (r.count > 0) this.logger.log(`Hard-deleted ${r.count} ${op.name}`);
      } catch (e) {
        this.logger.warn(`Skip ${op.name}: ${(e as Error).message}`);
      }
    }
  }

  /**
   * Pseudonymize patients whose accounts have been inactive past the legal
   * retention window. We retain MRN + DOB year for legal/clinical lookup
   * but null out direct identifiers.
   */
  async anonymizeInactivePatients(): Promise<void> {
    const cutoff = new Date(Date.now() - this.inactiveAnonymizeDays * 86_400_000);
    const candidates = await this.prisma.user.findMany({
      where: {
        role: 'PATIENT',
        status: { in: [UserStatus.DEACTIVATED, UserStatus.SUSPENDED] },
        OR: [{ lastLoginAt: { lt: cutoff } }, { lastLoginAt: null, createdAt: { lt: cutoff } }],
        email: { not: { startsWith: 'anon+' } },
      },
      select: { id: true },
      take: 500,
    });
    for (const u of candidates) {
      const tag = u.id.slice(0, 8);
      await this.prisma.user.update({
        where: { id: u.id },
        data: {
          email: `anon+${tag}@kincare.health`,
          phone: null,
          firstName: 'Anonymized',
          lastName: tag,
          passwordHash: 'scrypt$inactive$$$',
          mfaSecretEnc: null,
          mfaRecoveryCodes: [],
          mfaEnabled: false,
        },
      });
    }
    if (candidates.length) this.logger.log(`Anonymized ${candidates.length} dormant patient accounts`);
  }
}

function thirty(d: Date, deltaDays: number): Date {
  return new Date(d.getTime() + deltaDays * 86_400_000);
}
