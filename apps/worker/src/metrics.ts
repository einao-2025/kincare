import { createServer } from 'node:http';
import type { Logger } from 'pino';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'kincare_worker_' });

export const jobsProcessed = new Counter({
  name: 'kincare_worker_jobs_total',
  help: 'BullMQ jobs processed',
  labelNames: ['queue', 'outcome'] as const,
  registers: [registry],
});

export const jobDuration = new Histogram({
  name: 'kincare_worker_job_duration_seconds',
  help: 'BullMQ job duration in seconds',
  labelNames: ['queue'] as const,
  buckets: [0.05, 0.25, 1, 2.5, 5, 15, 30, 60, 180],
  registers: [registry],
});

/**
 * Starts a tiny HTTP server exposing /metrics for Prometheus scrape and
 * /health for liveness probes. Defaults to port 9100 (worker) — override
 * with METRICS_PORT.
 */
export function startMetricsServer(logger: Logger): void {
  if (process.env.METRICS_ENABLED === 'false') return;
  const port = Number(process.env.METRICS_PORT ?? 9100);

  const server = createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': registry.contentType });
      res.end(await registry.metrics());
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => logger.info({ port }, 'metrics server listening'));
}
