import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleEmailProvider, ConsoleSmsProvider, NotificationDispatcher } from '@kincare/notifications';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NOTIF_DISPATCHER, NOTIF_QUEUE } from './notifications.tokens';

export { NOTIF_DISPATCHER, NOTIF_QUEUE };

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    {
      provide: NOTIF_DISPATCHER,
      useFactory: () => new NotificationDispatcher({
        emailProvider: new ConsoleEmailProvider(),
        smsProvider: new ConsoleSmsProvider(),
      }),
    },
    {
      provide: NOTIF_QUEUE,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => new Queue('notifications', {
        connection: new IORedis(cfg.getOrThrow('REDIS_URL'), { maxRetriesPerRequest: null }),
        prefix: cfg.get('REDIS_QUEUE_PREFIX') ?? 'kincare',
      }),
    },
  ],
  exports: [NotificationsService, NOTIF_QUEUE],
})
export class NotificationsModule {}
