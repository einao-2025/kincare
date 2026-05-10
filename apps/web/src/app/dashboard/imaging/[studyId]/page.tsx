'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Badge, Button, Card, Spinner } from '@/components/ui';

interface ViewerInfo {
  studyInstanceUid: string;
  wadoRsRoot: string;
  series: { seriesInstanceUid: string; modality?: string; description?: string;
    instances: { sopInstanceUid: string; instanceNumber?: number }[] }[];
}

export default function StudyViewerPage() {
  const params = useParams<{ studyId: string }>();
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSeriesIdx, setActiveSeriesIdx] = useState(0);
  const [imageIdx, setImageIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const info = useQuery<ViewerInfo>({
    queryKey: ['viewer', params.studyId],
    queryFn: () => api(`/dicom/studies/${params.studyId}/viewer`),
  });

  const series = info.data?.series[activeSeriesIdx];

  useEffect(() => {
    if (!info.data || !series || !containerRef.current || !token) return;
    let disposed = false;
    let renderingEngine: any;

    (async () => {
      try {
        const cs   = await import('@cornerstonejs/core');
        const dimg = await import('@cornerstonejs/dicom-image-loader');
        const dicomParser = await import('dicom-parser');

        await cs.init();
        // Configure WADO-RS image loader with bearer auth
        (dimg as any).external.cornerstone = cs;
        (dimg as any).external.dicomParser = dicomParser;
        (dimg as any).configure({
          beforeSend: (xhr: XMLHttpRequest) => xhr.setRequestHeader('Authorization', `Bearer ${token}`),
        });

        const renderingEngineId = `kincare-re-${params.studyId}`;
        renderingEngine = new (cs as any).RenderingEngine(renderingEngineId);
        const viewportId = 'CT_AXIAL';
        renderingEngine.enableElement({
          viewportId,
          element: containerRef.current!,
          type: (cs as any).Enums.ViewportType.STACK,
        });

        const imageIds = series.instances
          .sort((a, b) => (a.instanceNumber ?? 0) - (b.instanceNumber ?? 0))
          .map((inst) => `wadors:${info.data!.wadoRsRoot}/studies/${info.data!.studyInstanceUid}/series/${series.seriesInstanceUid}/instances/${inst.sopInstanceUid}/frames/1`);

        const viewport = renderingEngine.getViewport(viewportId);
        await viewport.setStack(imageIds, imageIdx);
        viewport.render();
        if (disposed) renderingEngine?.destroy();
      } catch (e) {
        setError(`Viewer failed to initialize: ${(e as Error).message}`);
      }
    })();
    return () => { disposed = true; renderingEngine?.destroy?.(); };
  }, [info.data, activeSeriesIdx, imageIdx, params.studyId, series, token]);

  if (info.isLoading) return <Spinner />;
  if (info.isError) return <p className="text-red-600">Failed to load study.</p>;
  if (!info.data) return null;

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={() => router.back()}>← Back</Button>
      <h1 className="text-2xl font-semibold">DICOM viewer</h1>

      <div className="grid grid-cols-[200px_1fr] gap-4">
        <Card title="Series">
          <ul className="space-y-1 text-sm">
            {info.data.series.map((s, i) => (
              <li key={s.seriesInstanceUid}>
                <button
                  onClick={() => { setActiveSeriesIdx(i); setImageIdx(0); }}
                  className={`block w-full text-left rounded px-2 py-1 ${i === activeSeriesIdx ? 'bg-brand-50 text-brand-700 font-medium' : 'hover:bg-clinical-bg'}`}>
                  <div>{s.description ?? `Series ${i + 1}`}</div>
                  <div className="text-xs text-clinical-muted">
                    {s.modality && <Badge tone="info">{s.modality}</Badge>} {s.instances.length} images
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <div ref={containerRef} className="bg-black w-full" style={{ height: 600 }} />
          {series && series.instances.length > 1 && (
            <div className="mt-3 flex items-center gap-3">
              <input type="range" min={0} max={series.instances.length - 1} value={imageIdx}
                onChange={(e) => setImageIdx(Number(e.target.value))} className="flex-1" />
              <span className="text-sm text-clinical-muted">{imageIdx + 1} / {series.instances.length}</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
