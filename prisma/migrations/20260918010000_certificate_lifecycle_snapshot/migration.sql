ALTER TABLE "certificate_issues"
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "revocationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "restoredByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "certificate_issues_revokedByUserId_idx" ON "certificate_issues"("revokedByUserId");
CREATE INDEX IF NOT EXISTS "certificate_issues_restoredByUserId_idx" ON "certificate_issues"("restoredByUserId");

DO $$ BEGIN
  ALTER TABLE "certificate_issues"
    ADD CONSTRAINT "certificate_issues_revokedByUserId_fkey"
    FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "certificate_issues"
    ADD CONSTRAINT "certificate_issues_restoredByUserId_fkey"
    FOREIGN KEY ("restoredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
