-- Additive immutable issued-render snapshot for certificate regeneration.
ALTER TABLE "certificate_issues" ADD COLUMN IF NOT EXISTS "renderSnapshotJson" JSONB;
