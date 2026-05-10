'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, Button, Card, Input, Spinner, Table } from '@/components/ui';
import { useState } from 'react';

interface RefillReq {
  id: string;
  createdAt: string;
  notes?: string;
  prescription: {
    id: string;
    medicationName: string;
    dosage: string;
    frequency: string;
    refillsAllowed: number;
    refillsUsed: number;
  };
  patient: {
    id: string;
    mrn: string;
    user: { firstName: string; lastName: string };
  };
}

export default function RefillQueuePage() {
  const qc = useQueryClient();
  const [denyId, setDenyId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('');

  const list = useQuery<RefillReq[]>({
    queryKey: ['refills', 'pending'],
    queryFn: () => api('/prescriptions/refills/pending'),
  });
  const approve = useMutation({
    mutationFn: (refillRequestId: string) =>
      api('/prescriptions/refills/approve', { method: 'POST', json: { refillRequestId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['refills', 'pending'] }),
  });
  const deny = useMutation({
    mutationFn: ({ refillRequestId, reason }: { refillRequestId: string; reason: string }) =>
      api('/prescriptions/refills/deny', { method: 'POST', json: { refillRequestId, reason } }),
    onSuccess: () => {
      setDenyId(null); setDenyReason('');
      qc.invalidateQueries({ queryKey: ['refills', 'pending'] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pending refill requests</h1>

      {denyId && (
        <Card title="Deny refill request" className="border-red-200 bg-red-50/40">
          <div className="space-y-3">
            <p className="text-sm text-clinical-text">Provide a brief reason (visible to the patient).</p>
            <Input value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder="e.g. requires in-person review" />
            <div className="flex gap-2">
              <Button
                variant="danger"
                disabled={denyReason.trim().length < 3 || deny.isPending}
                onClick={() => deny.mutate({ refillRequestId: denyId, reason: denyReason.trim() })}
              >
                {deny.isPending ? 'Submitting…' : 'Confirm denial'}
              </Button>
              <Button variant="ghost" onClick={() => { setDenyId(null); setDenyReason(''); }}>Cancel</Button>
            </div>
            {deny.isError && <p className="text-xs text-red-600">{(deny.error as Error).message}</p>}
          </div>
        </Card>
      )}

      <Card>
        {list.isLoading ? <Spinner /> : (
          <Table rows={list.data ?? []} emptyText="No pending refill requests"
            columns={[
              { header: 'Patient', cell: (r) => (
                <div>
                  <div className="font-medium">{r.patient.user.firstName} {r.patient.user.lastName}</div>
                  <div className="text-xs text-clinical-muted">MRN {r.patient.mrn}</div>
                </div>
              )},
              { header: 'Medication', cell: (r) => `${r.prescription.medicationName} (${r.prescription.dosage}, ${r.prescription.frequency})` },
              { header: 'Refills left', cell: (r) => {
                const remaining = r.prescription.refillsAllowed - r.prescription.refillsUsed;
                return <Badge tone={remaining > 0 ? 'success' : 'danger'}>{remaining}</Badge>;
              }},
              { header: 'Requested', cell: (r) => new Date(r.createdAt).toLocaleString() },
              { header: '', cell: (r) => (
                <div className="flex gap-2">
                  <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>Approve</Button>
                  <Button size="sm" variant="danger" disabled={deny.isPending} onClick={() => { setDenyId(r.id); setDenyReason(''); }}>Deny</Button>
                </div>
              )},
            ]}
          />
        )}
        {approve.isError && <p className="text-xs text-red-600 mt-3">{(approve.error as Error).message}</p>}
      </Card>
    </div>
  );
}
