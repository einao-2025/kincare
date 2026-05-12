'use client';
import { useAuthStore } from '@/lib/auth-store';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const NAV = [
  { href: '/staff', label: 'Patient search' },
  { href: '/staff/prescriptions', label: 'Refill queue' },
  { href: '/staff/results', label: 'Upload result' },
  { href: '/staff/progress', label: 'Progress updates' },
  { href: '/staff/audit', label: 'Audit monitor', adminOnly: true },
];

const STAFF_ROLES = ['DOCTOR','NURSE','PHARMACIST','LAB_TECHNICIAN','RADIOLOGIST','HOSPITAL_ADMIN','SUPER_ADMIN'];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    if (!user) router.replace('/login');
    else if (!STAFF_ROLES.includes(user.role)) router.replace('/dashboard');
  }, [user, router]);

  if (!user || !STAFF_ROLES.includes(user.role)) return null;
  const isAdmin = ['HOSPITAL_ADMIN','SUPER_ADMIN'].includes(user.role);

  return (
    <div className="min-h-screen flex bg-clinical-bg">
      <aside className="w-64 shrink-0 border-r border-clinical-border bg-white p-4 flex flex-col">
        <div className="mb-8 flex items-center gap-2.5 px-1">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-md shadow-brand-600/20">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 21s-7-4.534-7-10a5 5 0 019-2.917A5 5 0 0119 11c0 5.466-7 10-7 10z" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">Kincare</div>
            <div className="text-[10px] uppercase tracking-wider text-clinical-muted">Clinical staff</div>
          </div>
        </div>
        {isAdmin && (
          <Link
            href="/staff/patients/new"
            className="mb-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0a1f44] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0d2a5c]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New patient
          </Link>
        )}
        <nav className="space-y-0.5 flex-1">
          {NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => {
            const active = pathname === n.href || (n.href !== '/staff' && pathname?.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`group relative flex items-center rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-clinical-text/80 hover:bg-brand-50/60 hover:text-brand-700'
                }`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-gradient-to-b from-brand-500 to-accent-500" />}
                <span className="pl-1">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 rounded-xl border border-clinical-border bg-clinical-bg/50 p-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[11px] font-semibold text-white">
              {(user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-clinical-text">{user.firstName} {user.lastName}</div>
              <div className="truncate text-clinical-muted">{user.email}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-700 ring-1 ring-accent-100">
              {user.role.replace('_', ' ')}
            </span>
            <button
              onClick={() => { clear(); router.push('/login'); }}
              className="text-brand-600 font-medium hover:text-accent-600 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
