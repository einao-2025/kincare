import { Worker } from 'bullmq';
import type IORedis from 'ioredis';
import type { Logger } from 'pino';
import {
  parseHL7, transformAdt, transformOru, transformOrm, transformSiu,
  type HL7Message,
} from '@kincare/hl7';
import { prisma, Gender, EncounterClass, EncounterStatus, TestResultStatus, NotificationStatus } from '@kincare/db';
import { jobDuration, jobsProcessed } from '../metrics';

interface Opts { connection: IORedis; prefix: string; logger: Logger; }

/**
 * Worker for the `hl7-pipeline` BullMQ flow. Two job names are handled:
 *
 *   - `hl7.ingest`        parse, persist raw + domain side-effects.
 *                         Returns `{ patientUserId, summary }` consumed by
 *                         the parent's child collector for the notify step.
 *   - `hl7.notify-family` send a "new clinical activity" in-app to the
 *                         patient's family delegates.
 *
 * The parent → child relationship is established by the API's FlowsProducer.
 */
export function startHl7PipelineWorker({ connection, prefix, logger }: Opts) {
  const worker = new Worker(
    'hl7-pipeline',
    async (job) => {
      if (job.name === 'hl7.ingest') {
        const { raw } = job.data as { raw: string };
        const result = await runIngest(raw, logger);
        // Make the result available to children via getChildrenValues().
        return result;
      }
      if (job.name === 'hl7.notify-family') {
        const children = await job.getChildrenValues();
        const ingestResult = Object.values(children)[0] as
          | { patientUserId?: string; summary?: string } | undefined;
        if (!ingestResult?.patientUserId) {
          logger.info('hl7.notify-family: skipped (no patient resolved)');
          return { skipped: true };
        }
        await notifyFamily(ingestResult.patientUserId, ingestResult.summary ?? 'New clinical update');
        return { ok: true };
      }
      throw new Error(`Unknown job name: ${job.name}`);
    },
    { connection, prefix, concurrency: 4 },
  );

  worker.on('failed', (j, err) => {
    jobsProcessed.labels('hl7-pipeline', 'failed').inc();
    logger.error({ jobName: j?.name, jobId: j?.id, err: err.message }, 'hl7 pipeline failed');
  });
  worker.on('completed', (j) => {
    jobsProcessed.labels('hl7-pipeline', 'completed').inc();
    if (j.processedOn && j.finishedOn) {
      jobDuration.labels('hl7-pipeline').observe((j.finishedOn - j.processedOn) / 1000);
    }
  });

  return worker;
}

async function runIngest(raw: string, logger: Logger) {
  let msg: HL7Message;
  try {
    msg = parseHL7(raw);
  } catch (e) {
    throw new Error(`HL7 parse failure: ${(e as Error).message}`);
  }

  const row = await prisma.hL7Message.create({
    data: {
      messageType: msg.messageType,
      controlId: msg.controlId,
      sendingApp: msg.sendingApp,
      sendingFacility: msg.sendingFacility,
      rawMessage: raw,
    },
  });

  let patientUserId: string | undefined;
  let summary = '';
  try {
    if (msg.messageType.startsWith('ADT^')) {
      const data = transformAdt(msg);
      const profile = await prisma.patientProfile.upsert({
        where: { tenantId_mrn: { tenantId: process.env.DEFAULT_TENANT_ID ?? 'default', mrn: data.patient.mrn } },
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
              firstName: data.patient.firstName || 'Unknown',
              lastName: data.patient.lastName || 'Unknown',
              passwordHash: 'scrypt$inactive$$$',
              role: 'PATIENT',
              status: 'PENDING_VERIFICATION',
            },
          },
        },
        include: { user: true },
      });
      patientUserId = profile.userId;
      if (data.encounter) {
        await prisma.encounter.create({
          data: {
            patientId: profile.id,
            class: data.encounter.class as EncounterClass,
            status: data.encounter.status as EncounterStatus,
            location: data.encounter.location,
            startAt: data.encounter.startAt ? new Date(data.encounter.startAt) : new Date(),
          },
        });
        summary = `Admission/encounter recorded (${data.encounter.status})`;
      } else {
        summary = 'Patient demographics updated';
      }
    } else if (msg.messageType.startsWith('ORU^')) {
      const data = transformOru(msg);
      const profile = await prisma.patientProfile.findUnique({ where: { tenantId_mrn: { tenantId: process.env.DEFAULT_TENANT_ID ?? 'default', mrn: data.patient.mrn } } });
      if (!profile) throw new Error(`Unknown patient MRN: ${data.patient.mrn}`);
      patientUserId = profile.userId;
      const report = await prisma.diagnosticReport.create({
        data: {
          patientId: profile.id,
          code: data.report.code ?? 'UNKNOWN',
          display: data.report.display ?? 'Imported lab result',
          status: TestResultStatus.FINAL,
          conclusion: data.report.conclusion,
          issuedAt: data.report.issuedAt ? new Date(data.report.issuedAt) : new Date(),
        },
      });
      summary = `New diagnostic report: ${report.display}`;
    } else if (msg.messageType.startsWith('ORM^')) {
      const data = transformOrm(msg);
      const profile = await prisma.patientProfile.findUnique({ where: { tenantId_mrn: { tenantId: process.env.DEFAULT_TENANT_ID ?? 'default', mrn: data.patient.mrn } } });
      if (!profile) throw new Error(`Unknown patient MRN: ${data.patient.mrn}`);
      patientUserId = profile.userId;
      summary = data.medication ? 'New prescription order' : 'New diagnostic order';
    } else if (msg.messageType.startsWith('SIU^')) {
      transformSiu(msg);
      summary = 'Appointment scheduled';
    }

    await prisma.hL7Message.update({
      where: { id: row.id },
      data: { processed: true, processedAt: new Date() },
    });
  } catch (e) {
    await prisma.hL7Message.update({
      where: { id: row.id },
      data: { processed: false, errorMessage: (e as Error).message, processedAt: new Date() },
    });
    throw e;
  }

  logger.info({ controlId: msg.controlId, type: msg.messageType }, 'hl7 ingested');
  return { patientUserId, summary, messageType: msg.messageType };
}

async function notifyFamily(patientUserId: string, body: string) {
  const grants = await prisma.permissionGrant.findMany({
    where: {
      scope: 'RECEIVE_PROGRESS_UPDATES',
      revokedAt: null,
      relationship: { patientUserId, revokedAt: null },
    },
    select: { granteeUserId: true },
    distinct: ['granteeUserId'],
  });
  if (grants.length === 0) return;
  await prisma.$transaction(
    grants.map((g) => prisma.notification.create({
      data: {
        userId: g.granteeUserId,
        channel: 'IN_APP',
        subject: 'New clinical update',
        body,
        status: NotificationStatus.QUEUED,
      },
    })),
  );
}
