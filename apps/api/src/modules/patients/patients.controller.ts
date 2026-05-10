import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions, Roles as R } from '@kincare/shared';
import { PatientsService } from './patients.service';
import {
  CreateAllergyDto, CreateConditionDto, CreateEmergencyContactDto, UpdatePatientProfileDto,
} from './dto';
import { Audit, RequirePermissions, Roles } from '../../common/decorators';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthPrincipal } from '@kincare/shared';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  @RequirePermissions(Permissions.PATIENT_READ_ANY)
  @Audit({ action: 'SEARCH', resourceType: 'Patient' })
  async search(
    @Query('q') q?: string,
    @Query('take') take?: string,
  ) {
    return this.patients.search(q ?? '', take ? Math.min(Number(take), 50) : 20);
  }

  @Get(':id')
  @Audit({ action: 'READ', resourceType: 'Patient', resourceIdParam: 'id', patientIdParam: 'id' })
  async getProfile(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_DEMOGRAPHICS');
    return this.patients.getProfile(patientId);
  }

  @Patch(':id')
  @Audit({ action: 'UPDATE', resourceType: 'Patient', resourceIdParam: 'id', patientIdParam: 'id' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientProfileDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    const patientId = await this.patients.resolvePatientId(id, actor);
    return this.patients.updateProfile(patientId, dto);
  }

  // ── Emergency contacts ─────────────────────────────────────

  @Get(':id/emergency-contacts')
  async listEC(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_DEMOGRAPHICS');
    return this.patients.listEmergencyContacts(patientId);
  }

  @Post(':id/emergency-contacts')
  async createEC(
    @Param('id') id: string,
    @Body() dto: CreateEmergencyContactDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    const patientId = await this.patients.resolvePatientId(id, actor);
    return this.patients.createEmergencyContact(patientId, dto);
  }

  // ── Medical history ────────────────────────────────────────

  @Get(':id/allergies')
  async allergies(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_MEDICAL_HISTORY');
    return this.patients.listAllergies(patientId);
  }

  @Post(':id/allergies')
  @RequirePermissions(Permissions.HISTORY_WRITE)
  @Audit({ action: 'CREATE', resourceType: 'AllergyIntolerance', patientIdParam: 'id' })
  async createAllergy(
    @Param('id') id: string, @Body() dto: CreateAllergyDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    const patientId = await this.patients.resolvePatientId(id, actor);
    return this.patients.createAllergy(patientId, dto);
  }

  @Get(':id/conditions')
  async conditions(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_MEDICAL_HISTORY');
    return this.patients.listConditions(patientId);
  }

  @Post(':id/conditions')
  @Roles(R.DOCTOR, R.NURSE, R.HOSPITAL_ADMIN, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.HISTORY_WRITE)
  @Audit({ action: 'CREATE', resourceType: 'Condition', patientIdParam: 'id' })
  async createCondition(
    @Param('id') id: string, @Body() dto: CreateConditionDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    const patientId = await this.patients.resolvePatientId(id, actor);
    return this.patients.createCondition(patientId, dto, actor.userId);
  }

  @Get(':id/procedures')
  async procedures(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_MEDICAL_HISTORY');
    return this.patients.listProcedures(patientId);
  }

  @Get(':id/immunizations')
  async immunizations(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_MEDICAL_HISTORY');
    return this.patients.listImmunizations(patientId);
  }

  @Get(':id/encounters')
  async encounters(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_MEDICAL_HISTORY');
    return this.patients.listEncounters(patientId);
  }
}
