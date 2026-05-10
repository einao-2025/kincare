'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Input, Select, Spinner, Table } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const SCOPES = [
  'VIEW_DEMOGRAPHICS','VIEW_MEDICAL_HISTORY','VIEW_PRESCRIPTIONS','REQUEST_REFILL',
  'AUTHORIZE_PICKUP','VIEW_TEST_RESULTS','VIEW_IMAGING','RECEIVE_PROGRESS_UPDATES','EMERGENCY_ACCESS',
] as const;

const inviteSchema = z.object({
  email: z.string().email(),
  relation: z.enum(['SPOUSE','PARENT','CHILD','SIBLING','GUARDIAN','OTHER']),
  scopes: z.array(z.enum(SCOPES)).min(1),
});
type InviteForm = z.infer<typeof inviteSchema>;

interface DelegateRow {
  id: string;
  relation: string;
  revokedAt?: string | null;
  delegate: { id: string; email: string; firstName: string; lastName: string };
  grants: { scope: string; revokedAt?: string | null }[];
}

export default function FamilyPage() {
  const qc = useQueryClient();

  const delegates = useQuery<DelegateRow[]>({
    queryKey: ['family', 'delegates'],
    queryFn: () => api('/family/delegates'),
  });

  const invite = useMutation({
    mutationFn: (data: InviteForm) =>
      api<{ id: string; token: string; expiresAt: string }>('/family/invites', { method: 'POST', json: data }),
    onSuccess: () => { reset(); qc.invalidateQueries({ queryKey: ['family', 'delegates'] }); },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/family/relationships/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family', 'delegates'] }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { scopes: ['VIEW_DEMOGRAPHICS'] },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Family access</h1>

      <Card title="Invite a family member">
        <form onSubmit={handleSubmit((d) => invite.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Relationship</label>
              <Select {...register('relation')}>
                <option value="SPOUSE">Spouse</option><option value="PARENT">Parent</option>
                <option value="CHILD">Child</option><option value="SIBLING">Sibling</option>
                <option value="GUARDIAN">Guardian</option><option value="OTHER">Other</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Permissions to grant</label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={s} {...register('scopes')} className="accent-brand-500" />
                  {s.replaceAll('_', ' ').toLowerCase()}
                </label>
              ))}
            </div>
            {errors.scopes && <p className="text-xs text-red-600">Select at least one permission</p>}
          </div>
          <Button disabled={invite.isPending}>{invite.isPending ? 'Sending…' : 'Send invitation'}</Button>
          {invite.isError && <p className="text-xs text-red-600">{(invite.error as Error).message}</p>}
          {invite.isSuccess && invite.data && (
            <div className="rounded-lg border border-accent-200 bg-accent-50/60 p-3 text-sm">
              <div className="font-medium text-accent-800">Invite created — share this token securely:</div>
              <code className="mt-1 block break-all font-mono text-xs text-clinical-text">{invite.data.token}</code>
              <div className="mt-1 text-xs text-clinical-muted">
                Expires {new Date(invite.data.expiresAt).toLocaleString()}
              </div>
            </div>
          )}
        </form>
      </Card>

      <Card title="Existing delegates">
        {delegates.isLoading ? <Spinner /> :
          !delegates.data?.length ? <EmptyState title="No family delegates yet" /> :
          <Table rows={delegates.data}
            columns={[
              { header: 'Delegate', cell: (g) => (
                <div>
                  <div className="font-medium">{g.delegate.firstName} {g.delegate.lastName}</div>
                  <div className="text-xs text-clinical-muted">{g.delegate.email}</div>
                </div>
              )},
              { header: 'Relationship', cell: (g) => <Badge tone="info">{g.relation}</Badge> },
              { header: 'Permissions', cell: (g) => (
                <div className="flex flex-wrap gap-1">
                  {g.grants.filter((s) => !s.revokedAt).map((s) => (
                    <Badge key={s.scope}>{s.scope.replaceAll('_',' ').toLowerCase()}</Badge>
                  ))}
                </div>
              )},
              { header: 'Status', cell: (g) => g.revokedAt
                ? <Badge tone="neutral">revoked</Badge>
                : <Badge tone="success">active</Badge> },
              { header: '', cell: (g) => !g.revokedAt ? (
                <Button size="sm" variant="danger" disabled={revoke.isPending} onClick={() => revoke.mutate(g.id)}>Revoke</Button>
              ) : null },
            ]}
          />
        }
      </Card>
    </div>
  );
}
