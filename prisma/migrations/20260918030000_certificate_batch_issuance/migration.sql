DO $$ BEGIN
  CREATE TYPE "CertificateBatchSource" AS ENUM ('MANUAL_LIST', 'CSV', 'ACTIVITY_ELIGIBLE_LIST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CertificateBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_FAILURES', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CertificateBatchItemStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "certificate_batches" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "source" "CertificateBatchSource" NOT NULL,
  "status" "CertificateBatchStatus" NOT NULL DEFAULT 'PENDING',
  "templateId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "activityId" TEXT,
  "issueDate" TIMESTAMP(3),
  "variableValuesJson" JSONB,
  "notifyRecipients" BOOLEAN NOT NULL DEFAULT true,
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "succeededCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "certificate_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "certificate_batch_items" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowIndex" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "status" "CertificateBatchItemStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseExpiresAt" TIMESTAMP(3),
  "certificateIssueId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "certificate_batch_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "certificate_batches_idempotencyKey_key" ON "certificate_batches"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "certificate_batches_status_createdAt_idx" ON "certificate_batches"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "certificate_batches_createdByUserId_createdAt_idx" ON "certificate_batches"("createdByUserId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "certificate_batch_items_certificateIssueId_key" ON "certificate_batch_items"("certificateIssueId");
CREATE INDEX IF NOT EXISTS "certificate_batch_items_batchId_status_idx" ON "certificate_batch_items"("batchId", "status");
CREATE INDEX IF NOT EXISTS "certificate_batch_items_normalizedEmail_idx" ON "certificate_batch_items"("normalizedEmail");

-- Exactly one durable batch issue per batch item, even if a retried worker races
-- the compare-and-set claim after a lease expiry. Only new BATCH rows are covered.
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_issues_batch_source_id_key"
  ON "certificate_issues"("sourceId")
  WHERE "sourceType" = 'CERTIFICATE_BATCH';

DO $$ BEGIN
  ALTER TABLE "certificate_batches"
    ADD CONSTRAINT "certificate_batches_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "certificate_batches"
    ADD CONSTRAINT "certificate_batches_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "certificate_batches"
    ADD CONSTRAINT "certificate_batches_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "certificate_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "certificate_batches"
    ADD CONSTRAINT "certificate_batches_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "certificate_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "certificate_batch_items"
    ADD CONSTRAINT "certificate_batch_items_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "certificate_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "certificate_batch_items"
    ADD CONSTRAINT "certificate_batch_items_certificateIssueId_fkey"
    FOREIGN KEY ("certificateIssueId") REFERENCES "certificate_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
