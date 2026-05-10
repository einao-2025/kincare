import 'dotenv/config';
import { startTelemetry } from './telemetry';
startTelemetry();

import IORedis from 'ioredis';
import pino from 'pino';
import { startMetricsServer } from './metrics';
import { buildWorkerTransport } from './logging';
import { startHl7PipelineWorker } from './queues/hl7-pipeline.worker';
import { startNotificationsWorker } from './queues/notifications.worker';
import { startPdfWorker } from './queues/pdf.worker';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: buildWorkerTransport() as any,
});

async function main() {
  const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  const prefix = process.env.REDIS_QUEUE_PREFIX ?? 'kincare';

  startNotificationsWorker({ connection, prefix, logger });
  startPdfWorker({ connection, prefix, logger });
  startHl7PipelineWorker({ connection, prefix, logger });

  startMetricsServer(logger);

  logger.info('🛠  Kincare worker started');
}

main().catch((e) => { console.error(e); process.exit(1); });
