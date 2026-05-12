'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button, Card, Input, Select } from '@/components/ui';

interface DelegateResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  relation: string;
  scopes: string[];
  created: boolean;
  defaultPassword?: string;
  passwordSource?: 'default' | 'custom';
}

interface CreatePatientResponse {
  id: string;
  userId: string;
  mrn: string;
  email: string;
  firstName: string;
  lastName: string;
  defaultPassword: string;
  passwordSource: 'default' | 'custom';
  delegate?: DelegateResponse;
}

const ADMIN_ROLES = ['HOSPITAL_ADMIN', 'SUPER_ADMIN'];

const RELATIONS = ['SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'GUARDIAN', 'CAREGIVER', 'OTHER'] as const;
const SCOPES: { value: string; label: string }[] = [
  { value: 'VIEW_DEMOGRAPHICS', label: 'View demographics' },
  { value: 'VIEW_MEDICAL_HISTORY', label: 'View medical history' },
  { value: 'VIEW_PRESCRIPTIONS', label: 'View prescriptions' },
  { value: 'REQUEST_REFILL', label: 'Request refills' },
  { value: 'AUTHORIZE_PICKUP', label: 'Authorize pickup' },
  { value: 'VIEW_TEST_RESULTS', label: 'View test results' },
  { value: 'VIEW_IMAGING', label: 'View imaging' },
  { value: 'RECEIVE_PROGRESS_UPDATES', label: 'Receive progress updates' },
  { value: 'EMERGENCY_ACCESS', label: 'Emergency access' },
];
const DEFAULT_SCOPES = ['VIEW_DEMOGRAPHICS', 'RECEIVE_PROGRESS_UPDATES'];

const emptyForm = {
  email: '', firstName: '', lastName: '', phone: '',
  dateOfBirth: '', gender: '', password: '',
};
const emptyDelegate = {
  email: '', firstName: '', lastName: '', phone: '',
  relation: 'SPOUSE' as (typeof RELATIONS)[number],
  scopes: DEFAULT_SCOPES,
  password: '',
};

export default function NewPatientPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ ...emptyForm });
  const [includeDelegate, setIncludeDelegate] = useState(false);
  const [delegate, setDelegate] = useState({ ...emptyDelegate });
  const [created, setCreated] = useState<CreatePatientResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const mutation = useMutation<CreatePatientResponse, Error, void>({
    mutationFn: () => api<CreatePatientResponse>('/patients', {
      method: 'POST',
      json: {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        password: form.password.trim() || undefined,
        delegate: includeDelegate
          ? {
              email: delegate.email.trim(),
              firstName: delegate.firstName.trim(),
              lastName: delegate.lastName.trim(),
              phone: delegate.phone.trim() || undefined,
              relation: delegate.relation,
              scopes: delegate.scopes,
              password: delegate.password.trim() || undefined,
            }
          : undefined,
      },
    }),
    onSuccess: (data) => setCreated(data),
  });

  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return <div className="text-sm text-clinical-muted">Admins only.</div>;
  }

  const onCopy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  const toggleScope = (scope: string) => {
    setDelegate((d) => ({
      ...d,
      scopes: d.scopes.includes(scope) ? d.scopes.filter((s) => s !== scope) : [...d.scopes, scope],
    }));
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
                  onClick={() => onCopy('patient', created.defaultPassword)}
                  className="text-brand-600 text-xs font-medium hover:underline"
                >
                  {copied === 'patient' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-xs text-clinical-muted">
                {created.passwordSource === 'default'
                  ? 'System default password applied. Share it securely with the patient and ask them to change it on first login.'
                  : 'Custom password applied. Share it securely with the patient and ask them to change it on first login.'}
              </p>
            </dd>
          </dl>
        </Card>

        {created.delegate && (
          <Card title={`Family delegate ${created.delegate.created ? '(new account)' : '(linked existing user)'}`}>
            <dl className="grid grid-cols-3 gap-y-3 text-sm">
              <dt className="text-clinical-muted">Name</dt>
              <dd className="col-span-2">{created.delegate.firstName} {created.delegate.lastName}</dd>
              <dt className="text-clinical-muted">Email</dt>
              <dd className="col-span-2">{created.delegate.email}</dd>
              <dt className="text-clinical-muted">Relation</dt>
              <dd className="col-span-2">{created.delegate.relation}</dd>
              <dt className="text-clinical-muted">Scopes</dt>
              <dd className="col-span-2">
                <div className="flex flex-wrap gap-1">
                  {created.delegate.scopes.map((s) => (
                    <span key={s} className="rounded bg-clinical-bg px-2 py-0.5 text-xs ring-1 ring-clinical-border">{s}</span>
                  ))}
                </div>
              </dd>
              {created.delegate.defaultPassword && (
                <>
                  <dt className="text-clinical-muted">Initial password</dt>
                  <dd className="col-span-2">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-clinical-bg px-2 py-1 ring-1 ring-clinical-border">
                        {created.delegate.defaultPassword}
                      </code>
                      <button
                        type="button"
                        onClick={() => onCopy('delegate', created.delegate!.defaultPassword!)}
                        className="text-brand-600 text-xs font-medium hover:underline"
                      >
                        {copied === 'delegate' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-clinical-muted">
                      {created.delegate.passwordSource === 'default'
                        ? 'System default password applied. Share it securely with the delegate and ask them to change it on first login.'
                        : 'Custom password applied. Share it securely with the delegate and ask them to change it on first login.'}
                    </p>
                  </dd>
                </>
              )}
              {!created.delegate.created && (
                <>
                  <dt className="text-clinical-muted">Note</dt>
                  <dd className="col-span-2 text-xs text-clinical-muted">
                    An existing user with this email was linked as the delegate; no new password was issued.
                  </dd>
                </>
              )}
            </dl>
          </Card>
        )}

        <div className="flex gap-2">
          <Button onClick={() => {
            setCreated(null);
            setForm({ ...emptyForm });
            setIncludeDelegate(false);
            setDelegate({ ...emptyDelegate });
          }}>Create another</Button>
          <Link
            href={`/staff/patient/${created.id}`}
            className="inline-flex items-center rounded-lg border border-clinical-border bg-white px-4 py-2 text-sm font-medium hover:bg-clinical-bg"
          >
            Open chart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Create patient account</h1>
      <Card>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
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

          <div className="border-t border-clinical-border pt-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeDelegate}
                onChange={(e) => setIncludeDelegate(e.target.checked)}
              />
              <span>
                <span className="font-medium">Assign a family delegate</span>
                <span className="block text-xs text-clinical-muted">
                  Provision (or link) a family member who will receive updates and can act on the patient's behalf within the granted scopes.
                </span>
              </span>
            </label>
          </div>

          {includeDelegate && (
            <div className="space-y-4 rounded-xl border border-clinical-border bg-clinical-bg/40 p-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Delegate first name *">
                  <Input required value={delegate.firstName} onChange={(e) => setDelegate({ ...delegate, firstName: e.target.value })} />
                </Field>
                <Field label="Delegate last name *">
                  <Input required value={delegate.lastName} onChange={(e) => setDelegate({ ...delegate, lastName: e.target.value })} />
                </Field>
              </div>
              <Field
                label="Delegate email *"
                hint="If a user with this email already exists in your tenant, they will be linked instead of creating a new account."
              >
                <Input type="email" required value={delegate.email} onChange={(e) => setDelegate({ ...delegate, email: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Delegate phone">
                  <Input value={delegate.phone} onChange={(e) => setDelegate({ ...delegate, phone: e.target.value })} />
                </Field>
                <Field label="Relation *">
                  <Select
                    value={delegate.relation}
                    onChange={(e) => setDelegate({ ...delegate, relation: e.target.value as (typeof RELATIONS)[number] })}
                  >
                    {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </Field>
              </div>
              <Field
                label="Delegate initial password (optional)"
                hint="Used only when creating a new delegate account. Must be 12+ chars with upper, lower, digit, symbol."
              >
                <Input
                  type="text"
                  autoComplete="off"
                  value={delegate.password}
                  onChange={(e) => setDelegate({ ...delegate, password: e.target.value })}
                  placeholder="Use system default"
                />
              </Field>
              <div>
                <div className="mb-1 text-xs font-medium text-clinical-muted">Permission scopes *</div>
                <div className="grid grid-cols-2 gap-1">
                  {SCOPES.map((s) => (
                    <label key={s.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={delegate.scopes.includes(s.value)}
                        onChange={() => toggleScope(s.value)}
                      />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
                {delegate.scopes.length === 0 && (
                  <p className="mt-1 text-[11px] text-rose-600">Select at least one scope.</p>
                )}
              </div>
            </div>
          )}

          {mutation.error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {mutation.error.message}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              disabled={mutation.isPending || (includeDelegate && delegate.scopes.length === 0)}
            >
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
