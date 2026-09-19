-- Phase 2A: provider-neutral external learning delivery receipt and evidence boundary.
CREATE TYPE "ExternalLearningProviderStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');
CREATE TYPE "ExternalLearningAccountStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISABLED');
CREATE TYPE "ExternalLearningMappingStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "ExternalLearningSignatureStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "ExternalLearningInboxProcessingStatus" AS ENUM ('RECEIVED', 'REJECTED', 'PENDING_RECONCILIATION');
CREATE TYPE "ExternalLearningEvidenceState" AS ENUM ('RECEIVED', 'RECONCILIATION_PENDING', 'RECONCILED', 'REJECTED');
CREATE TYPE "ExternalLearningReconciliationState" AS ENUM ('NOT_STARTED', 'PENDING', 'MATCHED', 'UNMATCHED', 'REJECTED');
CREATE TYPE "ExternalLearningWritebackState" AS ENUM ('NOT_REQUESTED', 'BLOCKED');

CREATE TABLE "external_learning_providers" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "webhookPathKey" TEXT NOT NULL, "displayName" TEXT NOT NULL,
  "status" "ExternalLearningProviderStatus" NOT NULL DEFAULT 'DRAFT', "verificationConfigJson" JSONB,
  "signingSecretRef" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_learning_providers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_learning_providers_key_key" ON "external_learning_providers"("key");
CREATE UNIQUE INDEX "external_learning_providers_webhookPathKey_key" ON "external_learning_providers"("webhookPathKey");

CREATE TABLE "external_learning_accounts" (
  "id" TEXT NOT NULL, "providerId" TEXT NOT NULL, "userId" TEXT NOT NULL, "externalSubjectHash" TEXT NOT NULL,
  "status" "ExternalLearningAccountStatus" NOT NULL DEFAULT 'PENDING', "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_learning_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_learning_accounts_providerId_externalSubjectHash_key" ON "external_learning_accounts"("providerId", "externalSubjectHash");
CREATE INDEX "external_learning_accounts_userId_status_idx" ON "external_learning_accounts"("userId", "status");

CREATE TABLE "external_learning_course_mappings" (
  "id" TEXT NOT NULL, "providerId" TEXT NOT NULL, "externalCourseHash" TEXT NOT NULL,
  "learningExperienceProgramId" TEXT, "activityId" TEXT, "status" "ExternalLearningMappingStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_learning_course_mappings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_learning_course_mappings_target_check" CHECK (("learningExperienceProgramId" IS NOT NULL) <> ("activityId" IS NOT NULL))
);
CREATE UNIQUE INDEX "external_learning_course_mappings_providerId_externalCourseHash_key" ON "external_learning_course_mappings"("providerId", "externalCourseHash");
CREATE INDEX "external_learning_course_mappings_learningExperienceProgramId_status_idx" ON "external_learning_course_mappings"("learningExperienceProgramId", "status");
CREATE INDEX "external_learning_course_mappings_activityId_status_idx" ON "external_learning_course_mappings"("activityId", "status");

CREATE TABLE "external_learning_inbox_events" (
  "id" TEXT NOT NULL, "providerId" TEXT NOT NULL, "deliveryId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "signatureStatus" "ExternalLearningSignatureStatus" NOT NULL, "processingStatus" "ExternalLearningInboxProcessingStatus" NOT NULL,
  "payloadSha256" TEXT NOT NULL, "redactedHeadersJson" JSONB NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_learning_inbox_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_learning_inbox_events_providerId_deliveryId_key" ON "external_learning_inbox_events"("providerId", "deliveryId");
CREATE INDEX "external_learning_inbox_events_providerId_processingStatus_receivedAt_idx" ON "external_learning_inbox_events"("providerId", "processingStatus", "receivedAt");

CREATE TABLE "external_learning_evidence" (
  "id" TEXT NOT NULL, "providerId" TEXT NOT NULL, "inboxEventId" TEXT NOT NULL, "externalEventId" TEXT NOT NULL,
  "externalSubjectHash" TEXT, "externalCourseHash" TEXT, "occurredAt" TIMESTAMP(3), "normalizedDataJson" JSONB NOT NULL,
  "evidenceState" "ExternalLearningEvidenceState" NOT NULL DEFAULT 'RECEIVED',
  "reconciliationState" "ExternalLearningReconciliationState" NOT NULL DEFAULT 'NOT_STARTED',
  "writebackState" "ExternalLearningWritebackState" NOT NULL DEFAULT 'NOT_REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_learning_evidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_learning_evidence_providerId_externalEventId_key" ON "external_learning_evidence"("providerId", "externalEventId");
CREATE INDEX "external_learning_evidence_providerId_reconciliationState_createdAt_idx" ON "external_learning_evidence"("providerId", "reconciliationState", "createdAt");

ALTER TABLE "external_learning_accounts" ADD CONSTRAINT "external_learning_accounts_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "external_learning_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_learning_accounts" ADD CONSTRAINT "external_learning_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_learning_course_mappings" ADD CONSTRAINT "external_learning_course_mappings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "external_learning_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_learning_course_mappings" ADD CONSTRAINT "external_learning_course_mappings_program_fkey" FOREIGN KEY ("learningExperienceProgramId") REFERENCES "learning_experience_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_learning_course_mappings" ADD CONSTRAINT "external_learning_course_mappings_activity_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_learning_inbox_events" ADD CONSTRAINT "external_learning_inbox_events_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "external_learning_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_learning_evidence" ADD CONSTRAINT "external_learning_evidence_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "external_learning_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_learning_evidence" ADD CONSTRAINT "external_learning_evidence_inboxEventId_fkey" FOREIGN KEY ("inboxEventId") REFERENCES "external_learning_inbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
