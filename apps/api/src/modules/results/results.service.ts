import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TestResultStatus } from '@kincare/db';
import { sha256Hex } from '@kincare/shared';
import { PrismaService } from '../../common/prisma/prisma.module';
import { S3Service } from '../../common/storage/s3.service';
import type { CreateDiagnosticReportDto, CreateTestResultDto } from './dto';

const ALLOWED_ATTACHMENT_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  // ── Diagnostic Reports ─────────────────────────────────────

  async createReport(authorPractitionerUserId: string | null, dto: CreateDiagnosticReportDto) {
    const author = authorPractitionerUserId
      ? await this.prisma.practitioner.findUnique({ where: { userId: authorPractitionerUserId } })
      : null;
    return this.prisma.diagnosticReport.create({
      data: {
        patientId: dto.patientId,
        authorId: author?.id,
        code: dto.code,
        display: dto.display,
        category: dto.category,
        conclusion: dto.conclusion,
        status: dto.status ?? TestResultStatus.PRELIMINARY,
      },
    });
  }

  listReports(patientId: string) {
    return this.prisma.diagnosticReport.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { issuedAt: 'desc' },
      include: { testResults: true, attachments: true },
    });
  }

  async getReport(reportId: string) {
    const r = await this.prisma.diagnosticReport.findUnique({
      where: { id: reportId },
      include: { testResults: true, attachments: true, patient: { include: { user: true } } },
    });
    if (!r) throw new NotFoundException('Report not found');
    return r;
  }

  // ── Individual lab results ─────────────────────────────────

  createTestResult(dto: CreateTestResultDto) {
    return this.prisma.testResult.create({
      data: {
        patientId: dto.patientId,
        reportId: dto.reportId,
        testName: dto.testName,
        testCode: dto.testCode,
        resultValue: dto.resultValue,
        unit: dto.unit,
        referenceRange: dto.referenceRange,
        flag: dto.flag,
        performedAt: new Date(dto.performedAt),
        notes: dto.notes,
        status: TestResultStatus.FINAL,
      },
    });
  }

  listForPatient(patientId: string) {
    return this.prisma.testResult.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { performedAt: 'desc' },
    });
  }

  // ── Attachments ────────────────────────────────────────────

  async attachFiles(reportId: string, files: Express.Multer.File[]) {
    const report = await this.prisma.diagnosticReport.findUnique({
      where: { id: reportId }, select: { id: true, deletedAt: true },
    });
    if (!report || report.deletedAt) throw new NotFoundException('Report not found');

    const bucket = this.s3.reportsBucket;
    const records = [] as Awaited<ReturnType<PrismaService['reportAttachment']['create']>>[];

    for (const file of files) {
      const contentType = file.mimetype || 'application/octet-stream';
      if (!ALLOWED_ATTACHMENT_TYPES.has(contentType)) {
        throw new BadRequestException(`Unsupported file type: ${contentType}`);
      }
      const safeName = file.originalname.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 200);
      const key = `reports/${reportId}/uploads/${Date.now()}-${randomUUID()}-${safeName}`;
      await this.s3.putObject({ bucket, key, body: file.buffer, contentType });

      const row = await this.prisma.reportAttachment.create({
        data: {
          reportId,
          fileName: file.originalname,
          contentType,
          bytes: file.size,
          s3Bucket: bucket,
          s3Key: key,
          sha256: sha256Hex(file.buffer),
        },
      });
      records.push(row);
    }
    return records;
  }
}
