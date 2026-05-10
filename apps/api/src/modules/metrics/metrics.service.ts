import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

/**
 * Prometheus registry and curated business metrics. Default Node + GC + ELU
 * metrics are auto-registered. Domain counters and a request histogram are
 * exposed for use by interceptors and services.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestDuration = new Histogram({
    name: 'kincare_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly hl7MessagesReceived = new Counter({
    name: 'kincare_hl7_messages_total',
    help: 'HL7 v2 messages received via MLLP/HTTP',
    labelNames: ['type', 'outcome'] as const,
    registers: [this.registry],
  });

  readonly authEvents = new Counter({
    name: 'kincare_auth_events_total',
    help: 'Authentication-related events',
    labelNames: ['kind'] as const, // login, login_failed, refresh, logout, mfa_challenge
    registers: [this.registry],
  });

  readonly auditAlerts = new Counter({
    name: 'kincare_audit_alerts_total',
    help: 'Audit security alerts emitted',
    labelNames: ['type', 'severity'] as const,
    registers: [this.registry],
  });

  readonly notificationsSent = new Counter({
    name: 'kincare_notifications_sent_total',
    help: 'Notifications dispatched by channel',
    labelNames: ['channel', 'outcome'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'kincare_' });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  snapshot(): Promise<string> {
    return this.registry.metrics();
  }
}
