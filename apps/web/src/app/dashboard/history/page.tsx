'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, Spinner, Table } from '@/components/ui';

interface Encounter { id: string; class: string; status: string; location?: string; startAt: string; endAt?: string; reasonText?: string; }
interface Condition { id: string; code: string; display: string; clinicalStatus: string; onsetDate?: string; }
interface Allergy   { id: string; substance: string; reaction?: string; severity?: string; }

export default function HistoryPage() {
  const enc = useQuery<Encounter[]>({ queryKey: ['encounters', 'me'], queryFn: () => api('/patients/me/encounters') });
  const cond = useQuery<Condition[]>({ queryKey: ['conditions', 'me'], queryFn: () => api('/patients/me/conditions') });
  const allergy = useQuery<Allergy[]>({ queryKey: ['allergies', 'me'], queryFn: () => api('/patients/me/allergies') });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Medical history</h1>

      <Card title="Visits & encounters">
        {enc.isLoading ? <Spinner /> : (
          <Table rows={enc.data ?? []} emptyText="No visits recorded yet"
            columns={[
              { header: 'Date', cell: (r) => new Date(r.startAt).toLocaleDateString() },
              { header: 'Class', cell: (r) => <Badge tone="info">{r.class}</Badge> },
              { header: 'Location', cell: (r) => r.location ?? '—' },
              { header: 'Status', cell: (r) => <Badge tone={r.status === 'FINISHED' ? 'neutral' : 'success'}>{r.status}</Badge> },
              { header: 'Reason', cell: (r) => r.reasonText ?? '—' },
            ]}
          />
        )}
      </Card>

      <Card title="Active conditions">
        {cond.isLoading ? <Spinner /> : (
          <Table rows={cond.data ?? []} emptyText="No conditions on file"
            columns={[
              { header: 'Condition', cell: (r) => r.display },
              { header: 'Code', cell: (r) => <code className="text-xs text-clinical-muted">{r.code}</code> },
              { header: 'Status', cell: (r) => <Badge tone={r.clinicalStatus === 'active' ? 'warn' : 'neutral'}>{r.clinicalStatus}</Badge> },
              { header: 'Onset', cell: (r) => r.onsetDate ? new Date(r.onsetDate).toLocaleDateString() : '—' },
            ]}
          />
        )}
      </Card>

      <Card title="Allergies & intolerances">
        {allergy.isLoading ? <Spinner /> : (
          <Table rows={allergy.data ?? []} emptyText="No known allergies"
            columns={[
              { header: 'Substance', cell: (r) => r.substance },
              { header: 'Reaction', cell: (r) => r.reaction ?? '—' },
              { header: 'Severity', cell: (r) => r.severity ? <Badge tone={r.severity === 'severe' ? 'danger' : 'warn'}>{r.severity}</Badge> : '—' },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
