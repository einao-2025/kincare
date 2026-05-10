/**
 * Mirror of apps/api/src/logging.ts for the worker process — kept local so
 * the worker has no @kincare/api dependency.
 */
export function buildWorkerTransport() {
  const env = process.env.NODE_ENV ?? 'development';

  if (env === 'development') {
    return { target: 'pino-pretty', options: { singleLine: true } };
  }

  const lokiUrl = process.env.LOKI_URL;
  if (!lokiUrl) return undefined;

  const auth = process.env.LOKI_BASIC_AUTH;
  return {
    targets: [
      { target: 'pino/file', level: 'info', options: { destination: 1 } },
      {
        target: 'pino-loki',
        level: 'info',
        options: {
          host: lokiUrl,
          basicAuth: auth
            ? {
                username: auth.split(':')[0],
                password: auth.split(':').slice(1).join(':'),
              }
            : undefined,
          batching: true,
          interval: 5,
          labels: {
            service: 'kincare-worker',
            env,
            namespace: process.env.OTEL_SERVICE_NAMESPACE ?? 'kincare',
          },
          replaceTimestamp: true,
        },
      },
    ],
  };
}
