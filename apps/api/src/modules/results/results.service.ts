import { Injectable, NotFoundException } from '@nestjs/common';
import { TestResultStatus } from '@kincare/db';
import { PrismaService } from '../../common/prisma/prisma.module';
import type { CreateDiagnosticReportDto, CreateTestResultDto } from './dto';

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
