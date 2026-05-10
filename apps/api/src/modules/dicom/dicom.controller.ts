import {
  Body, Controller, Get, Param, Post, Req, BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions, Roles as R } from '@kincare/shared';
import type { Request } from 'express';
import { DicomService } from './dicom.service';
import { PatientsService } from '../patients/patients.service';
import { Audit, RequirePermissions, Roles } from '../../common/decorators';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthPrincipal } from '@kincare/shared';

@ApiTags('dicom')
@ApiBearerAuth()
@Controller('dicom')
export class DicomController {
  constructor(
    private readonly dicom: DicomService,
    private readonly patients: PatientsService,
  ) {}

  /**
   * Body must be raw `application/dicom` bytes (single SOP instance).
   * For multi-file uploads, call this endpoint per instance.
   */
  @Post('upload/:patientId')
  @Roles(R.RADIOLOGIST, R.LAB_TECHNICIAN, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.DICOM_UPLOAD)
  @Audit({ action: 'CREATE', resourceType: 'DICOMInstance', patientIdParam: 'patientId' })
  async upload(@Param('patientId') patientId: string, @Req() req: Request) {
    const chunks: Buffer[] = [];
    for await (const c of req as unknown as AsyncIterable<Buffer>) chunks.push(c);
    const body = Buffer.concat(chunks);
    if (body.length === 0) throw new BadRequestException('Empty DICOM payload');
    return this.dicom.uploadInstance(patientId, body);
  }

  @Get('studies/patient/:id')
  async studies(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_IMAGING');
    return this.dicom.listStudies(patientId);
  }

  @Get('studies/:studyId/viewer')
  @Audit({ action: 'READ', resourceType: 'DICOMStudy', resourceIdParam: 'studyId' })
  viewer(@Param('studyId') studyId: string) {
    return this.dicom.getStudyViewerUrls(studyId);
  }
}
