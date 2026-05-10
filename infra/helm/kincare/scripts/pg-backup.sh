#!/usr/bin/env bash
# Mirrored copy of infra/scripts/pg-backup.sh — bundled into the Helm chart so
# the CronJob can mount it via .Files.Get. Keep both copies in sync.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"

PREFIX="${BACKUP_S3_PREFIX:-kincare/postgres}"
RETAIN_DAYS="${BACKUP_RETENTION_DAYS:-35}"
REGION="${AWS_REGION:-us-east-1}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="kincare-${TS}.dump"
TMP="/tmp/${FILE}"

pg_dump --format=custom --compress=9 --no-owner --no-privileges \
  --file="${TMP}" "${DATABASE_URL}"

RETAIN_UNTIL="$(date -u -d "+${RETAIN_DAYS} days" +%Y-%m-%dT%H:%M:%SZ)"

SSE_ARGS=(--server-side-encryption AES256)
if [[ -n "${BACKUP_KMS_KEY_ID:-}" ]]; then
  SSE_ARGS=(--server-side-encryption aws:kms --ssekms-key-id "${BACKUP_KMS_KEY_ID}")
fi

aws s3api put-object \
  --bucket "${BACKUP_S3_BUCKET}" \
  --key    "${PREFIX}/${FILE}" \
  --body   "${TMP}" \
  --region "${REGION}" \
  --object-lock-mode GOVERNANCE \
  --object-lock-retain-until-date "${RETAIN_UNTIL}" \
  "${SSE_ARGS[@]}"

rm -f "${TMP}"
