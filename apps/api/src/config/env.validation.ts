import { z } from 'zod';

export const configValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  PUBLIC_API_URL: z.string().url(),
  PUBLIC_WEB_URL: z.string(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_QUEUE_PREFIX: z.string().default('kincare'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(2_592_000),
  MFA_ISSUER: z.string().default('Kincare'),
  PASSWORD_PEPPER: z.string().min(16),
  /** Default initial password applied to admin-provisioned patient accounts when one is not provided. */
  PATIENT_DEFAULT_PASSWORD: z.string().min(12).default('ChangeMe!1234'),

  PHI_ENCRYPTION_KEY: z.string().min(40).optional(),
  PHI_KEYS: z.string().optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET_REPORTS: z.string().default('kincare-reports'),
  S3_BUCKET_DICOM: z.string().default('kincare-dicom'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  S3_SIGNED_URL_TTL: z.coerce.number().default(300),

  ORTHANC_URL: z.string().url().optional(),
  ORTHANC_USERNAME: z.string().optional(),
  ORTHANC_PASSWORD: z.string().optional(),

  COOKIE_DOMAIN: z.string().default('localhost'),
  CSRF_SECRET: z.string().min(16),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(10),
  LOGIN_RATE_LIMIT_MAX_EMAIL: z.coerce.number().default(5),
  LOGIN_RATE_LIMIT_WINDOW_S: z.coerce.number().default(300),

  ALERT_FAILED_LOGIN_THRESHOLD: z.coerce.number().default(10),
  ALERT_FAILED_LOGIN_WINDOW_MIN: z.coerce.number().default(5),
  ALERT_BULK_EXPORT_THRESHOLD: z.coerce.number().default(50),
  ALERT_OFF_HOURS_START: z.coerce.number().default(22),
  ALERT_OFF_HOURS_END: z.coerce.number().default(6),

  RETENTION_JOBS_ENABLED: z.coerce.boolean().default(true),
  RETENTION_SOFT_DELETE_DAYS: z.coerce.number().default(90),
  RETENTION_INACTIVE_DAYS: z.coerce.number().default(2555),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMS_PROVIDER: z.enum(['twilio', 'termii', 'stub']).default('stub'),
  SMS_API_KEY: z.string().optional(),
  SMS_FROM: z.string().optional(),

  HL7_MLLP_PORT: z.coerce.number().default(2575),
  HL7_MLLP_ENABLED: z.coerce.boolean().default(false),

  // Observability (Phase 4)
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAMESPACE: z.string().default('kincare'),
  OTEL_DISABLED: z.coerce.boolean().default(false),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  LOKI_URL: z.string().url().optional(),
  LOKI_BASIC_AUTH: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Phase 5 — scale
  DATABASE_REPLICA_URL: z.string().url().optional(),
  DIRECT_DATABASE_URL: z.string().url().optional(),
  DEFAULT_TENANT_ID: z.string().default('default'),
  HL7_FLOW_ASYNC: z.coerce.boolean().default(false),
  SMART_ACCESS_TTL_SECONDS: z.coerce.number().default(3600),
  SMART_REGISTRATION_TOKEN: z.string().optional(),
}).passthrough().refine(
  (env) => Boolean(env.PHI_ENCRYPTION_KEY || env.PHI_KEYS),
  { message: 'Either PHI_KEYS or PHI_ENCRYPTION_KEY must be set' },
);

export type AppEnv = z.infer<typeof configValidationSchema>;
