import { Worker } from 'bullmq';
import type IORedis from 'ioredis';
import type { Logger } from 'pino';
import { ConsoleEmailProvider, ConsoleSmsProvider, NotificationDispatcher } from '@kincare/notifications';
import { prisma } from '@kincare/db';
import { jobDuration, jobsProcessed } from '../metrics';

interface Opts { connection: IORedis; prefix: string; logger: Logger; }

export function startNotificationsWorker({ connection, prefix, logger }: Opts) {
  const dispatcher = new NotificationDispatcher({
    emailProvider: new ConsoleEmailProvider(),
    smsProvider: new ConsoleSmsProvider(),
  });

  const worker = new Worker(
    'notifications',
    async (job) => {
      const { notificationId } = job.data as { notificationId: string };
      const notif = await prisma.notification.findUniqueOrThrow({
        where: { id: notificationId },
        include: { user: true },
      });
      let result: { ok: boolean; externalId?: string; error?: string };
      switch (notif.channel) {
        case 'EMAIL':
          result = await dispatcher.email({
            to: notif.user.email, subject: notif.subject ?? 'Kincare', html: notif.body,
          });
          break;
        case 'SMS':
          if (!notif.user.phone) throw new Error('User has no phone number');
          result = await dispatcher.sms({ to: notif.user.phone, body: notif.body });
          break;
        case 'IN_APP':
        case 'PUSH':
          result = { ok: true, externalId: 'in-app' };
          break;
        default:
          throw new Error(`Unsupported notification channel: ${notif.channel as string}`);
      }
      await prisma.notification.update({
        where: { id: notif.id },
        data: result.ok
          ? { status: 'SENT', sentAt: new Date(), externalId: result.externalId }
          : { status: 'FAILED', failedReason: result.error ?? 'unknown' },
      });
    },
    { connection, prefix, concurrency: 8 },
  );

  worker.on('failed', (job, err) => {
    jobsProcessed.labels('notifications', 'failed').inc();
    logger.error({ jobId: job?.id, err: err.message }, 'notification job failed');
  });
  worker.on('completed', (job) => {
    jobsProcessed.labels('notifications', 'completed').inc();
    if (job.processedOn && job.finishedOn) {
      jobDuration.labels('notifications').observe((job.finishedOn - job.processedOn) / 1000);
    }
    logger.info({ jobId: job.id }, 'notification job completed');
  });
}
