'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, Button, Card, Spinner, Table } from '@/components/ui';

interface RefillRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'DISPENSED' | 'PICKED_UP';
  createdAt: string;
  pickupCode?: string | null;
  pickupCodeExpiresAt?: string | null;
}

interface Prescription {
  id: string; medicationName: string; medicationCode: string; dosage: string; route?: string;
  frequency: string; quantity: number; refillsAllowed: number; refillsUsed: number;
  status: string; prescribedAt: string;
  refillRequests?: RefillRequest[];
}

export default function PrescriptionsPage() {
  const qc = useQueryClient();

  const list = useQuery<Prescription[]>({
    queryKey: ['prescriptions', 'me'],
    queryFn: () => api('/prescriptions/patient/me'),
  });

  const refill = useMutation({
    mutationFn: (prescriptionId: string) =>
      api<RefillRequest>('/prescriptions/refills', {
        method: 'POST',
        json: { prescriptionId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prescriptions', 'me'] }),
  });

  // Surface any approved refill that has an active pickup code.
  const activePickup = (list.data ?? [])
    .flatMap((rx) =>
      (rx.refillRequests ?? [])
        .filter((r) => r.pickupCode && r.status === 'APPROVED')
        .map((r) => ({ rx, r })),
    )
    .sort((a, b) => +new Date(b.r.createdAt) - +new Date(a.r.createdAt))[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Prescriptions</h1>

      {activePickup && (
        <Card title="Pharmacy pickup code" className="border-accent-200 bg-accent-50/60">
          <p className="text-sm text-clinical-text">
            Show this code at the pharmacy for{' '}
            <span className="font-medium">{activePickup.rx.medicationName}</span>.
            {activePickup.r.pickupCodeExpiresAt && (
              <> Expires {new Date(activePickup.r.pickupCodeExpiresAt).toLocaleString()}.</>
            )}
          </p>
          <div className="mt-2 font-mono text-3xl tracking-widest text-accent-700">
            {activePickup.r.pickupCode}
          </div>
        </Card>
      )}

      {refill.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(refill.error as Error).message}
        </div>
      )}
      {refill.isSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Refill requested. Your care team will review it shortly.
        </div>
      )}

      <Card title="Active & recent prescriptions">
        {list.isLoading ? <Spinner /> : (
          <Table rows={list.data ?? []} emptyText="No prescriptions on file"
            columns={[
              { header: 'Medication', cell: (r) => (
                <div>
                  <div className="font-medium">{r.medicationName}</div>
                  <div className="text-xs text-clinical-muted">{r.dosage} • {r.frequency}{r.route ? ` • ${r.route}` : ''}</div>
                </div>
              )},
              { header: 'Refills', cell: (r) => `${Math.max(0, r.refillsAllowed - r.refillsUsed)}/${r.refillsAllowed}` },
              { header: 'Status', cell: (r) => (
                <Badge tone={r.status === 'ACTIVE' ? 'success' : r.status === 'COMPLETED' ? 'neutral' : 'warn'}>{r.status}</Badge>
              )},
              { header: 'Latest refill', cell: (r) => {
                const latest = r.refillRequests?.[0];
                if (!latest) return <span className="text-clinical-muted text-xs">—</span>;
                const tone =
                  latest.status === 'APPROVED' || latest.status === 'PICKED_UP' ? 'success'
                  : latest.status === 'DENIED' ? 'danger'
                  : latest.status === 'DISPENSED' ? 'info'
                  : 'warn';
                return <Badge tone={tone}>{latest.status}</Badge>;
              }},
              { header: 'Prescribed', cell: (r) => new Date(r.prescribedAt).toLocaleDateString() },
              { header: '', cell: (r) => {
                const remaining = r.refillsAllowed - r.refillsUsed;
                const pendingExists = r.refillRequests?.some((x) => x.status === 'PENDING');
                return (
                  <Button
                    size="sm"
                    disabled={remaining <= 0 || r.status !== 'ACTIVE' || pendingExists || refill.isPending}
                    onClick={() => refill.mutate(r.id)}
                  >
                    {pendingExists ? 'Pending review' : 'Request refill'}
                  </Button>
                );
              }},
            ]}
          />
        )}
      </Card>
    </div>
  );
}
