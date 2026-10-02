-- CP-TODO-243 / CP-FR-069: Open API key lifecycle and per-key policy columns.
--
-- All additive. Legacy rows keep working: `machineKeyHash` (unsalted sha256 digest) stays
-- readable until a key is rotated, at which point the row moves to `machineKeyBcrypt` and the
-- digest is cleared. `machineKeyExpiresAt IS NULL` therefore means "issued before expiry was
-- enforced", not "unlimited by policy" — new registrations always carry an expiry.

ALTER TABLE "channel_clients" ADD COLUMN IF NOT EXISTS "machineKeyBcrypt" TEXT;
ALTER TABLE "channel_clients" ADD COLUMN IF NOT EXISTS "machineKeyIssuedAt" TIMESTAMP(3);
ALTER TABLE "channel_clients" ADD COLUMN IF NOT EXISTS "machineKeyExpiresAt" TIMESTAMP(3);
ALTER TABLE "channel_clients" ADD COLUMN IF NOT EXISTS "machineKeyRotatedAt" TIMESTAMP(3);
ALTER TABLE "channel_clients" ADD COLUMN IF NOT EXISTS "machineKeyLastUsedAt" TIMESTAMP(3);
ALTER TABLE "channel_clients" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "channel_clients" ADD COLUMN IF NOT EXISTS "revokeReason" TEXT;
ALTER TABLE "channel_clients" ADD COLUMN IF NOT EXISTS "allowedIps" TEXT[];
ALTER TABLE "channel_clients" ADD COLUMN IF NOT EXISTS "rateLimitLimit" INTEGER;
ALTER TABLE "channel_clients" ADD COLUMN IF NOT EXISTS "rateLimitWindowMs" INTEGER;

-- Backfill the issue timestamp for keys that predate this migration so the admin list never
-- shows "issued: ??" for a row that is actually in use.
UPDATE "channel_clients" SET "machineKeyIssuedAt" = "createdAt"
  WHERE "machineKeyIssuedAt" IS NULL AND "machineKeyHash" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "channel_clients_machineKeyExpiresAt_idx" ON "channel_clients"("machineKeyExpiresAt");
