'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, EmptyState, Spinner } from '@/components/ui';
import Link from 'next/link';

interface Study {
  id: string; studyInstanceUid: string; modality?: string; description?: string;
  studyDate?: string; numberOfSeries: number; numberOfInstances: number;
}

export default function ImagingPage() {
  const q = useQuery<Study[]>({
    queryKey: ['imaging', 'me'],
    queryFn: () => api('/dicom/studies/patient/me'),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Imaging studies</h1>

      {q.isLoading ? <Spinner /> :
        !q.data?.length ? <EmptyState title="No imaging studies on file" /> :
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {q.data.map((s) => (
            <Card key={s.id} title={s.description ?? 'Imaging study'}>
              <dl className="text-sm space-y-1 text-clinical-muted">
                <div className="flex justify-between"><dt>Modality</dt><dd className="text-clinical-text">{s.modality ?? '—'}</dd></div>
                <div className="flex justify-between"><dt>Date</dt><dd className="text-clinical-text">{s.studyDate ? new Date(s.studyDate).toLocaleDateString() : '—'}</dd></div>
                <div className="flex justify-between"><dt>Series / images</dt><dd className="text-clinical-text">{s.numberOfSeries} / {s.numberOfInstances}</dd></div>
              </dl>
              <Link href={`/dashboard/imaging/${s.id}`}
                className="mt-4 inline-block text-brand-600 font-medium hover:underline text-sm">Open viewer →</Link>
            </Card>
          ))}
        </div>
      }
    </div>
  );
}
