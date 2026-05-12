'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = !!user && ['HOSPITAL_ADMIN', 'SUPER_ADMIN'].includes(user.role);
  const profile = useQuery({
    queryKey: ['me'],
    queryFn: () => api<any>('/patients/me'),
    enabled: !isAdmin,
  });

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-clinical-border bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-8 text-white shadow-lg shadow-brand-900/20">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-1/3 h-56 w-56 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-accent-200">Dashboard</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-brand-100/80">
              {isAdmin
                ? 'Provision new patient accounts or jump into the clinical workspace from the sidebar.'
                : 'Here is a snapshot of your patient profile. Use the sidebar to access records, prescriptions and more.'}
            </p>
          </div>
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
      </header>

      {!isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="MRN" value={profile.data?.mrn ?? '—'} accent />
          <StatCard label="Blood group" value={profile.data?.bloodGroup ?? '—'} />
          <StatCard label="Genotype" value={profile.data?.genotype ?? '—'} />
        </div>
      )}

      {!isAdmin && profile.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(profile.error as Error).message}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-clinical-border bg-white p-5 shadow-sm shadow-brand-900/5 transition hover:shadow-md hover:shadow-brand-900/10">
      <div
        className={`absolute left-0 top-0 h-full w-1 ${
          accent ? 'bg-gradient-to-b from-accent-500 to-accent-400' : 'bg-gradient-to-b from-brand-500 to-brand-400'
        }`}
      />
      <div className="text-[11px] font-medium uppercase tracking-wider text-clinical-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-clinical-text">{value}</div>
    </div>
  );
}
