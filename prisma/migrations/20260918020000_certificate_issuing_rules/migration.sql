DO $$ BEGIN
  CREATE TYPE "CertificateIssuingRuleTrigger" AS ENUM ('ACTIVITY_CHECKIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "activity_certificate_rules"
  ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'Activity check-in certificate',
  ADD COLUMN IF NOT EXISTS "trigger" "CertificateIssuingRuleTrigger" NOT NULL DEFAULT 'ACTIVITY_CHECKIN',
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "notifyUser" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "requiresAdminConfirmation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "activity_certificate_rules"
SET "isActive" = "autoIssue"
WHERE "isActive" = false AND "autoIssue" = true;

DROP INDEX IF EXISTS "activity_certificate_rules_activityId_idx";
CREATE INDEX IF NOT EXISTS "activity_certificate_rules_activityId_isActive_idx"
  ON "activity_certificate_rules"("activityId", "isActive");
CREATE INDEX IF NOT EXISTS "activity_certificate_rules_certificateDefinitionId_trigger_idx"
  ON "activity_certificate_rules"("certificateDefinitionId", "trigger");
