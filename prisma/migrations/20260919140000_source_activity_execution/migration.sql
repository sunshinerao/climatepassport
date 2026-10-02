-- CP-TODO-245: source-mapping execution layer.
-- 1) One ACTIVE source mapping per CP activity (first-touch binding wins; a
--    second concurrent bind of the same activity is rejected by the database).
-- 2) contentHash supports bind idempotency (same key + same content dedups;
--    same key + different content conflicts without storing raw payloads).

ALTER TABLE "source_object_mappings" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "source_object_mappings_active_activity_key"
  ON "source_object_mappings"("activityId")
  WHERE "applyStatus" = 'ACTIVE';
