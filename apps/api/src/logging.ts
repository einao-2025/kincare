/**
 * Builds the Pino `transport` option for both the API (via nestjs-pino) and
 * the worker (via plain pino). The shape is:
 *
 *  - dev:                     pino-pretty single-line to stdout
 *  - prod, no LOKI_URL:       undefined → default JSON to stdout (Promtail/Vector ships)
 *  - prod, LOKI_URL set:      multi-target → JSON stdout AND batched push to Loki
 *
 * Pushing directly from the app keeps logs flowing even when Promtail isn't
 * installed; stdout JSON remains as a belt-and-braces backup.
 */
export interface PinoTransportOptions {
  service: string;            // e.g. 'kincare-api'
  env?: string;               // NODE_ENV
  lokiUrl?: string;           // LOKI_URL
  lokiBasicAuth?: string;     // 'user:pass'
  extraLabels?: Record<string, string>;
}

export function buildPinoTransport(opts: PinoTransportOptions) {
  const env = opts.env ?? process.env.NODE_ENV ?? 'development';

  if (env === 'development') {
    return { target: 'pino-pretty', options: { singleLine: true } };
  }

  if (!opts.lokiUrl) return undefined;

  const labels = {
    service: opts.service,
    env,
    namespace: process.env.OTEL_SERVICE_NAMESPACE ?? 'kincare',
    ...opts.extraLabels,
  };

  return {
    targets: [
      { target: 'pino/file', level: 'info', options: { destination: 1 } }, // stdout
      {
        target: 'pino-loki',
        level: 'info',
        options: {
          host: opts.lokiUrl,
          basicAuth: opts.lokiBasicAuth
            ? {
                username: opts.lokiBasicAuth.split(':')[0],
                password: opts.lokiBasicAuth.split(':').slice(1).join(':'),
              }
            : undefined,
          batching: true,
          interval: 5,
          labels,
          replaceTimestamp: true,
        },
      },
    ],
  };
}
