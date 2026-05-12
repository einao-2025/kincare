import { BadRequestException, Body, Controller, Get, Param, Post, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Permissions, Roles as R } from '@kincare/shared';
import type { Response } from 'express';
import { ResultsService } from './results.service';
import { PatientsService } from '../patients/patients.service';
import { CreateDiagnosticReportDto, CreateTestResultDto } from './dto';
import { Audit, RequirePermissions, Roles } from '../../common/decorators';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthPrincipal } from '@kincare/shared';

@ApiTags('results')
@ApiBearerAuth()
@Controller('results')
export class ResultsController {
  constructor(
    private readonly results: ResultsService,
    private readonly patients: PatientsService,
  ) {}

  @Post('reports')
  @Roles(R.DOCTOR, R.LAB_TECHNICIAN, R.RADIOLOGIST, R.HOSPITAL_ADMIN, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.RESULTS_UPLOAD)
  @Audit({ action: 'CREATE', resourceType: 'DiagnosticReport' })
  createReport(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateDiagnosticReportDto) {
    return this.results.createReport(actor.userId, dto);
  }

  @Get('reports/patient/:id')
  async listReports(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_TEST_RESULTS');
    return this.results.listReports(patientId);
  }

  @Get('reports/:reportId')
  @Audit({ action: 'READ', resourceType: 'DiagnosticReport', resourceIdParam: 'reportId' })
  getReport(@Param('reportId') reportId: string) {
    return this.results.getReport(reportId);
  }

  @Get('reports/:reportId/pdf')
  @Audit({ action: 'DOWNLOAD', resourceType: 'DiagnosticReport', resourceIdParam: 'reportId' })
  async downloadPdf(@Param('reportId') reportId: string, @Res() res: Response) {
    // PDF generation is queued through the worker; here we return a placeholder
    // signed URL response. (Implemented in apps/worker — see PDF queue.)
    const r = await this.results.getReport(reportId);
    res.status(202).json({
      message: 'PDF generation queued',
      reportId: r.id,
      pollUrl: `/api/v1/results/reports/${r.id}/pdf-status`,
    });
  }

  @Post('lab')
  @Roles(R.LAB_TECHNICIAN, R.DOCTOR, R.HOSPITAL_ADMIN, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.RESULTS_UPLOAD)
  @Audit({ action: 'CREATE', resourceType: 'TestResult' })
  createTestResult(@Body() dto: CreateTestResultDto) {
    return this.results.createTestResult(dto);
  }

  @Get('patient/:id')
  async listForPatient(@Param('id') id: string, @CurrentUser() actor: AuthPrincipal) {
    const patientId = await this.patients.resolvePatientId(id, actor, 'VIEW_TEST_RESULTS');
    return this.results.listForPatient(patientId);
  }

  /**
   * Attach one or more files (images or documents) to an existing diagnostic
   * report. The actor must hold {@link Permissions.RESULTS_UPLOAD}; the file
   * bytes are streamed to S3 and a `ReportAttachment` row is persisted per file.
   */
  @Post('reports/:reportId/attachments')
  @Roles(R.DOCTOR, R.LAB_TECHNICIAN, R.RADIOLOGIST, R.HOSPITAL_ADMIN, R.SUPER_ADMIN)
  @RequirePermissions(Permissions.RESULTS_UPLOAD)
  @UseInterceptors(FilesInterceptor('files', 10, {
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MiB per file
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } },
    },
  })
  @Audit({ action: 'UPLOAD', resourceType: 'ReportAttachment', resourceIdParam: 'reportId' })
  async uploadAttachments(
    @Param('reportId') reportId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');
    return this.results.attachFiles(reportId, files);
  }
}
