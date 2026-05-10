/**
 * OpenTelemetry bootstrap for the BullMQ worker process.
 * Required at the top of `main.ts` before any other imports.
 */
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';

// Inlined from @opentelemetry/semantic-conventions/incubating to avoid
// requiring NodeNext module resolution for a subpath export.
const ATTR_SERVICE_NAME = 'service.name';
const ATTR_SERVICE_NAMESPACE = 'service.namespace';
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';

let sdk: NodeSDK | undefined;

export function startTelemetry(): void {
  if (process.env.OTEL_DISABLED === 'true') return;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ?? 'http://localhost:4318';

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'kincare-worker',
      [ATTR_SERVICE_NAMESPACE]: process.env.OTEL_SERVICE_NAMESPACE ?? 'kincare',
      [ATTR_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      sdk?.shutdown().catch(() => undefined).finally(() => process.exit(0));
    });
  }
}
