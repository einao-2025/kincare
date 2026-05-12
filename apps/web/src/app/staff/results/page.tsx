'use client';
import { useCallback, useRef, useState } from 'react';
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
  flag: z.enum(['N', 'L', 'H', 'LL', 'HH', 'A']).optional(),
  performedAt: z.string().min(1, 'Required'),
  notes: z.string().optional(),
});
type ResultForm = z.infer<typeof schema>;

interface DiagnosticReport { id: string }
interface ReportAttachment { id: string; fileName: string; contentType: string; bytes: number }

const ACCEPT = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];
const ACCEPT_ATTR = ACCEPT.join(',');
const MAX_BYTES = 25 * 1024 * 1024;

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function StaffResultUploadPage() {
  const {
    register, handleSubmit, reset, getValues, formState: { errors },
  } = useForm<ResultForm>({
    resolver: zodResolver(schema),
    defaultValues: { performedAt: new Date().toISOString().slice(0, 16) },
  });

  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ resultId?: string; attachmentsUploaded: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setUploadError(null);
    const next: File[] = [];
    for (const f of Array.from(incoming)) {
      if (f.size > MAX_BYTES) {
        setUploadError(`"${f.name}" exceeds the 25 MB per-file limit.`);
        continue;
      }
      if (f.type && !ACCEPT.includes(f.type)) {
        setUploadError(`"${f.name}" has an unsupported type (${f.type}).`);
        continue;
      }
      next.push(f);
    }
    if (next.length) setFiles((prev) => [...prev, ...next].slice(0, 10));
  }, []);

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const upload = useMutation({
    mutationFn: async (d: ResultForm) => {
      const performedAt = new Date(d.performedAt).toISOString();

      // 1) If files were selected, create a DiagnosticReport so the
      //    attachments have a stable parent record.
      let reportId: string | undefined;
      if (files.length > 0) {
        const report = await api<DiagnosticReport>('/results/reports', {
          method: 'POST',
          json: {
            patientId: d.patientId,
            code: d.testCode || d.testName.toUpperCase().slice(0, 30),
            display: d.testName,
            conclusion: d.notes,
            status: 'PRELIMINARY',
          },
        });
        reportId = report.id;
      }

      // 2) Persist the structured lab value (optionally linked to the report).
      const testResult = await api<{ id: string }>('/results/lab', {
        method: 'POST',
        json: { ...d, reportId, performedAt },
      });

      // 3) Upload attachments (if any) against the report.
      let attachmentsUploaded = 0;
      if (reportId && files.length > 0) {
        const fd = new FormData();
        for (const f of files) fd.append('files', f, f.name);
        const uploaded = await api<ReportAttachment[]>(
          `/results/reports/${reportId}/attachments`,
          { method: 'POST', body: fd },
        );
        attachmentsUploaded = uploaded.length;
      }
      return { resultId: testResult.id, attachmentsUploaded };
    },
    onSuccess: (data) => {
      setSuccess(data);
      setFiles([]);
      reset({ performedAt: new Date().toISOString().slice(0, 16), patientId: getValues('patientId') });
    },
  });

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Upload test result</h1>
      <Card>
        <form onSubmit={handleSubmit((d) => { setSuccess(null); upload.mutate(d); })} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Patient ID</label>
            <Input {...register('patientId')} placeholder="UUID — find on patient chart page" />
            {errors.patientId && <p className="text-xs text-red-600">{errors.patientId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Test name</label>
              <Input {...register('testName')} placeholder="e.g. Hemoglobin A1c" />
              {errors.testName && <p className="text-xs text-red-600">{errors.testName.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">LOINC code</label>
              <Input {...register('testCode')} placeholder="e.g. 4548-4" />
            </div>
            <div>
              <label className="text-sm font-medium">Result value</label>
              <Input {...register('resultValue')} />
              {errors.resultValue && <p className="text-xs text-red-600">{errors.resultValue.message}</p>}
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

          {/* Drag-and-drop attachments */}
          <div className="pt-2">
            <label className="text-sm font-medium">Attachments (images or documents)</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
              className={`mt-1 cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
                dragActive
                  ? 'border-[#0a1f44] bg-[#0a1f44]/5'
                  : 'border-clinical-border bg-clinical-bg/40 hover:border-[#0a1f44]/60 hover:bg-[#0a1f44]/5'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="mx-auto h-8 w-8 text-clinical-muted">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
              </svg>
              <div className="mt-2 text-sm text-clinical-text">
                <span className="font-medium text-[#0a1f44]">Click to browse</span> or drag &amp; drop files here
              </div>
              <div className="mt-1 text-[11px] text-clinical-muted">
                Images (JPEG, PNG, GIF, WebP, HEIC) or documents (PDF, Word, Excel, CSV, TXT) · up to 25 MB each · max 10 files
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {files.length > 0 && (
              <ul className="mt-3 divide-y divide-clinical-border rounded-lg border border-clinical-border">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                    {f.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={URL.createObjectURL(f)}
                        alt=""
                        className="h-10 w-10 rounded object-cover ring-1 ring-clinical-border"
                        onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                      />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded bg-clinical-bg text-[10px] font-semibold uppercase text-clinical-muted ring-1 ring-clinical-border">
                        {f.name.split('.').pop()?.slice(0, 4) ?? 'FILE'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{f.name}</div>
                      <div className="text-xs text-clinical-muted">{f.type || 'unknown'} · {bytesLabel(f.size)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-xs font-medium text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button disabled={upload.isPending}>
              {upload.isPending ? 'Uploading…' : files.length > 0 ? `Upload result + ${files.length} file${files.length > 1 ? 's' : ''}` : 'Upload result'}
            </Button>
            {upload.isError && <p className="text-xs text-red-600">{(upload.error as Error).message}</p>}
            {success && (
              <p className="text-xs text-emerald-700">
                Result saved{success.attachmentsUploaded > 0 ? ` with ${success.attachmentsUploaded} attachment${success.attachmentsUploaded > 1 ? 's' : ''}` : ''}.
              </p>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
