import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserRole } from '@kincare/db';
import { PrismaService } from '../../common/prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

interface AlertContext {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  subject: string;
  body: string;
}

/**
 * Continuous monitoring of the immutable audit log for security-relevant
 * patterns. Findings are emitted as IN_APP notifications to all
 * HOSPITAL_ADMIN + SUPER_ADMIN users and structured-logged at WARN.
 *
 * Detection windows are intentionally short and deduped via Redis-style
 * lookback (we only fire when the latest matching event is newer than the
 * last alert we sent for the same key).
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly lastFireAt = new Map<string, number>();

  private readonly failedLoginThreshold: number;
  private readonly failedLoginWindowMin: number;
  private readonly bulkExportThreshold: number;
  private readonly offHoursStart: number; // local hour, inclusive
  private readonly offHoursEnd: number;   // local hour, exclusive

  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificationsService,
    cfg: ConfigService,
  ) {
    this.failedLoginThreshold = Number(cfg.get('ALERT_FAILED_LOGIN_THRESHOLD') ?? 10);
    this.failedLoginWindowMin = Number(cfg.get('ALERT_FAILED_LOGIN_WINDOW_MIN') ?? 5);
    this.bulkExportThreshold = Number(cfg.get('ALERT_BULK_EXPORT_THRESHOLD') ?? 50);
    this.offHoursStart = Number(cfg.get('ALERT_OFF_HOURS_START') ?? 22);
    this.offHoursEnd = Number(cfg.get('ALERT_OFF_HOURS_END') ?? 6);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scanFailedLoginBursts(): Promise<void> {
    const since = new Date(Date.now() - this.failedLoginWindowMin * 60_000);
    const grouped = await this.prisma.auditLog.groupBy({
      by: ['ipAddress'],
      where: { action: 'LOGIN_FAILED', occurredAt: { gte: since } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if ((row._count._all ?? 0) < this.failedLoginThreshold) continue;
      await this.fire(`failed-login:${row.ipAddress}`, {
        type: 'failed_login_burst',
        severity: 'high',
        subject: `Brute-force suspected from ${row.ipAddress ?? 'unknown IP'}`,
        body:
          `${row._count._all} failed logins from ${row.ipAddress ?? 'unknown IP'} ` +
          `in the last ${this.failedLoginWindowMin} minutes.`,
      });
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scanOffHoursAccess(): Promise<void> {
    const hour = new Date().getHours();
    const isOffHours = this.offHoursStart > this.offHoursEnd
      ? (hour >= this.offHoursStart || hour < this.offHoursEnd)
      : (hour >= this.offHoursStart && hour < this.offHoursEnd);
    if (!isOffHours) return;

    const since = new Date(Date.now() - 5 * 60_000);
    const grouped = await this.prisma.auditLog.groupBy({
      by: ['actorUserId', 'actorRole'],
      where: {
        occurredAt: { gte: since },
        action: { in: ['READ', 'EXPORT', 'DOWNLOAD'] },
        actorRole: { in: [UserRole.DOCTOR, UserRole.NURSE, UserRole.PHARMACIST] },
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if ((row._count._all ?? 0) < 5) continue;
      await this.fire(`offhours:${row.actorUserId}:${hour}`, {
        type: 'off_hours_access',
        severity: 'medium',
        subject: `Off-hours PHI access by ${row.actorRole}`,
        body:
          `User ${row.actorUserId} (${row.actorRole}) performed ${row._count._all} PHI reads ` +
          `at hour ${hour}. Verify the access is part of an authorized on-call workflow.`,
      });
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scanBulkExports(): Promise<void> {
    const since = new Date(Date.now() - 10 * 60_000);
    const grouped = await this.prisma.auditLog.groupBy({
      by: ['actorUserId'],
      where: { occurredAt: { gte: since }, action: { in: ['EXPORT', 'READ'] } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if ((row._count._all ?? 0) < this.bulkExportThreshold) continue;
      await this.fire(`bulkexport:${row.actorUserId}`, {
        type: 'bulk_export',
        severity: 'critical',
        subject: 'Bulk PHI access detected',
        body:
          `User ${row.actorUserId} accessed/exported ${row._count._all} PHI resources ` +
          `in the last 10 minutes. Review immediately for data exfiltration.`,
      });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async verifyAuditChain(): Promise<void> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { occurredAt: 'desc' },
      take: 500,
    });
    if (rows.length < 2) return;
    // Sample-check that the most recent record's prevHash matches the next.
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i]!;
      const b = rows[i + 1]!;
      if (a.prevHash && a.prevHash !== b.hash) {
        await this.fire(`audit-chain-break:${a.id}`, {
          type: 'audit_chain_tamper',
          severity: 'critical',
          subject: 'Audit log tampering suspected',
          body: `Hash chain mismatch detected at log entry ${a.id}.`,
        });
        return;
      }
    }
  }

  private async fire(key: string, alert: AlertContext): Promise<void> {
    const now = Date.now();
    const last = this.lastFireAt.get(key) ?? 0;
    if (now - last < 30 * 60_000) return; // dedupe 30 min
    this.lastFireAt.set(key, now);

    this.logger.warn(`[ALERT:${alert.severity}] ${alert.type} — ${alert.subject}`);

    const admins = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.HOSPITAL_ADMIN, UserRole.SUPER_ADMIN] }, deletedAt: null },
      select: { id: true },
    });
    await Promise.all(admins.map((u) =>
      this.notif.enqueue({
        userId: u.id,
        channel: 'IN_APP',
        subject: `[${alert.severity.toUpperCase()}] ${alert.subject}`,
        body: alert.body,
        metadata: { alertType: alert.type, severity: alert.severity },
      }),
    ));
  }
}
