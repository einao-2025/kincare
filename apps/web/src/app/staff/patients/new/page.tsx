'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button, Card, Input, Select } from '@/components/ui';

interface CreatePatientResponse {
  id: string;
  userId: string;
  mrn: string;
  email: string;
  firstName: string;
  lastName: string;
  defaultPassword: string;
  passwordSource: 'default' | 'custom';
}

const ADMIN_ROLES = ['HOSPITAL_ADMIN', 'SUPER_ADMIN'];

export default function NewPatientPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '', phone: '',
    dateOfBirth: '', gender: '', password: '',
  });
  const [created, setCreated] = useState<CreatePatientResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation<CreatePatientResponse, Error, typeof form>({
    mutationFn: (payload) => api<CreatePatientResponse>('/patients', {
      method: 'POST',
      json: {
        email: payload.email.trim(),
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        phone: payload.phone.trim() || undefined,
        dateOfBirth: payload.dateOfBirth || undefined,
        gender: payload.gender || undefined,
        password: payload.password.trim() || undefined,
      },
    }),
    onSuccess: (data) => setCreated(data),
  });

  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return <div className="text-sm text-clinical-muted">Admins only.</div>;
  }

  const onCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.defaultPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  if (created) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-semibold">Patient account created</h1>
        <Card>
          <dl className="grid grid-cols-3 gap-y-3 text-sm">
            <dt className="text-clinical-muted">Name</dt>
            <dd className="col-span-2">{created.firstName} {created.lastName}</dd>
            <dt className="text-clinical-muted">MRN</dt>
            <dd className="col-span-2"><code>{created.mrn}</code></dd>
            <dt className="text-clinical-muted">Email</dt>
            <dd className="col-span-2">{created.email}</dd>
            <dt className="text-clinical-muted">Initial password</dt>
            <dd className="col-span-2">
              <div className="flex items-center gap-2">
                <code className="rounded bg-clinical-bg px-2 py-1 ring-1 ring-clinical-border">
                  {created.defaultPassword}
                </code>
                <button
                  type="button"
                  onClick={onCopy}
                  className="text-brand-600 text-xs font-medium hover:underline"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-xs text-clinical-muted">
                {created.passwordSource === 'default'
                  ? 'System default password applied. Share it securely with the patient and ask them to change it on first login.'
                  : 'Custom password applied. Share it securely with the patient and ask them to change it on first login.'}
              </p>
            </dd>
          </dl>
          <div className="mt-6 flex gap-2">
            <Button onClick={() => { setCreated(null); setForm({
              email: '', firstName: '', lastName: '', phone: '',
              dateOfBirth: '', gender: '', password: '',
            }); }}>Create another</Button>
            <Link
              href={`/staff/patient/${created.id}`}
              className="inline-flex items-center rounded-lg border border-clinical-border bg-white px-4 py-2 text-sm font-medium hover:bg-clinical-bg"
            >
              Open chart
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Create patient account</h1>
      <Card>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name *">
              <Input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field label="Last name *">
              <Input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
          </div>

          <Field label="Email *">
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </Field>
          </div>

          <Field label="Gender">
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="UNKNOWN">Unknown</option>
            </Select>
          </Field>

          <Field
            label="Initial password (optional)"
            hint="Leave blank to apply the system default. Must be 12+ chars with upper, lower, digit, symbol."
          >
            <Input
              type="text"
              autoComplete="off"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Use system default"
            />
          </Field>

          {mutation.error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {mutation.error.message}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create patient'}
            </Button>
            <button
              type="button"
              onClick={() => router.push('/staff')}
              className="rounded-lg border border-clinical-border bg-white px-4 py-2 text-sm font-medium hover:bg-clinical-bg"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-clinical-muted">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-clinical-muted">{hint}</div>}
    </label>
  );
}
