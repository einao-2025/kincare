'use client';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';

const schema = z.object({
  patientId: z.string().uuid(),
  category: z.enum(['ADMISSION','PROCEDURE_COMPLETED','DISCHARGE','STATUS']),
  title: z.string().min(3).max(140),
  message: z.string().min(3).max(2000),
  notifyFamily: z.boolean().default(true),
});
type Form = z.infer<typeof schema>;

export default function StaffProgressPage() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'STATUS', notifyFamily: true },
  });
  const post = useMutation({
    mutationFn: (d: Form) => api('/progress', { method: 'POST', json: d }),
    onSuccess: () => reset(),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Send progress update</h1>
      <p className="text-sm text-clinical-muted max-w-prose">
        Updates are recorded on the patient timeline and fan-out to all family delegates with the
        <code className="mx-1">RECEIVE_PROGRESS_UPDATES</code> permission.
      </p>
      <Card>
        <form onSubmit={handleSubmit((d) => post.mutate(d))} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Patient ID</label>
            <Input {...register('patientId')} placeholder="UUID" />
            {errors.patientId && <p className="text-xs text-red-600">{errors.patientId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select {...register('category')}>
                <option value="ADMISSION">Admission</option>
                <option value="PROCEDURE_COMPLETED">Procedure completed</option>
                <option value="DISCHARGE">Discharge</option>
                <option value="STATUS">Status update</option>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('notifyFamily')} className="accent-brand-500" /> Notify family delegates
              </label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input {...register('title')} placeholder="e.g. Surgery completed successfully" />
          </div>
          <div>
            <label className="text-sm font-medium">Message</label>
            <Textarea rows={5} {...register('message')} />
          </div>
          <Button disabled={post.isPending}>{post.isPending ? 'Sending…' : 'Publish update'}</Button>
          {post.isError && <p className="text-xs text-red-600">{(post.error as Error).message}</p>}
          {post.isSuccess && <p className="text-xs text-emerald-700">Update sent.</p>}
        </form>
      </Card>
    </div>
  );
}
