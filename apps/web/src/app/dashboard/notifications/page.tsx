'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';

interface Notification {
  id: string; channel: string; subject: string; body: string;
  status: string; createdAt: string; readAt?: string;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const list = useQuery<Notification[]>({
    queryKey: ['notifications', 'me'],
    queryFn: () => api('/notifications'),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'me'] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      {list.isLoading ? <Spinner /> :
        !list.data?.length ? <EmptyState title="No notifications" /> :
        <div className="space-y-3">
          {list.data.map((n) => (
            <Card key={n.id} className={n.readAt ? '' : 'border-brand-300'}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{n.subject}</span>
                    <Badge tone={n.readAt ? 'neutral' : 'info'}>{n.channel}</Badge>
                    {!n.readAt && <Badge tone="warn">new</Badge>}
                  </div>
                  <p className="text-sm text-clinical-muted mt-1 whitespace-pre-line">{n.body}</p>
                  <div className="text-xs text-clinical-muted mt-2">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
                {!n.readAt && (
                  <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}>Mark read</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      }
    </div>
  );
}
