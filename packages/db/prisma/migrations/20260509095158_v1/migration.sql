-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'FAMILY_DELEGATE', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECHNICIAN', 'RADIOLOGIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Genotype" AS ENUM ('AA', 'AS', 'SS', 'AC', 'SC', 'CC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'GUARDIAN', 'CAREGIVER', 'OTHER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('VIEW_DEMOGRAPHICS', 'VIEW_MEDICAL_HISTORY', 'VIEW_PRESCRIPTIONS', 'REQUEST_REFILL', 'AUTHORIZE_PICKUP', 'VIEW_TEST_RESULTS', 'VIEW_IMAGING', 'RECEIVE_PROGRESS_UPDATES', 'EMERGENCY_ACCESS');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ENTERED_IN_ERROR');

-- CreateEnum
CREATE TYPE "RefillRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'DISPENSED', 'PICKED_UP', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DispenseStatus" AS ENUM ('PREPARING', 'READY_FOR_PICKUP', 'DISPENSED', 'RETURNED');

-- CreateEnum
CREATE TYPE "TestResultStatus" AS ENUM ('REGISTERED', 'PRELIMINARY', 'FINAL', 'AMENDED', 'CORRECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'MFA_CHALLENGE', 'EXPORT', 'DOWNLOAD', 'GRANT_PERMISSION', 'REVOKE_PERMISSION', 'CONSENT_GIVEN', 'CONSENT_WITHDRAWN', 'PRESCRIBE', 'DISPENSE', 'REFILL_REQUEST', 'STATUS_UPDATE');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EncounterClass" AS ENUM ('AMBULATORY', 'EMERGENCY', 'INPATIENT', 'OUTPATIENT', 'HOMEHEALTH', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('PLANNED', 'ARRIVED', 'IN_PROGRESS', 'ONLEAVE', 'FINISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEnc" TEXT,
    "mfaRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "mrn" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'UNKNOWN',
    "bloodGroup" "BloodGroup" NOT NULL DEFAULT 'UNKNOWN',
    "genotype" "Genotype" NOT NULL DEFAULT 'UNKNOWN',
    "addressLine1Enc" TEXT,
    "addressLine2Enc" TEXT,
    "cityEnc" TEXT,
    "stateEnc" TEXT,
    "postalCodeEnc" TEXT,
    "countryEnc" TEXT,
    "nationalIdEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relation" "RelationshipType" NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioners" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "specialty" TEXT,
    "department" TEXT,
    "npi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "practitioners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_invites" (
    "id" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID,
    "inviteEmail" TEXT NOT NULL,
    "invitePhone" TEXT,
    "relation" "RelationshipType" NOT NULL,
    "proposedScopes" "PermissionScope"[],
    "tokenHash" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_relationships" (
    "id" UUID NOT NULL,
    "patientUserId" UUID NOT NULL,
    "delegateUserId" UUID NOT NULL,
    "relation" "RelationshipType" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "family_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_grants" (
    "id" UUID NOT NULL,
    "relationshipId" UUID NOT NULL,
    "grantorUserId" UUID NOT NULL,
    "granteeUserId" UUID NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "practitionerId" UUID,
    "class" "EncounterClass" NOT NULL DEFAULT 'AMBULATORY',
    "status" "EncounterStatus" NOT NULL DEFAULT 'PLANNED',
    "reasonCode" TEXT,
    "reasonText" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allergy_intolerances" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "substance" TEXT NOT NULL,
    "reaction" TEXT,
    "severity" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "allergy_intolerances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditions" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "recordedById" UUID,
    "code" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "clinicalStatus" TEXT NOT NULL DEFAULT 'active',
    "onsetDate" TIMESTAMP(3),
    "abatementDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedures" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "performedById" UUID,
    "code" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "immunizations" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "vaccineCode" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL,
    "lotNumber" TEXT,
    "doseNumber" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "immunizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "performedById" UUID,
    "code" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "category" TEXT,
    "valueNumeric" DECIMAL(20,6),
    "valueString" TEXT,
    "unit" TEXT,
    "referenceLow" DECIMAL(20,6),
    "referenceHigh" DECIMAL(20,6),
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'final',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_reports" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "authorId" UUID,
    "code" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "category" TEXT,
    "status" "TestResultStatus" NOT NULL DEFAULT 'REGISTERED',
    "conclusion" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "diagnostic_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "reportId" UUID,
    "testName" TEXT NOT NULL,
    "testCode" TEXT,
    "resultValue" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    "flag" TEXT,
    "status" "TestResultStatus" NOT NULL DEFAULT 'FINAL',
    "performedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_attachments" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "prescriberId" UUID NOT NULL,
    "encounterId" UUID,
    "medicationCode" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "route" TEXT,
    "frequency" TEXT NOT NULL,
    "durationDays" INTEGER,
    "quantity" INTEGER NOT NULL,
    "refillsAllowed" INTEGER NOT NULL DEFAULT 0,
    "refillsUsed" INTEGER NOT NULL DEFAULT 0,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "prescribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_refill_requests" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "status" "RefillRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "authorizedPickupUserId" UUID,
    "pickupCode" TEXT,
    "pickupCodeExpiresAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "pickedUpByName" TEXT,
    "pickedUpByIdRef" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" UUID,
    "deniedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_refill_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_dispenses" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "refillRequestId" UUID,
    "pharmacistUserId" UUID NOT NULL,
    "status" "DispenseStatus" NOT NULL DEFAULT 'PREPARING',
    "quantityDispensed" INTEGER NOT NULL,
    "dispensedAt" TIMESTAMP(3),
    "lotNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_dispenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_team_members" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "practitionerId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "care_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_updates" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "authorId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "notifyFamily" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "externalId" TEXT,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "AuditAction" NOT NULL,
    "actorUserId" UUID,
    "actorRole" "UserRole",
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "patientId" UUID,
    "outcome" TEXT NOT NULL DEFAULT 'success',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "evidenceHash" TEXT,
    "metadata" JSONB,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dicom_studies" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "studyInstanceUID" TEXT NOT NULL,
    "accessionNumber" TEXT,
    "studyDate" TIMESTAMP(3),
    "studyDescription" TEXT,
    "modality" TEXT,
    "referringPhysician" TEXT,
    "orthancStudyId" TEXT,
    "numberOfSeries" INTEGER NOT NULL DEFAULT 0,
    "numberOfInstances" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "dicom_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dicom_series" (
    "id" UUID NOT NULL,
    "studyId" UUID NOT NULL,
    "seriesInstanceUID" TEXT NOT NULL,
    "seriesNumber" INTEGER,
    "modality" TEXT,
    "bodyPart" TEXT,
    "description" TEXT,
    "orthancSeriesId" TEXT,
    "numberOfInstances" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dicom_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dicom_instances" (
    "id" UUID NOT NULL,
    "seriesId" UUID NOT NULL,
    "sopInstanceUID" TEXT NOT NULL,
    "instanceNumber" INTEGER,
    "orthancInstanceId" TEXT,
    "s3Bucket" TEXT,
    "s3Key" TEXT,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dicom_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hl7_messages" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "messageType" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "sendingApp" TEXT,
    "sendingFacility" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawMessage" TEXT NOT NULL,
    "parsedJson" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "hl7_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "scopes" TEXT NOT NULL,
    "jwksUri" TEXT,
    "isConfidential" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_auth_codes" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "patientId" UUID,
    "encounterId" UUID,
    "codeChallenge" TEXT,
    "codeChallengeMethod" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_access_tokens" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "patientId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_phone_key" ON "users"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "patient_profiles_userId_key" ON "patient_profiles"("userId");

-- CreateIndex
CREATE INDEX "patient_profiles_deletedAt_idx" ON "patient_profiles"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "patient_profiles_tenantId_mrn_key" ON "patient_profiles"("tenantId", "mrn");

-- CreateIndex
CREATE INDEX "emergency_contacts_patientId_idx" ON "emergency_contacts"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "practitioners_userId_key" ON "practitioners"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "practitioners_licenseNumber_key" ON "practitioners"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "family_invites_tokenHash_key" ON "family_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "family_invites_toUserId_status_idx" ON "family_invites"("toUserId", "status");

-- CreateIndex
CREATE INDEX "family_relationships_delegateUserId_idx" ON "family_relationships"("delegateUserId");

-- CreateIndex
CREATE UNIQUE INDEX "family_relationships_patientUserId_delegateUserId_key" ON "family_relationships"("patientUserId", "delegateUserId");

-- CreateIndex
CREATE INDEX "permission_grants_granteeUserId_scope_revokedAt_idx" ON "permission_grants"("granteeUserId", "scope", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "permission_grants_relationshipId_scope_key" ON "permission_grants"("relationshipId", "scope");

-- CreateIndex
CREATE INDEX "encounters_patientId_startAt_idx" ON "encounters"("patientId", "startAt");

-- CreateIndex
CREATE INDEX "allergy_intolerances_patientId_idx" ON "allergy_intolerances"("patientId");

-- CreateIndex
CREATE INDEX "conditions_patientId_clinicalStatus_idx" ON "conditions"("patientId", "clinicalStatus");

-- CreateIndex
CREATE INDEX "procedures_patientId_performedAt_idx" ON "procedures"("patientId", "performedAt");

-- CreateIndex
CREATE INDEX "immunizations_patientId_idx" ON "immunizations"("patientId");

-- CreateIndex
CREATE INDEX "observations_patientId_code_effectiveAt_idx" ON "observations"("patientId", "code", "effectiveAt");

-- CreateIndex
CREATE INDEX "diagnostic_reports_patientId_issuedAt_idx" ON "diagnostic_reports"("patientId", "issuedAt");

-- CreateIndex
CREATE INDEX "test_results_patientId_performedAt_idx" ON "test_results"("patientId", "performedAt");

-- CreateIndex
CREATE INDEX "report_attachments_reportId_idx" ON "report_attachments"("reportId");

-- CreateIndex
CREATE INDEX "prescriptions_patientId_status_idx" ON "prescriptions"("patientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_refill_requests_pickupCode_key" ON "prescription_refill_requests"("pickupCode");

-- CreateIndex
CREATE INDEX "prescription_refill_requests_patientId_status_idx" ON "prescription_refill_requests"("patientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "medication_dispenses_refillRequestId_key" ON "medication_dispenses"("refillRequestId");

-- CreateIndex
CREATE INDEX "care_team_members_patientId_idx" ON "care_team_members"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "care_team_members_patientId_practitionerId_role_key" ON "care_team_members"("patientId", "practitionerId", "role");

-- CreateIndex
CREATE INDEX "progress_updates_patientId_createdAt_idx" ON "progress_updates"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_hash_key" ON "audit_logs"("hash");

-- CreateIndex
CREATE INDEX "audit_logs_patientId_occurredAt_idx" ON "audit_logs"("patientId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_occurredAt_idx" ON "audit_logs"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_occurredAt_idx" ON "audit_logs"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "consent_records_userId_scope_status_idx" ON "consent_records"("userId", "scope", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dicom_studies_studyInstanceUID_key" ON "dicom_studies"("studyInstanceUID");

-- CreateIndex
CREATE UNIQUE INDEX "dicom_studies_orthancStudyId_key" ON "dicom_studies"("orthancStudyId");

-- CreateIndex
CREATE INDEX "dicom_studies_patientId_studyDate_idx" ON "dicom_studies"("patientId", "studyDate");

-- CreateIndex
CREATE UNIQUE INDEX "dicom_series_seriesInstanceUID_key" ON "dicom_series"("seriesInstanceUID");

-- CreateIndex
CREATE UNIQUE INDEX "dicom_series_orthancSeriesId_key" ON "dicom_series"("orthancSeriesId");

-- CreateIndex
CREATE INDEX "dicom_series_studyId_idx" ON "dicom_series"("studyId");

-- CreateIndex
CREATE UNIQUE INDEX "dicom_instances_sopInstanceUID_key" ON "dicom_instances"("sopInstanceUID");

-- CreateIndex
CREATE UNIQUE INDEX "dicom_instances_orthancInstanceId_key" ON "dicom_instances"("orthancInstanceId");

-- CreateIndex
CREATE INDEX "dicom_instances_seriesId_instanceNumber_idx" ON "dicom_instances"("seriesId", "instanceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "hl7_messages_controlId_key" ON "hl7_messages"("controlId");

-- CreateIndex
CREATE INDEX "hl7_messages_messageType_processed_idx" ON "hl7_messages"("messageType", "processed");

-- CreateIndex
CREATE INDEX "hl7_messages_tenantId_receivedAt_idx" ON "hl7_messages"("tenantId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_clients_clientId_key" ON "oauth_clients"("clientId");

-- CreateIndex
CREATE INDEX "oauth_clients_tenantId_idx" ON "oauth_clients"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_auth_codes_codeHash_key" ON "oauth_auth_codes"("codeHash");

-- CreateIndex
CREATE INDEX "oauth_auth_codes_clientId_expiresAt_idx" ON "oauth_auth_codes"("clientId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_tokens_tokenHash_key" ON "oauth_access_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_clientId_userId_idx" ON "oauth_access_tokens"("clientId", "userId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_relationships" ADD CONSTRAINT "family_relationships_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_relationships" ADD CONSTRAINT "family_relationships_delegateUserId_fkey" FOREIGN KEY ("delegateUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "family_relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_grantorUserId_fkey" FOREIGN KEY ("grantorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_granteeUserId_fkey" FOREIGN KEY ("granteeUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allergy_intolerances" ADD CONSTRAINT "allergy_intolerances_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "diagnostic_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "diagnostic_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_prescriberId_fkey" FOREIGN KEY ("prescriberId") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refill_requests" ADD CONSTRAINT "prescription_refill_requests_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refill_requests" ADD CONSTRAINT "prescription_refill_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_dispenses" ADD CONSTRAINT "medication_dispenses_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_dispenses" ADD CONSTRAINT "medication_dispenses_refillRequestId_fkey" FOREIGN KEY ("refillRequestId") REFERENCES "prescription_refill_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_updates" ADD CONSTRAINT "progress_updates_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_updates" ADD CONSTRAINT "progress_updates_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_updates" ADD CONSTRAINT "progress_updates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dicom_studies" ADD CONSTRAINT "dicom_studies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dicom_series" ADD CONSTRAINT "dicom_series_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "dicom_studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dicom_instances" ADD CONSTRAINT "dicom_instances_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "dicom_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hl7_messages" ADD CONSTRAINT "hl7_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_auth_codes" ADD CONSTRAINT "oauth_auth_codes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
