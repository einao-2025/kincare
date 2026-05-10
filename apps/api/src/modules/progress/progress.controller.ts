import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions, Roles as R } from '@kincare/shared';
import { Audit, RequirePermissions, Roles } from '../../common/decorators';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthPrincipal } from '@kincare/shared';
import { ProgressService } from './progress.service';
import { CreateProgressUpdateDto } from './dto';
import { PatientsService } from '../patients/patients.service';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('progress')
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly patients: PatientsService,
  ) {}

  @Post()
  @Roles(R.DOCTOR, R.NURSE, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.NOTIF_SEND)
  @Audit({ action: 'STATUS_UPDATE', resourceType: 'ProgressUpdate' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateProgressUpdateDto) {
    return this.progress.create(actor.userId, dto);
  }

  @Get('patient/:id')
  async list(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'RECEIVE_PROGRESS_UPDATES');
    return this.progress.list(patientId);
  }
}
