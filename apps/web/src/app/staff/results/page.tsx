'use client';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';

const schema = z.object({
  patientId: z.string().uuid('Provide patient UUID (search first)'),
  testName: z.string().min(2),
  testCode: z.string().optional(),
  resultValue: z.string().min(1),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  flag: z.enum(['N','L','H','LL','HH','A']).optional(),
  performedAt: z.string().min(1, 'Required'),
  notes: z.string().optional(),
});
type ResultForm = z.infer<typeof schema>;

export default function StaffResultUploadPage() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitSuccessful } } = useForm<ResultForm>({
    resolver: zodResolver(schema),
    defaultValues: { performedAt: new Date().toISOString().slice(0, 16) },
  });
  const upload = useMutation({
    mutationFn: (d: ResultForm) => api('/results/lab', {
      method: 'POST',
      json: { ...d, performedAt: new Date(d.performedAt).toISOString() },
    }),
    onSuccess: () => reset({ performedAt: new Date().toISOString().slice(0, 16) }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Upload test result</h1>
      <Card>
        <form onSubmit={handleSubmit((d) => upload.mutate(d))} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Patient ID</label>
            <Input {...register('patientId')} placeholder="UUID — find on patient chart page" />
            {errors.patientId && <p className="text-xs text-red-600">{errors.patientId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Test name</label>
              <Input {...register('testName')} placeholder="e.g. Hemoglobin A1c" />
            </div>
            <div>
              <label className="text-sm font-medium">LOINC code</label>
              <Input {...register('testCode')} placeholder="e.g. 4548-4" />
            </div>
            <div>
              <label className="text-sm font-medium">Result value</label>
              <Input {...register('resultValue')} />
            </div>
            <div>
              <label className="text-sm font-medium">Unit</label>
              <Input {...register('unit')} />
            </div>
            <div>
              <label className="text-sm font-medium">Reference range</label>
              <Input {...register('referenceRange')} />
            </div>
            <div>
              <label className="text-sm font-medium">Abnormal flag</label>
              <Select {...register('flag')}>
                <option value="">Normal</option>
                <option value="L">Low</option><option value="H">High</option>
                <option value="LL">Critical low</option><option value="HH">Critical high</option>
                <option value="A">Abnormal</option>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Performed at</label>
              <Input type="datetime-local" {...register('performedAt')} />
              {errors.performedAt && <p className="text-xs text-red-600">{errors.performedAt.message}</p>}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea {...register('notes')} rows={3} />
          </div>
          <Button disabled={upload.isPending}>{upload.isPending ? 'Uploading…' : 'Upload result'}</Button>
          {upload.isError && <p className="text-xs text-red-600">{(upload.error as Error).message}</p>}
          {isSubmitSuccessful && upload.isSuccess && <p className="text-xs text-emerald-700">Result saved.</p>}
        </form>
      </Card>
    </div>
  );
}
