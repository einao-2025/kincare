import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
