-- CP-TODO-257 (CP-FR-066/067/068): notification delivery retry evidence,
-- privacy-safe aggregate reports, scoped self-export/account deletion and
-- backup privacy-marker replay.
-- All additive; existing tables and behaviors unchanged.
-- Notification preferences reuse the pre-existing per-user
-- notification_preferences table (email/inApp/sms/marketing flags).

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "deadLetteredAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "notifications_status_nextRetryAt_idx" ON "notifications"("status", "nextRetryAt");

CREATE TABLE IF NOT EXISTS "privacy_markers" (
  "id" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT,
  "reason" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "privacy_markers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "privacy_markers_subject_idx" ON "privacy_markers"("subjectType", "subjectId");
CREATE INDEX "privacy_markers_action_idx" ON "privacy_markers"("action");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "anonymizedReason" TEXT;
