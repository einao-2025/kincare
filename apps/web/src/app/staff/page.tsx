'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, Input, Spinner, Table } from '@/components/ui';
import Link from 'next/link';

interface PatientHit {
  id: string; mrn: string; dateOfBirth: string; gender: string;
  user: { firstName: string; lastName: string; email: string };
}

export default function StaffSearchPage() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');

  const search = useQuery<PatientHit[]>({
    queryKey: ['patient-search', submitted],
    enabled: submitted.length > 1,
    queryFn: () => api(`/patients?q=${encodeURIComponent(submitted)}`),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Patient search</h1>
      <Card>
        <form onSubmit={(e) => { e.preventDefault(); setSubmitted(q); }} className="flex gap-2">
          <Input placeholder="MRN, name, or email" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button>Search</Button>
        </form>
      </Card>

      {submitted && (
        <Card title={`Results for "${submitted}"`}>
          {search.isLoading ? <Spinner /> : (
            <Table rows={search.data ?? []} emptyText="No matches"
              columns={[
                { header: 'MRN', cell: (p) => <code>{p.mrn}</code> },
                { header: 'Name', cell: (p) => `${p.user.firstName} ${p.user.lastName}` },
                { header: 'DOB', cell: (p) => new Date(p.dateOfBirth).toLocaleDateString() },
                { header: 'Gender', cell: (p) => p.gender },
                { header: '', cell: (p) => (
                  <Link href={`/staff/patient/${p.id}`} className="text-brand-600 font-medium text-sm hover:underline">Open chart →</Link>
                )},
              ]}
            />
          )}
        </Card>
      )}
    </div>
  );
}
