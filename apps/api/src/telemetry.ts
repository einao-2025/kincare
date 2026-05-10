/**
 * OpenTelemetry bootstrap — must be required as the very first thing in
 * `main.ts` so auto-instrumentations can patch http/pg/redis/etc. before
 * Nest constructs its module graph.
 *
 * Configure via env:
 *   OTEL_EXPORTER_OTLP_ENDPOINT   default http://localhost:4318
 *   OTEL_SERVICE_NAME             default kincare-api
 *   OTEL_SERVICE_NAMESPACE        default kincare
 *   OTEL_TRACES_SAMPLER_ARG       0..1   (default 0.1)
 *   OTEL_DISABLED                 set to "true" to skip startup
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_SERVICE_NAMESPACE,
} from '@opentelemetry/semantic-conventions';

// `deployment.environment` is still under the incubating spec; inline the
// attribute key to avoid pulling the unstable subpath which requires
// node16/bundler module resolution.
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';

let sdk: NodeSDK | undefined;

export function startTelemetry(): void {
  if (process.env.OTEL_DISABLED === 'true') return;

  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ?? 'http://localhost:4318';

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'kincare-api',
      [ATTR_SERVICE_NAMESPACE]: process.env.OTEL_SERVICE_NAMESPACE ?? 'kincare',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
      [ATTR_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Skip noisy fs / dns spans; Postgres + Redis + HTTP carry the value.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) =>
            req.url === '/health' || req.url === '/metrics',
          headersToSpanAttributes: {
            client: { requestHeaders: ['x-request-id'] },
            server: { requestHeaders: ['x-request-id'] },
          },
        },
      }),
    ],
  });

  sdk.start();

  // Best-effort flush on shutdown.
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      sdk?.shutdown().catch(() => undefined).finally(() => process.exit(0));
    });
  }
}
