-- CP-TODO-253 (CP-FR-062): contribution fact execution — one ACTIVE fact per
-- natural key (person × contributionType × source) so adapters never
-- double-count; correction chains keep history; indexes for scoped reads.
-- All additive; existing tables and behaviors unchanged.

CREATE UNIQUE INDEX IF NOT EXISTS "contribution_facts_active_natural_key"
  ON "contribution_facts"("personId", "contributionType", "sourceType", "sourceId")
  WHERE "status" = 'ACTIVE';
ALTER TABLE "contribution_facts" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "contribution_facts_programmeId_status_idx" ON "contribution_facts"("programmeId", "status");
CREATE INDEX IF NOT EXISTS "contribution_facts_correctionOfId_idx" ON "contribution_facts"("correctionOfId");
