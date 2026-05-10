import { Injectable, Logger } from '@nestjs/common';
import {
  parseHL7, transformAdt, transformOru, transformOrm, transformSiu,
  type HL7Message,
} from '@kincare/hl7';
import { Gender, EncounterClass, EncounterStatus, TestResultStatus } from '@kincare/db';
import { generateMRN } from '@kincare/shared';
import { PrismaService } from '../../common/prisma/prisma.module';

export interface IngestOutcome {
  controlId: string;
  messageType: string;
  processed: boolean;
  error?: string;
  effects: string[];     // human-readable list of side effects (for ACK text)
}

@Injectable()
export class HL7Ingestor {
  private readonly logger = new Logger(HL7Ingestor.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Top-level ingest: parses, persists raw message, then dispatches to a
   * trigger-specific handler. Always returns an `IngestOutcome` so the
   * caller (HTTP or MLLP) can build an ACK or audit record.
   */
  async ingest(raw: string): Promise<IngestOutcome> {
    let msg: HL7Message;
    try {
      msg = parseHL7(raw);
    } catch (e) {
      this.logger.error(`Parse failure: ${(e as Error).message}`);
      return { controlId: '', messageType: '', processed: false, error: (e as Error).message, effects: [] };
    }

    const baseRow = await this.prisma.hL7Message.create({
      data: {
        messageType: msg.messageType,
        controlId: msg.controlId,
        sendingApp: msg.sendingApp,
        sendingFacility: msg.sendingFacility,
        rawMessage: raw,
      },
    });

    const effects: string[] = [];
    let error: string | undefined;
    let parsedJson: unknown = null;

    try {
      if (msg.messageType.startsWith('ADT^')) {
        parsedJson = await this.handleAdt(msg, effects);
      } else if (msg.messageType.startsWith('ORU^')) {
        parsedJson = await this.handleOru(msg, effects);
      } else if (msg.messageType.startsWith('ORM^')) {
        parsedJson = await this.handleOrm(msg, effects);
      } else if (msg.messageType.startsWith('SIU^')) {
        parsedJson = transformSiu(msg);   // appointments — store parsed only (Phase 3 wiring)
        effects.push('SIU parsed (no encounter side-effect)');
      } else {
        error = `Unsupported message type: ${msg.messageType}`;
      }
    } catch (e) {
      error = (e as Error).message;
      this.logger.error(`Ingest failure for ${msg.messageType}: ${error}`);
    }

    await this.prisma.hL7Message.update({
      where: { id: baseRow.id },
      data: {
        parsedJson: parsedJson as never,
        processed: !error,
        processedAt: new Date(),
        errorMessage: error,
      },
    });

    return {
      controlId: msg.controlId,
      messageType: msg.messageType,
      processed: !error,
      error,
      effects,
    };
  }

  // ── Handlers ────────────────────────────────────────────

  private async handleAdt(msg: HL7Message, effects: string[]) {
    const data = transformAdt(msg);
    if (!data.patient.mrn) throw new Error('ADT missing patient MRN');

    // Upsert patient by MRN. We don't create a User account from HL7;
    // staff invites the patient separately. We store a placeholder user
    // when the patient is created via HL7 to keep relations valid.
    const tenantId = 'default';
    const profile = await this.prisma.patientProfile.upsert({
      where: { tenantId_mrn: { tenantId, mrn: data.patient.mrn } },
      update: {
        dateOfBirth: data.patient.dateOfBirth ? new Date(data.patient.dateOfBirth) : undefined,
        gender: (data.patient.gender as Gender) ?? undefined,
      },
      create: {
        mrn: data.patient.mrn,
        dateOfBirth: data.patient.dateOfBirth ? new Date(data.patient.dateOfBirth) : new Date('1900-01-01'),
        gender: (data.patient.gender as Gender) ?? Gender.UNKNOWN,
        user: {
          create: {
            email: `hl7+${data.patient.mrn.toLowerCase()}@kincare.health`,
            phone: data.patient.phone ?? undefined,
            firstName: data.patient.firstName || 'Unknown',
            lastName: data.patient.lastName || 'Unknown',
            passwordHash: 'scrypt$inactive$$$',  // not loginable; staff invites later
            role: 'PATIENT',
            status: 'PENDING_VERIFICATION',
          },
        },
      },
    });
    effects.push(`patient upserted (${profile.mrn})`);

    if (data.encounter) {
      await this.prisma.encounter.create({
        data: {
          patientId: profile.id,
          class: data.encounter.class as EncounterClass,
          status: data.encounter.status as EncounterStatus,
          location: data.encounter.location,
          startAt: data.encounter.startAt ? new Date(data.encounter.startAt) : new Date(),
        },
      });
      effects.push(`encounter created (${data.encounter.status})`);
    }
    // A03 = discharge — close most recent in-progress encounter
    if (data.trigger === 'A03') {
      const open = await this.prisma.encounter.findFirst({
        where: { patientId: profile.id, status: { in: [EncounterStatus.ARRIVED, EncounterStatus.IN_PROGRESS] } },
        orderBy: { startAt: 'desc' },
      });
      if (open) {
        await this.prisma.encounter.update({
          where: { id: open.id },
          data: { status: EncounterStatus.FINISHED, endAt: new Date() },
        });
        effects.push('discharged most recent open encounter');
      }
    }
    return data;
  }

  private async handleOru(msg: HL7Message, effects: string[]) {
    const data = transformOru(msg);
    const profile = await this.prisma.patientProfile.findUnique({ where: { tenantId_mrn: { tenantId: 'default', mrn: data.patient.mrn } } });
    if (!profile) throw new Error(`Unknown patient MRN: ${data.patient.mrn}`);

    const report = await this.prisma.diagnosticReport.create({
      data: {
        patientId: profile.id,
        code: data.report.code ?? 'UNKNOWN',
        display: data.report.display ?? 'Imported lab result',
        status: TestResultStatus.FINAL,
        conclusion: data.report.conclusion,
        issuedAt: data.report.issuedAt ? new Date(data.report.issuedAt) : new Date(),
      },
    });
    effects.push(`diagnostic report created (${report.id})`);

    for (const obs of data.observations) {
      // Persist as a TestResult row; numeric values also feed into Observation.
      await this.prisma.testResult.create({
        data: {
          patientId: profile.id,
          reportId: report.id,
          testName: obs.display,
          testCode: obs.loinc,
          resultValue: obs.value,
          unit: obs.unit,
          referenceRange: obs.referenceRange,
          flag: obs.abnormalFlag,
          performedAt: obs.observedAt ? new Date(obs.observedAt) : new Date(),
        },
      });
      const numeric = obs.valueType === 'NM' ? Number(obs.value) : NaN;
      if (!Number.isNaN(numeric)) {
        await this.prisma.observation.create({
          data: {
            patientId: profile.id,
            code: obs.loinc ?? 'UNKNOWN',
            display: obs.display,
            category: 'laboratory',
            valueNumeric: numeric,
            unit: obs.unit,
            effectiveAt: obs.observedAt ? new Date(obs.observedAt) : new Date(),
          },
        });
      }
    }
    effects.push(`${data.observations.length} observation(s) imported`);
    return data;
  }

  private async handleOrm(msg: HL7Message, effects: string[]) {
    const data = transformOrm(msg);
    const profile = await this.prisma.patientProfile.findUnique({ where: { tenantId_mrn: { tenantId: 'default', mrn: data.patient.mrn } } });
    if (!profile) throw new Error(`Unknown patient MRN: ${data.patient.mrn}`);

    if (data.medication) {
      // Find a default prescriber by ordering provider name (best-effort);
      // fallback to the system's first practitioner.
      const prescriber = (await this.prisma.practitioner.findFirst({})) ?? null;
      if (!prescriber) throw new Error('No practitioner configured to receive HL7 orders');
      await this.prisma.prescription.create({
        data: {
          patientId: profile.id,
          prescriberId: prescriber.id,
          medicationCode: data.medication.code ?? 'UNKNOWN',
          medicationName: data.medication.name ?? 'Imported medication',
          dosage: data.medication.dosage ?? '',
          route: data.medication.route,
          frequency: data.medication.frequency ?? 'as directed',
          quantity: data.medication.quantity ?? 1,
          status: 'ACTIVE',
        },
      });
      effects.push('prescription created from ORM');
    } else if (data.test) {
      await this.prisma.diagnosticReport.create({
        data: {
          patientId: profile.id,
          code: data.test.code ?? 'UNKNOWN',
          display: data.test.display ?? 'Ordered test',
          status: TestResultStatus.REGISTERED,
          issuedAt: data.test.requestedAt ? new Date(data.test.requestedAt) : new Date(),
        },
      });
      effects.push('diagnostic report (registered) created from ORM');
    }
    return data;
  }
}
