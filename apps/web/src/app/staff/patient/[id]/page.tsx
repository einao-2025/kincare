'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, Spinner, Table } from '@/components/ui';

interface PatientProfile {
  id: string;
  mrn: string;
  dateOfBirth: string;
  gender?: string;
  bloodGroup?: string;
  genotype?: string;
  user: { id: string; email: string; firstName: string; lastName: string; phone?: string };
  address: {
    line1?: string | null; line2?: string | null;
    city?: string | null; state?: string | null;
    postalCode?: string | null; country?: string | null;
  };
  nationalId?: string | null;
}

interface EmergencyContact {
  id: string; name: string; relation: string; phone: string; email?: string | null; priority?: number;
}
interface Allergy {
  id: string; substance: string; reaction?: string | null; severity?: string | null; recordedAt: string;
}
interface Condition {
  id: string; code: string; display: string; onsetDate?: string | null; notes?: string | null;
}

function formatAddress(a: PatientProfile['address']): string {
  const parts = [a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function ageFrom(dob: string): string {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return `${age} yrs`;
}

export default function StaffPatientPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const profile = useQuery<PatientProfile>({
    queryKey: ['staff', 'patient', id],
    queryFn: () => api(`/patients/${id}`),
    enabled: !!id,
  });
  const contacts = useQuery<EmergencyContact[]>({
    queryKey: ['staff', 'patient', id, 'emergency-contacts'],
    queryFn: () => api(`/patients/${id}/emergency-contacts`),
    enabled: !!id,
  });
  const allergies = useQuery<Allergy[]>({
    queryKey: ['staff', 'patient', id, 'allergies'],
    queryFn: () => api(`/patients/${id}/allergies`),
    enabled: !!id,
  });
  const conditions = useQuery<Condition[]>({
    queryKey: ['staff', 'patient', id, 'conditions'],
    queryFn: () => api(`/patients/${id}/conditions`),
    enabled: !!id,
  });

  if (profile.isLoading) return <Spinner />;
  if (profile.error || !profile.data) {
    return (
      <div className="space-y-4">
        <Link href="/staff" className="text-sm text-brand-600 hover:underline">← Back to search</Link>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {(profile.error as Error)?.message ?? 'Unable to load patient'}
        </div>
      </div>
    );
  }

  const p = profile.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/staff" className="text-sm text-brand-600 hover:underline">← Back to search</Link>
        <code className="text-xs text-clinical-muted">MRN {p.mrn}</code>
      </div>

      <Card>
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-semibold text-white">
            {(p.user.firstName?.[0] ?? '') + (p.user.lastName?.[0] ?? '')}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {p.user.firstName} {p.user.lastName}
            </h1>
            <div className="mt-1 text-sm text-clinical-muted">
              {p.gender ?? '—'} · {ageFrom(p.dateOfBirth)} · DOB {new Date(p.dateOfBirth).toLocaleDateString()}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Demographics">
        <dl className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm md:grid-cols-3">
          <Field label="Email" value={p.user.email} />
          <Field label="Phone" value={p.user.phone ?? '—'} />
          <Field label="National ID" value={p.nationalId ?? '—'} />
          <Field label="Blood group" value={p.bloodGroup ?? '—'} />
          <Field label="Genotype" value={p.genotype ?? '—'} />
          <Field label="Address" value={formatAddress(p.address)} wide />
        </dl>
      </Card>

      <Card title="Emergency contacts">
        {contacts.isLoading ? <Spinner /> : (
          <Table
            rows={contacts.data ?? []}
            emptyText="No emergency contacts on file"
            columns={[
              { header: 'Name', cell: (c) => c.name },
              { header: 'Relation', cell: (c) => c.relation },
              { header: 'Phone', cell: (c) => c.phone },
              { header: 'Email', cell: (c) => c.email ?? '—' },
            ]}
          />
        )}
      </Card>

      <Card title="Allergies">
        {allergies.isLoading ? <Spinner /> : (
          <Table
            rows={allergies.data ?? []}
            emptyText="No allergies recorded"
            columns={[
              { header: 'Substance', cell: (a) => a.substance },
              { header: 'Reaction', cell: (a) => a.reaction ?? '—' },
              { header: 'Severity', cell: (a) => a.severity ?? '—' },
              { header: 'Recorded', cell: (a) => new Date(a.recordedAt).toLocaleDateString() },
            ]}
          />
        )}
      </Card>

      <Card title="Conditions">
        {conditions.isLoading ? <Spinner /> : (
          <Table
            rows={conditions.data ?? []}
            emptyText="No conditions recorded"
            columns={[
              { header: 'Code', cell: (c) => <code className="text-xs">{c.code}</code> },
              { header: 'Display', cell: (c) => c.display },
              { header: 'Onset', cell: (c) => c.onsetDate ? new Date(c.onsetDate).toLocaleDateString() : '—' },
              { header: 'Notes', cell: (c) => c.notes ?? '—' },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 md:col-span-3' : ''}>
      <div className="text-[11px] uppercase tracking-wider text-clinical-muted">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
