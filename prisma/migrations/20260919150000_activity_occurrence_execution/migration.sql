-- CP-TODO-246 (CP-FR-054/055/056): occurrence-linked applications with atomic
-- admission capacity, per-person multi-role assignments with dedup statistics,
-- external taxonomy classification references with version guards, and
-- attendance-correction evidence on checkin records.
-- All additive; existing tables and summer-school behaviors unchanged.

ALTER TABLE "activity_applications" ADD COLUMN IF NOT EXISTS "occurrenceId" TEXT;
CREATE INDEX IF NOT EXISTS "activity_applications_occurrenceId_idx" ON "activity_applications"("occurrenceId");
ALTER TABLE "activity_applications" ADD CONSTRAINT "activity_applications_occurrenceId_fkey"
  FOREIGN KEY ("occurrenceId") REFERENCES "activity_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "activity_person_roles" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "roleType" TEXT NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "note" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "activity_person_roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "activity_person_roles_activityId_personId_roleType_key" ON "activity_person_roles"("activityId", "personId", "roleType");
CREATE INDEX "activity_person_roles_activityId_idx" ON "activity_person_roles"("activityId");
CREATE INDEX "activity_person_roles_personId_idx" ON "activity_person_roles"("personId");
ALTER TABLE "activity_person_roles" ADD CONSTRAINT "activity_person_roles_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_person_roles" ADD CONSTRAINT "activity_person_roles_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_person_roles" ADD CONSTRAINT "activity_person_roles_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "activity_external_classifications" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "taxonomySystem" TEXT NOT NULL,
  "taxonomyRef" TEXT NOT NULL,
  "labelJson" JSONB,
  "sourceVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "idempotencyKey" TEXT,
  "contentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "activity_external_classifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "activity_external_classifications_activityId_taxonomySyste_key" ON "activity_external_classifications"("activityId", "taxonomySystem", "taxonomyRef");
CREATE UNIQUE INDEX "activity_external_classifications_idempotencyKey_key" ON "activity_external_classifications"("idempotencyKey");
CREATE INDEX "activity_external_classifications_activityId_status_idx" ON "activity_external_classifications"("activityId", "status");
ALTER TABLE "activity_external_classifications" ADD CONSTRAINT "activity_external_classifications_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activity_checkin_records" ADD COLUMN IF NOT EXISTS "isCorrection" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "activity_checkin_records" ADD COLUMN IF NOT EXISTS "noteJson" JSONB;
