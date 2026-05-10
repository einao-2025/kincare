import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators';
import { Permissions } from '@kincare/shared';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(Permissions.AUDIT_READ)
  list(
    @Query('patientId') patientId?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.list({
      patientId,
      actorUserId,
      cursor,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('verify')
  @RequirePermissions(Permissions.AUDIT_READ)
  verify() {
    return this.audit.verifyChain();
  }
}
