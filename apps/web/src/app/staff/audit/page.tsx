'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, Button, Card, Spinner, Table } from '@/components/ui';

interface AuditRow {
  id: string; action: string; resourceType: string; resourceId?: string;
  ipAddress?: string; createdAt: string;
  actor?: { email: string; firstName: string; lastName: string; role: string };
}

export default function AuditMonitorPage() {
  const list = useQuery<AuditRow[]>({
    queryKey: ['audit', 'recent'],
    queryFn: () => api('/audit?take=100'),
    refetchInterval: 15_000,
  });
  const verify = useMutation({
    mutationFn: () => api<{ ok: boolean; verifiedCount: number; brokenAt?: string }>('/audit/verify'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit monitor</h1>
        <Button onClick={() => verify.mutate()} disabled={verify.isPending}>
          {verify.isPending ? 'Verifying…' : 'Verify hash chain'}
        </Button>
      </div>
      {verify.data && (
        <Card className={verify.data.ok ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}>
          {verify.data.ok
            ? <p className="text-sm text-emerald-800">✓ Hash chain intact across {verify.data.verifiedCount} entries.</p>
            : <p className="text-sm text-red-800">⚠ Tamper detected at entry {verify.data.brokenAt}</p>}
        </Card>
      )}
      <Card title="Recent activity (auto-refresh 15s)">
        {list.isLoading ? <Spinner /> : (
          <Table rows={list.data ?? []} emptyText="No audit events recorded"
            columns={[
              { header: 'Time', cell: (r) => new Date(r.createdAt).toLocaleString() },
              { header: 'Actor', cell: (r) => r.actor ? (
                <div>
                  <div>{r.actor.firstName} {r.actor.lastName}</div>
                  <div className="text-xs text-clinical-muted">{r.actor.role}</div>
                </div>
              ) : <span className="text-clinical-muted">system</span> },
              { header: 'Action', cell: (r) => <Badge tone="info">{r.action}</Badge> },
              { header: 'Resource', cell: (r) => `${r.resourceType}${r.resourceId ? ` / ${r.resourceId.slice(0,8)}…` : ''}` },
              { header: 'IP', cell: (r) => <code className="text-xs">{r.ipAddress ?? '—'}</code> },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
