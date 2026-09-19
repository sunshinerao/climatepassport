-- Phase 0 Event-only Invitation / Special Pass QR support
-- Adds explicit APPROVED invitation status and an optional Event binding to SpecialPass.
-- Historic SpecialPass rows remain unassociated (eventId left NULL).

DO $$ BEGIN
  ALTER TYPE "InvitationStatus" ADD VALUE 'APPROVED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "special_passes" ADD COLUMN IF NOT EXISTS "eventId" TEXT;

DO $$ BEGIN
  ALTER TABLE "special_passes"
    ADD CONSTRAINT "special_passes_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "special_passes_eventId_status_idx" ON "special_passes"("eventId", "status");
