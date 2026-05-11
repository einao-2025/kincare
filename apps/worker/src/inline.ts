/**
 * In-process worker bootstrap.
 *
 * Lets the API process (free tier — single dyno, no separate worker service)
 * run the BullMQ workers in the same Node process. The standalone
 * `apps/worker/src/main.ts` entrypoint is still used for proper deployments.
 *
 * The PDF worker is opt-in here because it depends on puppeteer (~300 MB
 * Chromium download + heavy RAM) which won't fit alongside Nest on a 512 MB
 * Render free instance. It's loaded with require() only when explicitly
 * enabled so importing this module doesn't pull puppeteer into memory.
 */
import IORedis from 'ioredis';
import pino, { type Logger } from 'pino';
import { startHl7PipelineWorker } from './queues/hl7-pipeline.worker';
import { startNotificationsWorker } from './queues/notifications.worker';

export interface InlineWorkerOptions {
  redisUrl?: string;
  prefix?: string;
  logger?: Logger;
  /** Run puppeteer-based PDF worker (default: false — won't fit in 512 MB). */
  enablePdf?: boolean;
  /** Skip HL7 pipeline worker (default: false). */
  skipHl7?: boolean;
}

export interface InlineWorkerHandle {
  shutdown: () => Promise<void>;
}

export function startInlineWorkers(opts: InlineWorkerOptions = {}): InlineWorkerHandle | undefined {
  const redisUrl = opts.redisUrl ?? process.env.REDIS_URL;
  if (!redisUrl) {
    const log = opts.logger ?? pino({ level: process.env.LOG_LEVEL ?? 'info' });
    log.warn('startInlineWorkers: REDIS_URL not set, skipping inline workers');
    return undefined;
  }

  const logger = opts.logger ?? pino({ level: process.env.LOG_LEVEL ?? 'info' });
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const prefix = opts.prefix ?? process.env.REDIS_QUEUE_PREFIX ?? 'kincare';

  const workers: Array<unknown> = [];

  workers.push(startNotificationsWorker({ connection, prefix, logger }));
  if (!opts.skipHl7) {
    workers.push(startHl7PipelineWorker({ connection, prefix, logger }));
  }
  if (opts.enablePdf) {
    // Lazy require so puppeteer isn't pulled in unless explicitly enabled.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { startPdfWorker } = require('./queues/pdf.worker');
    workers.push(startPdfWorker({ connection, prefix, logger }));
  }

  logger.info({ count: workers.length, pdf: !!opts.enablePdf }, 'inline BullMQ workers started');

  return {
    async shutdown() {
      await Promise.allSettled(
        workers
          .filter((w): w is { close: () => Promise<void> } =>
            !!w && typeof (w as any).close === 'function')
          .map((w) => w.close()),
      );
      await connection.quit();
    },
  };
}
