'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, Input, Select, Spinner } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';

interface PatientProfile {
  id: string;
  mrn: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string;
  genotype?: string;
  user: { id: string; email: string; firstName: string; lastName: string; phone?: string };
  address: {
    line1?: string | null; line2?: string | null;
    city?: string | null; state?: string | null;
    postalCode?: string | null; country?: string | null;
  };
}

interface ProfileForm {
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string;
  genotype?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const me = useQuery<PatientProfile>({ queryKey: ['patient', 'me'], queryFn: () => api('/patients/me') });
  const [mfaSetup, setMfaSetup] = useState<{ otpauthUrl?: string; secret?: string; recoveryCodes?: string[] } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const startMfa = useMutation({
    mutationFn: () => api<{ otpauthUrl?: string; secret?: string; recoveryCodes?: string[] }>('/auth/mfa/setup', { method: 'POST' }),
    onSuccess: setMfaSetup,
  });
  const confirmMfa = useMutation({
    mutationFn: (code: string) => api('/auth/mfa/confirm', { method: 'POST', json: { code } }),
    onSuccess: () => { setMfaSetup(null); setMfaCode(''); },
  });

  const form = useForm<ProfileForm>();
  const update = useMutation({
    mutationFn: (d: ProfileForm) =>
      api(`/patients/${me.data!.id}`, { method: 'PATCH', json: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', 'me'] }),
  });

  if (me.isLoading) return <Spinner />;
  if (!me.data) return <div className="text-sm text-red-600">{(me.error as Error)?.message ?? 'Unable to load profile'}</div>;
  const p = me.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile &amp; security</h1>

      <Card title="Account">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-clinical-muted">Name</dt><dd>{p.user.firstName} {p.user.lastName}</dd>
          <dt className="text-clinical-muted">Email</dt><dd>{p.user.email}</dd>
          {p.user.phone && (<><dt className="text-clinical-muted">Phone</dt><dd>{p.user.phone}</dd></>)}
          <dt className="text-clinical-muted">MRN</dt><dd className="font-mono">{p.mrn}</dd>
        </dl>
      </Card>

      <Card title="Medical &amp; demographic information">
        <form
          onSubmit={form.handleSubmit((d) => update.mutate(d))}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Date of birth</label>
              <Input type="date" defaultValue={p.dateOfBirth?.slice(0, 10)} {...form.register('dateOfBirth')} />
            </div>
            <div>
              <label className="text-sm font-medium">Gender</label>
              <Select defaultValue={p.gender ?? ''} {...form.register('gender')}>
                <option value="">—</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="UNKNOWN">Prefer not to say</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Blood group</label>
              <Input defaultValue={p.bloodGroup ?? ''} {...form.register('bloodGroup')} placeholder="e.g. O+" />
            </div>
            <div>
              <label className="text-sm font-medium">Genotype</label>
              <Input defaultValue={p.genotype ?? ''} {...form.register('genotype')} placeholder="e.g. AA" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Address line 1</label>
              <Input defaultValue={p.address.line1 ?? ''} {...form.register('addressLine1')} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Address line 2</label>
              <Input defaultValue={p.address.line2 ?? ''} {...form.register('addressLine2')} />
            </div>
            <div>
              <label className="text-sm font-medium">City</label>
              <Input defaultValue={p.address.city ?? ''} {...form.register('city')} />
            </div>
            <div>
              <label className="text-sm font-medium">State / region</label>
              <Input defaultValue={p.address.state ?? ''} {...form.register('state')} />
            </div>
            <div>
              <label className="text-sm font-medium">Postal code</label>
              <Input defaultValue={p.address.postalCode ?? ''} {...form.register('postalCode')} />
            </div>
            <div>
              <label className="text-sm font-medium">Country</label>
              <Input defaultValue={p.address.country ?? ''} {...form.register('country')} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}</Button>
            {update.isSuccess && <span className="text-xs text-emerald-700">Saved.</span>}
            {update.isError && <span className="text-xs text-red-600">{(update.error as Error).message}</span>}
          </div>
        </form>
      </Card>

      <Card title="Two-factor authentication">
        {authUser?.mfaEnabled ? (
          <p className="text-sm text-emerald-700">✓ MFA is enabled on your account.</p>
        ) : mfaSetup ? (
          <div className="space-y-3">
            <p className="text-sm">
              Scan the setup URL in your authenticator app, then enter the 6-digit code below.
            </p>
            {mfaSetup.otpauthUrl && (
              <code className="block break-all text-xs bg-clinical-bg p-3 rounded border border-clinical-border">
                {mfaSetup.otpauthUrl}
              </code>
            )}
            {mfaSetup.secret && (
              <div className="text-xs text-clinical-muted">
                Manual entry secret: <code className="font-mono">{mfaSetup.secret}</code>
              </div>
            )}
            <div className="flex gap-2">
              <Input maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="123456" className="font-mono" />
              <Button onClick={() => confirmMfa.mutate(mfaCode)} disabled={mfaCode.length !== 6 || confirmMfa.isPending}>
                Verify &amp; enable
              </Button>
            </div>
            {confirmMfa.isError && <p className="text-xs text-red-600">{(confirmMfa.error as Error).message}</p>}
            {mfaSetup.recoveryCodes && mfaSetup.recoveryCodes.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer">Recovery codes (store securely)</summary>
                <div className="grid grid-cols-2 gap-1 mt-2 font-mono text-xs">
                  {mfaSetup.recoveryCodes.map((c) => <span key={c}>{c}</span>)}
                </div>
              </details>
            )}
          </div>
        ) : (
          <Button onClick={() => startMfa.mutate()} disabled={startMfa.isPending}>
            {startMfa.isPending ? 'Starting…' : 'Enable MFA'}
          </Button>
        )}
      </Card>
    </div>
  );
}
