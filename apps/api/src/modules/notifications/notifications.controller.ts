import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthPrincipal } from '@kincare/shared';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notif: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notif.list(user.userId, { unreadOnly: unreadOnly === 'true' });
  }

  @Patch(':id/read')
  read(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.notif.markRead(user.userId, id);
  }
}
