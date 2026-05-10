import { Injectable } from '@nestjs/common';
import { sha256Hex } from '@kincare/shared';
import { AuditAction, type UserRole } from '@kincare/db';
import { PrismaService } from '../../common/prisma/prisma.module';

export interface RecordAuditInput {
  action: AuditAction | keyof typeof AuditAction;
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  actorUserId?: string;
  actorRole?: UserRole | string;
  outcome?: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append a tamper-evident audit record. Each record's `hash` is
   * sha256(prevHash || canonicalJSON(payload)), forming an append-only chain.
   */
  async record(input: RecordAuditInput): Promise<void> {
    const last = await this.prisma.auditLog.findFirst({
      orderBy: { occurredAt: 'desc' },
      select: { hash: true },
    });
    const occurredAt = new Date();
    const payload = {
      occurredAt: occurredAt.toISOString(),
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      patientId: input.patientId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      outcome: input.outcome ?? 'success',
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      requestId: input.requestId ?? null,
      metadata: input.metadata ?? null,
    };
    const canonical = JSON.stringify(payload);
    const hash = sha256Hex((last?.hash ?? '') + canonical);

    await this.prisma.auditLog.create({
      data: {
        occurredAt,
        action: input.action as AuditAction,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        patientId: input.patientId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole as UserRole | undefined,
        outcome: input.outcome ?? 'success',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: input.metadata as never,
        prevHash: last?.hash,
        hash,
      },
    });
  }

  list(params: { patientId?: string; actorUserId?: string; take?: number; cursor?: string }) {
    const take = Math.min(params.take ?? 50, 200);
    return this.prisma.auditLog.findMany({
      where: {
        patientId: params.patientId,
        actorUserId: params.actorUserId,
      },
      orderBy: { occurredAt: 'desc' },
      take,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
  }

  /** Verify the integrity of the chain — useful for compliance audits. */
  async verifyChain(limit = 1000): Promise<{ valid: boolean; brokenAt?: string }> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { occurredAt: 'asc' },
      take: limit,
    });
    let prev: string | null = null;
    for (const r of rows) {
      const payload = JSON.stringify({
        occurredAt: r.occurredAt.toISOString(),
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        patientId: r.patientId,
        actorUserId: r.actorUserId,
        actorRole: r.actorRole,
        outcome: r.outcome,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        requestId: r.requestId,
        metadata: r.metadata ?? null,
      });
      const expected = sha256Hex((prev ?? '') + payload);
      if (expected !== r.hash) return { valid: false, brokenAt: r.id };
      prev = r.hash;
    }
    return { valid: true };
  }
}
