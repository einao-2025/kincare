import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { NotificationChannel } from '@kincare/db';
import { PrismaService } from '../../common/prisma/prisma.module';
import { NOTIF_QUEUE } from './notifications.tokens';

export interface EnqueueNotificationInput {
  userId: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIF_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueue(input: EnqueueNotificationInput) {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        channel: input.channel,
        subject: input.subject,
        body: input.body,
        metadata: input.metadata as never,
      },
    });
    await this.queue.add('send', { notificationId: row.id }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
    return row;
  }

  list(userId: string, opts: { unreadOnly?: boolean } = {}) {
    return this.prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date(), status: 'READ' },
    });
  }

  /** Notify all approved family delegates of a patient about a progress update. */
  async notifyFamilyOfProgress(patientUserId: string, message: { subject: string; body: string }) {
    const grants = await this.prisma.permissionGrant.findMany({
      where: {
        scope: 'RECEIVE_PROGRESS_UPDATES',
        revokedAt: null,
        relationship: { patientUserId, revokedAt: null },
      },
      select: { granteeUserId: true },
      distinct: ['granteeUserId'],
    });
    await Promise.all(
      grants.map((g) => this.enqueue({
        userId: g.granteeUserId,
        channel: NotificationChannel.IN_APP,
        subject: message.subject,
        body: message.body,
      })),
    );
  }
}
