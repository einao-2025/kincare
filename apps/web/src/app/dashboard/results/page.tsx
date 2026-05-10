'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, Card, Spinner, Table } from '@/components/ui';

interface TestResult {
  id: string; testName: string; testCode?: string; resultValue?: string; unit?: string;
  referenceRange?: string; flag?: string; performedAt: string;
}

export default function ResultsPage() {
  const q = useQuery<TestResult[]>({
    queryKey: ['results', 'me'],
    queryFn: () => api('/results/patient/me'),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Test results</h1>
      <Card>
        {q.isLoading ? <Spinner /> : (
          <Table rows={q.data ?? []} emptyText="No test results yet"
            columns={[
              { header: 'Test', cell: (r) => (
                <div>
                  <div className="font-medium">{r.testName}</div>
                  {r.testCode && <div className="text-xs text-clinical-muted">LOINC {r.testCode}</div>}
                </div>
              )},
              { header: 'Result', cell: (r) => (
                <span className={r.flag && r.flag !== 'N' ? 'font-semibold text-amber-700' : ''}>
                  {r.resultValue ?? '—'}{r.unit ? ` ${r.unit}` : ''}
                </span>
              )},
              { header: 'Reference', cell: (r) => r.referenceRange ?? '—' },
              { header: 'Flag', cell: (r) => r.flag ? <Badge tone={r.flag === 'N' ? 'neutral' : 'warn'}>{r.flag}</Badge> : '—' },
              { header: 'Date', cell: (r) => new Date(r.performedAt).toLocaleDateString() },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
