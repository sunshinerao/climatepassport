-- CP-TODO-247: object-level sharing also serves personal (non-programme) records.
-- programmeId becomes optional; null = personal object grant. Pure widening, additive
-- in behaviour; scoped objects keep their programmeId as before.

ALTER TABLE "object_authorizations" ALTER COLUMN "programmeId" DROP NOT NULL;
