-- Wave 2 (CP-TODO-246/253/257): generic activity occurrences with atomic
-- admission capacity, person/institution contribution facts with verification
-- levels and corrections, and notification delivery attempts for retry evidence.
-- All additive; existing tables and behaviors unchanged.

CREATE TABLE IF NOT EXISTS "activity_occurrences" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER,
  "admittedCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "locationJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "activity_occurrences_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "activity_occurrences_activityId_startsAt_idx" ON "activity_occurrences"("activityId", "startsAt");
ALTER TABLE "activity_occurrences" ADD CONSTRAINT "activity_occurrences_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "contribution_facts" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "institutionId" TEXT,
  "programmeId" TEXT,
  "contributionType" TEXT NOT NULL,
  "summaryJson" JSONB NOT NULL,
  "verificationLevel" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "sourceType" TEXT,
  "sourceId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "correctionOfId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contribution_facts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contribution_facts_personId_status_idx" ON "contribution_facts"("personId", "status");
CREATE INDEX "contribution_facts_institutionId_status_idx" ON "contribution_facts"("institutionId", "status");
ALTER TABLE "contribution_facts" ADD CONSTRAINT "contribution_facts_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contribution_facts" ADD CONSTRAINT "contribution_facts_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "notification_attempts" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "result" TEXT NOT NULL,
  "error" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notification_attempts_notificationId_attempt_idx" ON "notification_attempts"("notificationId", "attempt");
ALTER TABLE "notification_attempts" ADD CONSTRAINT "notification_attempts_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_attempts" ADD CONSTRAINT "notification_attempts_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
