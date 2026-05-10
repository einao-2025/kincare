import { sha256Hex } from '@kincare/shared';
import { AuditService } from '../modules/audit/audit.service';

/** Minimal in-memory Prisma stub for the AuditService chain test. */
function makePrismaStub() {
  const rows: any[] = [];
  return {
    rows,
    auditLog: {
      findFirst: async () => rows.length ? { hash: rows[rows.length - 1].hash } : null,
      findMany: async () => rows,
      create: async ({ data }: any) => { rows.push({ ...data }); return data; },
    },
  };
}

describe('AuditService hash chain', () => {
  it('produces a verifiable chain across multiple records', async () => {
    const stub = makePrismaStub();
    const service = new AuditService(stub as any);

    for (let i = 0; i < 5; i++) {
      await service.record({
        action: 'READ', resourceType: 'Patient', resourceId: `p${i}`,
        actorUserId: 'u1', actorRole: 'DOCTOR',
      });
    }

    expect(stub.rows).toHaveLength(5);
    const result = await service.verifyChain();
    expect(result.valid).toBe(true);

    // Tamper with the third record.
    stub.rows[2].metadata = { tampered: true };
    const tampered = await service.verifyChain();
    expect(tampered.valid).toBe(false);
    expect(tampered.brokenAt).toBe(stub.rows[2].id ?? undefined);
  });

  it('first record has null prev hash', async () => {
    const stub = makePrismaStub();
    const service = new AuditService(stub as any);
    await service.record({ action: 'LOGIN', resourceType: 'Session' });
    expect(stub.rows[0].prevHash).toBeUndefined();
    expect(stub.rows[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
