'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button, Card, Input, Spinner, Table } from '@/components/ui';
import Link from 'next/link';

interface PatientHit {
  id: string; mrn: string; dateOfBirth: string; gender: string;
  user: { firstName: string; lastName: string; email: string };
}

export default function StaffSearchPage() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const user = useAuthStore((s) => s.user);
  const isAdmin = !!user && ['HOSPITAL_ADMIN', 'SUPER_ADMIN'].includes(user.role);

  const search = useQuery<PatientHit[]>({
    queryKey: ['patient-search', submitted],
    enabled: submitted.length > 1,
    queryFn: () => api(`/patients?q=${encodeURIComponent(submitted)}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Patient search</h1>
        {isAdmin && (
          <Link
            href="/staff/patients/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a1f44] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0d2a5c]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New patient
          </Link>
        )}
      </div>
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
