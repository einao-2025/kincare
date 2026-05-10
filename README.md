# Kincare

> Production-grade hospital patient portal & healthcare interoperability platform.
> Full-stack TypeScript • NestJS • Next.js • Prisma • Postgres • Redis • Orthanc.

## ⚠️ Status

This repository contains **Phase 1** scaffolding: monorepo, Prisma schema, auth + RBAC, core patient/family/prescriptions/results/DICOM/FHIR/audit modules, BullMQ worker (notifications + PDF), and a minimal Next.js portal.
Phases 2–5 (below) layer on advanced features, hardening, and full UI.

## Monorepo layout

```
kincare/
├── apps/
│   ├── api/         # NestJS REST + FHIR + HL7 ingestion API
│   ├── worker/      # BullMQ consumers (notifications, PDF, DICOM)
│   └── web/         # Next.js 14 patient & staff portal
└── packages/
    ├── shared/         # roles, permissions, crypto, errors, types
    ├── auth/           # JWT + TOTP (RFC 6238) primitives
    ├── db/             # Prisma schema + client
    ├── fhir/           # FHIR R4 types, mappers, validators
    ├── hl7/            # HL7 v2 parser + ADT/ORU transformers
    ├── dicom/          # Orthanc REST client (WADO-RS / WADO-URI)
    └── notifications/  # Email/SMS provider abstraction
```

## Quick start

```powershell
# 1. Install (requires Node ≥ 20 and pnpm 9)
pnpm install

# 2. Boot infra (Postgres, Redis, MinIO, MailHog, Orthanc)
docker compose up -d

# 3. Configure
copy .env.example .env

# 4. Create DB + seed
pnpm db:migrate
pnpm db:seed

# 5. Run everything in dev mode
pnpm dev
#   → API   http://localhost:4000   (Swagger: /api/docs)
#   → Web   http://localhost:3000
#   → Worker on the side
```

Default seeded credentials (change immediately!):

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@kincare.health` | `ChangeMe!2026` |
| Doctor | `doctor@kincare.health` | `ChangeMe!2026` |
| Patient | `patient@kincare.health` | `ChangeMe!2026` |

## Architecture highlights

### Authentication
- JWT access tokens (15 min default) + opaque refresh tokens stored hashed in DB.
- Refresh-token **rotation with reuse detection** — replay revokes the entire session.
- TOTP MFA (RFC 6238) with hashed recovery codes.
- Account lockout after 8 failed logins (15 min cooldown).
- Per-route throttling via `@nestjs/throttler`.

### RBAC + delegate grants
Two layers of authorization:
1. **Role-based** static matrix in [packages/shared/src/permissions.ts](packages/shared/src/permissions.ts).
2. **Runtime grants** — `PermissionGrant` rows give family delegates scoped access (e.g. `VIEW_TEST_RESULTS`, `AUTHORIZE_PICKUP`). Enforced at the service layer via `PatientsService.resolvePatientId(idOrMe, actor, requiredScope)`.

### PHI protection
- Field-level **AES-256-GCM** encryption for address, national ID, MFA secret (see [packages/shared/src/crypto.ts](packages/shared/src/crypto.ts)).
- Encryption key supplied via `PHI_ENCRYPTION_KEY` (base64, 32 bytes).
- Server-side S3 encryption (`AES256`) for PDFs and DICOM payloads.

### Audit log (FHIR `AuditEvent`)
Every annotated route writes a tamper-evident, **hash-chained** `AuditLog` row (`hash = sha256(prevHash || canonicalJSON(payload))`). Verify the chain via `GET /api/v1/audit/verify`.

### FHIR R4
- `GET /fhir/Patient/{id}`, `GET /fhir/Patient?identifier=…&family=…&given=…`
- `GET /fhir/metadata` (CapabilityStatement)
- Internal Prisma models map cleanly to: Patient, Practitioner, Encounter, Observation, DiagnosticReport, Condition, Procedure, AllergyIntolerance, MedicationRequest (`Prescription`), MedicationDispense, CareTeam, Consent, AuditEvent.

### HL7 v2 ingestion
- HTTPS endpoint: `POST /api/v1/hl7/ingest`.
- Parser handles MSH delimiters, segments, repetitions; ADT transformer mapped to internal Patient + Encounter shape.
- Optional MLLP TCP listener (port 2575) — flag `HL7_MLLP_ENABLED=true` (Phase 2).

### DICOM
- `POST /api/v1/dicom/upload/{patientId}` accepts raw `application/dicom` bytes; relays to Orthanc and indexes Study/Series/Instance.
- `GET /api/v1/dicom/studies/{studyId}/viewer` returns WADO-RS root + per-instance preview URLs for **CornerstoneJS** front-end viewer (Phase 2).

### Background jobs
- **`notifications` queue** → email/SMS/in-app dispatch (provider-agnostic).
- **`pdf` queue** → Puppeteer-rendered diagnostic report PDFs uploaded to S3.

## API surface (Phase 1)

| Module | Mounts |
|---|---|
| `/auth` | register, login, refresh, logout, sessions, MFA setup/confirm/disable |
| `/patients/:id` | profile, emergency contacts, allergies, conditions, procedures, immunizations, encounters |
| `/family` | invites, accept, delegates, accessible patients, grants, revoke |
| `/prescriptions` | create, list, refill request, approve/deny, authorize-pickup, dispense, confirm-pickup |
| `/results` | reports, lab results, PDF (queued) |
| `/dicom` | upload, list studies, viewer URLs |
| `/notifications` | list, mark read |
| `/audit` | list, verify chain |
| `/fhir/*` | RESTful FHIR R4 (patient + capability) |
| `/hl7/ingest` | HL7 v2 message ingestion |
| `/health` | liveness + DB ping (public) |

Full Swagger UI: <http://localhost:4000/api/docs>.

## Compliance hooks (NDPA / HIPAA-style)

- **Consent management** — `ConsentRecord` per scope/policy version, withdraw/expire fields.
- **Audit events** — append-only hash chain; integrity-verifiable.
- **Data export** — patient can export own data via `/fhir/Patient/{id}` + bundled history (Phase 2 endpoint).
- **Access revocation** — `FamilyRelationship.revoke` cascades to all `PermissionGrant` rows.
- **Retention** — soft-delete (`deletedAt`) on every clinical resource; hard-delete jobs in worker (Phase 3).

## Roadmap

### ✅ Phase 1 — Foundation
Monorepo, Prisma schema, auth+MFA+RBAC, core patient/family/prescriptions/results/DICOM/FHIR/audit modules, BullMQ worker (notifications + PDF), Next.js portal scaffold, Docker dev infra.

### ✅ Phase 2 — Clinical UX & Interop
- Patient dashboards: history, prescriptions, results, imaging, family access, notifications, profile/MFA setup.
- Staff portal (`/staff`): patient search, refill queue, result upload, progress updates, hash-chain audit monitor.
- Cornerstone3D DICOM viewer with WADO-RS streaming + bearer auth.
- HL7 MLLP TCP listener (toggle via `HL7_MLLP_ENABLED`) — ADT/ORU/ORM/SIU transformers + ACK responder, persisted to `HL7Message`.
- FHIR Bundle export at `GET /fhir/Patient/:id/$everything` covering Encounter, Observation, Condition, AllergyIntolerance, MedicationRequest, DiagnosticReport.
- Progress-update workflow: clinician publishes → in-app + family fan-out via `RECEIVE_PROGRESS_UPDATES`.

### ✅ Phase 3 — Hardening
- **CSRF** double-submit-cookie middleware (HMAC-signed) protecting all unsafe cookie-bearing requests; bearer-only API clients are exempt; opt-out paths for `/auth/*` bootstrap.
- **Login throttling**: Redis-backed sliding-window guard on `/auth/login` keyed by IP and email — defends shared NATs and credential stuffing.
- **Audit alerting** (`AlertsService`, `@nestjs/schedule`): scans the immutable audit log every minute for failed-login bursts, off-hours PHI reads, bulk-export floods, and audit-chain hash breaks. Findings fan-out to admin in-app notifications and structured WARN logs.
- **Crypto key versioning**: `KeyRegistry` in `@kincare/shared/crypto` parses `PHI_KEYS=v1:...;v2:...`, embeds version in ciphertext, and supports zero-downtime rotation via `rotateField()`. Backward-compatible with legacy unversioned ciphertext.
- **Data retention** (`RetentionService`): nightly hard-delete of soft-deleted records past `RETENTION_SOFT_DELETE_DAYS`; pseudonymizes dormant patient accounts past `RETENTION_INACTIVE_DAYS` (~7 years); purges expired refresh tokens + revoked sessions.
- **Tests**: Jest unit suites for crypto/key-rotation, RBAC matrix, HL7 parser/transformer, MLLP framer/ACK, audit hash chain, CSRF middleware. Playwright E2E for patient onboarding and auth security (rate-limit + RBAC).

### ✅ Phase 4 — Operations
- **CI/CD** (`.github/workflows/`): `ci.yml` runs lint + typecheck (parallel), unit tests against ephemeral Postgres 16 + Redis 7 services, Prisma `migrate diff --exit-code` drift gate, and a matrix Docker build that pushes `kincare-{api,worker,web}` images to GHCR with per-app GHA cache scopes; PRs additionally boot the compose stack and run Playwright. `security.yml` adds CodeQL, `pnpm audit --prod --audit-level=high`, and Trivy filesystem scan (SARIF → code-scanning) on a weekly schedule.
- **Production images**: hardened multi-stage Dockerfiles for each app — `apps/api` runs Prisma generate + Nest build then `pnpm deploy --prod`, `apps/worker` ships Chromium for Puppeteer with `PUPPETEER_SKIP_DOWNLOAD=true`, `apps/web` uses Next.js `output: 'standalone'`. All run as non-root `kincare:kincare` (uid 10001) under tini with curl health-checks; `.dockerignore` keeps build context minimal.
- **Helm chart** (`infra/helm/kincare/`): templated Deployments + Services for api/worker/web, optional MLLP `LoadBalancer`, `HorizontalPodAutoscaler` (CPU), Prisma `migrate deploy` initContainer, ConfigMap-driven env, conditional Secret (or `existingSecret: kincare-secrets`), Ingress (cert-manager + nginx), default-deny NetworkPolicy, ServiceAccount, Prometheus Operator `PodMonitor`, optional Postgres backup `CronJob`. Pod hardening: `runAsNonRoot`, `seccompProfile: RuntimeDefault`, `capabilities.drop: [ALL]`, rolling updates with `maxUnavailable: 0`.
- **Observability**:
  - **Traces** — `apps/{api,worker}/src/telemetry.ts` boot OpenTelemetry NodeSDK with auto-instrumentations (HTTP, Express, Postgres, Redis, BullMQ) and OTLP/HTTP export to `OTEL_EXPORTER_OTLP_ENDPOINT`; `/health` and `/metrics` are excluded from spans.
  - **Metrics** — `MetricsModule` (Nest) exposes `/metrics` via `prom-client` with default Node + GC + ELU metrics plus `kincare_http_request_duration_seconds`, `kincare_hl7_messages_total`, `kincare_auth_events_total`, `kincare_audit_alerts_total`, `kincare_notifications_sent_total`. The worker runs a tiny HTTP server on `METRICS_PORT` (9100) exposing `kincare_worker_jobs_total` and `kincare_worker_job_duration_seconds` from BullMQ events.
  - **Logs** — Pino already emits JSON; ship from stdout via Promtail/Vector → Loki. Optional `pino-loki` transport via `LOKI_URL`.
- **Backups & immutability**:
  - `infra/scripts/pg-backup.sh` (also bundled into the chart) takes `pg_dump --format=custom --compress=9` and uploads with `--object-lock-mode GOVERNANCE --object-lock-retain-until-date <now+RETENTION_DAYS>` and SSE-S3 (or SSE-KMS when `BACKUP_KMS_KEY_ID` is set). Driven by `backup-cronjob.yaml` (default 02:17 UTC, 35-day retention).
  - For sub-minute RPO PITR, layer continuous WAL archival (pgBackRest or wal-g) alongside these immutable daily dumps.
  - **S3 buckets** for audit exports and DICOM (`kincare-audit`, `kincare-dicom`, `kincare-pg-backups`) **must be created with Object Lock enabled** — it cannot be turned on retroactively. Pair Object Lock with versioning + a deny-delete bucket policy for finalised compliance posture.

### ✅ Phase 5 — Scale
- **PgBouncer + read replicas**: `docker-compose.yml` adds an `edoburu/pgbouncer` service in transaction-pool mode (port 6432). The `@kincare/db` package now exposes both `prisma` (writes via PgBouncer) and `prismaRead` (routed at `DATABASE_REPLICA_URL` when set, else falls back to primary). Migrations bypass the pooler via `DIRECT_DATABASE_URL` — see [.env.example](.env.example) for the connection-string templates including `?pgbouncer=true&connection_limit=1`.
- **BullMQ FlowProducer (HL7 → FHIR → notify)**: `FlowsModule` provides a shared [FlowsProducer](apps/api/src/common/flows/flows.producer.ts). When `HL7_FLOW_ASYNC=true`, the [MLLP listener](apps/api/src/modules/fhir/mllp-listener.service.ts) enqueues a parent `hl7.ingest` job + child `hl7.notify-family` job (queue `hl7-pipeline`) and ACKs immediately. The worker handler in [hl7-pipeline.worker.ts](apps/worker/src/queues/hl7-pipeline.worker.ts) parses the message, persists ADT/ORU/ORM side effects, and the child fan-outs in-app notifications to family delegates with `RECEIVE_PROGRESS_UPDATES` — each step retried independently with exponential backoff.
- **Multi-tenant partitioning**: a new `Tenant` model anchors `tenantId` columns on `User`, `PatientProfile`, `HL7Message`, and `AuditLog`. Email + MRN uniqueness become per-tenant compound indices. A request-scoped [TenantContext](apps/api/src/common/tenant/tenant.context.ts) is populated by [TenantMiddleware](apps/api/src/common/tenant/tenant.middleware.ts) from the JWT `tid` claim (or `X-Tenant-Id` for unauth flows), and the auth service stamps `tenantId` on registration / lookups. The default tenant `default` keeps single-tenant deployments working unchanged; the seed creates it automatically.
- **SMART-on-FHIR launch + OAuth2**: a new [SmartModule](apps/api/src/modules/smart/smart.module.ts) exposes `/.well-known/smart-configuration`, `/oauth/authorize` (PKCE S256 for public clients, `client_secret_basic` for confidential), `/oauth/token`, and an RFC 7591 `/oauth/register` endpoint gated by `SMART_REGISTRATION_TOKEN`. Issued tokens carry SMART launch context (`patient`, `encounter`) and are persisted as opaque `OAuthAccessToken` rows for revocation. Endpoints sit outside the `api/v1` prefix and are exempt from CSRF (server-to-server).

## Security checklist (OWASP Top 10 mapping)

| Risk | Mitigation in code |
|---|---|
| A01 Broken Access Control | Layered RBAC + delegate grants; resource-level checks via `resolvePatientId`. |
| A02 Cryptographic Failures | scrypt password hashing + pepper, AES-256-GCM PHI fields, S3 SSE. |
| A03 Injection | Prisma parameterized queries; Zod env + DTO validation; `class-validator` whitelist. |
| A04 Insecure Design | Hash-chained audit log; explicit consent records; per-action permission tokens. |
| A05 Misconfiguration | `helmet`, env validated by Zod at boot, CORS allow-list. |
| A07 Auth Failures | JWT rotation + reuse detection, account lockout, MFA. |
| A08 Software & Data Integrity | Refresh-token hashes (DB-bound), audit hash chain. |
| A09 Logging & Monitoring | Pino structured logs with PII redaction; immutable AuditLog. |
| A10 SSRF | Outbound HTTP only to configured Orthanc / SMTP / SMS endpoints. |

## License

Proprietary — internal hospital deployment. All rights reserved.
