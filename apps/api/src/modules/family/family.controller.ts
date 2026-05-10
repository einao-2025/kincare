import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions, sha256Hex } from '@kincare/shared';
import { FamilyService } from './family.service';
import { AcceptInviteDto, InviteDelegateDto, UpdateGrantsDto } from './dto';
import { Audit, RequirePermissions } from '../../common/decorators';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthPrincipal } from '@kincare/shared';

@ApiTags('family')
@ApiBearerAuth()
@Controller('family')
export class FamilyController {
  constructor(private readonly family: FamilyService) {}

  @Post('invites')
  @RequirePermissions(Permissions.FAMILY_INVITE)
  @Audit({ action: 'GRANT_PERMISSION', resourceType: 'FamilyInvite' })
  invite(@CurrentUser() user: AuthPrincipal, @Body() dto: InviteDelegateDto) {
    return this.family.invite(user.userId, dto);
  }

  @Get('invites')
  @RequirePermissions(Permissions.FAMILY_MANAGE)
  listInvites(@CurrentUser() user: AuthPrincipal) {
    return this.family.listInvitesFor(user.userId);
  }

  @Post('invites/accept')
  @Audit({ action: 'CONSENT_GIVEN', resourceType: 'FamilyInvite' })
  accept(@CurrentUser() user: AuthPrincipal, @Body() dto: AcceptInviteDto) {
    return this.family.acceptInvite(user.userId, sha256Hex(dto.token));
  }

  @Get('delegates')
  @RequirePermissions(Permissions.FAMILY_MANAGE)
  delegates(@CurrentUser() user: AuthPrincipal) {
    return this.family.listDelegatesOf(user.userId);
  }

  @Get('accessible')
  accessible(@CurrentUser() user: AuthPrincipal) {
    return this.family.listAccessibleOf(user.userId);
  }

  @Patch('relationships/:id/grants')
  @RequirePermissions(Permissions.FAMILY_MANAGE)
  @Audit({ action: 'GRANT_PERMISSION', resourceType: 'FamilyRelationship', resourceIdParam: 'id' })
  updateGrants(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateGrantsDto,
  ) {
    return this.family.updateGrants(user.userId, id, dto);
  }

  @Delete('relationships/:id')
  @HttpCode(204)
  @RequirePermissions(Permissions.FAMILY_MANAGE)
  @Audit({ action: 'REVOKE_PERMISSION', resourceType: 'FamilyRelationship', resourceIdParam: 'id' })
  revoke(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.family.revoke(user.userId, id);
  }
}
