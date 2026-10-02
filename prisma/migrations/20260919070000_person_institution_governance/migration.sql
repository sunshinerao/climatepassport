-- CP-TODO-242: person claim / institution representation governance.
-- Additive merge-alias columns (original references stay resolvable via merge chain).
-- InstitutionRepresentation tables themselves were created in
-- 20260919060000_multi_programme_scope_foundation; this migration only adds
-- the merge-graph columns and their indexes/foreign keys.

ALTER TABLE "people" ADD COLUMN "mergedIntoId" TEXT;
ALTER TABLE "institutions" ADD COLUMN "mergedIntoId" TEXT;

CREATE INDEX "people_mergedIntoId_idx" ON "people"("mergedIntoId");
CREATE INDEX "institutions_mergedIntoId_idx" ON "institutions"("mergedIntoId");

ALTER TABLE "people" ADD CONSTRAINT "people_mergedIntoId_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_mergedIntoId_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
