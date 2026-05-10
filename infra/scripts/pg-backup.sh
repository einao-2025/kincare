#!/usr/bin/env bash
# Postgres logical backup → encrypted S3 with Object Lock retention.
# Designed to run inside a Kubernetes CronJob (see infra/helm/kincare/templates/backup-cronjob.yaml).
#
# Required env:
#   DATABASE_URL                   postgres://user:pass@host:5432/db
#   BACKUP_S3_BUCKET               immutable bucket (Object Lock enabled)
#   BACKUP_S3_PREFIX               default: kincare/postgres
#   BACKUP_RETENTION_DAYS          default: 35  (Object Lock GOVERNANCE retention)
#   AWS_REGION                     default: us-east-1
#   BACKUP_KMS_KEY_ID              optional KMS CMK for SSE-KMS
#
# PITR note: combine these logical dumps with continuous WAL archival
# (e.g. pgBackRest / wal-g) for sub-minute RPO. This script provides the
# off-site, immutable, point-in-day archive component.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"

PREFIX="${BACKUP_S3_PREFIX:-kincare/postgres}"
RETAIN_DAYS="${BACKUP_RETENTION_DAYS:-35}"
REGION="${AWS_REGION:-us-east-1}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="kincare-${TS}.dump"
TMP="/tmp/${FILE}"

echo "[backup] dumping → ${TMP}"
pg_dump --format=custom --compress=9 --no-owner --no-privileges \
  --file="${TMP}" "${DATABASE_URL}"

# RFC3339 timestamp = now + RETAIN_DAYS
RETAIN_UNTIL="$(date -u -d "+${RETAIN_DAYS} days" +%Y-%m-%dT%H:%M:%SZ)"

SSE_ARGS=(--server-side-encryption AES256)
if [[ -n "${BACKUP_KMS_KEY_ID:-}" ]]; then
  SSE_ARGS=(--server-side-encryption aws:kms --ssekms-key-id "${BACKUP_KMS_KEY_ID}")
fi

echo "[backup] uploading s3://${BACKUP_S3_BUCKET}/${PREFIX}/${FILE} (lock until ${RETAIN_UNTIL})"
aws s3api put-object \
  --bucket "${BACKUP_S3_BUCKET}" \
  --key    "${PREFIX}/${FILE}" \
  --body   "${TMP}" \
  --region "${REGION}" \
  --object-lock-mode GOVERNANCE \
  --object-lock-retain-until-date "${RETAIN_UNTIL}" \
  "${SSE_ARGS[@]}"

rm -f "${TMP}"
echo "[backup] ok"
