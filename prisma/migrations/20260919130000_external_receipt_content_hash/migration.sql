-- CP-TODO-250 follow-up: canonical content hash for idempotency/conflict checks
-- and an optional validity window for external decision receipts.

ALTER TABLE "external_decision_receipts" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "external_decision_receipts" ADD COLUMN IF NOT EXISTS "validUntil" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "external_decision_receipts_issuer_object_purpose_idx"
  ON "external_decision_receipts"("issuerKey", "objectType", "objectId", "purpose");
