import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions, Roles as R } from '@kincare/shared';
import { PrescriptionsService } from './prescriptions.service';
import {
  ApproveRefillDto, AuthorizePickupDto, ConfirmPickupDto,
  CreatePrescriptionDto, CreateRefillRequestDto, DenyRefillDto, DispenseDto,
} from './dto';
import { Audit, RequirePermissions, Roles } from '../../common/decorators';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthPrincipal } from '@kincare/shared';
import { PatientsService } from '../patients/patients.service';

@ApiTags('prescriptions')
@ApiBearerAuth()
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(
    private readonly rx: PrescriptionsService,
    private readonly patients: PatientsService,
  ) {}

  @Post()
  @Roles(R.DOCTOR, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.RX_PRESCRIBE)
  @Audit({ action: 'PRESCRIBE', resourceType: 'Prescription' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreatePrescriptionDto) {
    return this.rx.create(actor, dto);
  }

  @Get('patient/:id')
  async listForPatient(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_PRESCRIPTIONS');
    return this.rx.listForPatient(patientId);
  }

  @Post('refills')
  @Audit({ action: 'REFILL_REQUEST', resourceType: 'PrescriptionRefillRequest' })
  refill(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateRefillRequestDto) {
    return this.rx.createRefillRequest(actor, dto);
  }

  @Get('refills/pending')
  @Roles(R.DOCTOR, R.PHARMACIST, R.HOSPITAL_ADMIN, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.RX_REFILL_APPROVE)
  pending() { return this.rx.pendingApprovals(); }

  @Post('refills/approve')
  @Roles(R.DOCTOR, R.PHARMACIST, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.RX_REFILL_APPROVE)
  @Audit({ action: 'UPDATE', resourceType: 'PrescriptionRefillRequest' })
  approve(@CurrentUser() actor: AuthPrincipal, @Body() dto: ApproveRefillDto) {
    return this.rx.approveRefill(actor, dto);
  }

  @Post('refills/deny')
  @Roles(R.DOCTOR, R.PHARMACIST, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.RX_REFILL_APPROVE)
  @Audit({ action: 'UPDATE', resourceType: 'PrescriptionRefillRequest' })
  deny(@CurrentUser() actor: AuthPrincipal, @Body() dto: DenyRefillDto) {
    return this.rx.denyRefill(actor, dto);
  }

  @Post('refills/authorize-pickup')
  @RequirePermissions(Permissions.RX_AUTHORIZE_PICKUP)
  @Audit({ action: 'GRANT_PERMISSION', resourceType: 'PrescriptionRefillRequest' })
  authorize(@CurrentUser() actor: AuthPrincipal, @Body() dto: AuthorizePickupDto) {
    return this.rx.authorizePickup(actor, dto);
  }

  @Post('refills/dispense')
  @Roles(R.PHARMACIST, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.RX_DISPENSE)
  @Audit({ action: 'DISPENSE', resourceType: 'MedicationDispense' })
  dispense(@CurrentUser() actor: AuthPrincipal, @Body() dto: DispenseDto) {
    return this.rx.dispense(actor, dto);
  }

  @Post('refills/confirm-pickup')
  @Roles(R.PHARMACIST, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.RX_DISPENSE)
  @Audit({ action: 'DISPENSE', resourceType: 'MedicationDispense' })
  confirm(@CurrentUser() actor: AuthPrincipal, @Body() dto: ConfirmPickupDto) {
    return this.rx.confirmPickup(actor, dto);
  }
}
