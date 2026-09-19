-- CP-AUD-002: scrub raw certificate verification codes persisted in core audit logs.
--
-- Logs for found certificates already key on CertificateIssue.id in subjectId;
-- only the metadata payload carried the raw code. Preview and not-found logs
-- stored the raw scanned code (including attacker-supplied input) in subjectId.
-- Replace both with irreversible fingerprints so audit exports, backups and
-- log browsing never leak usable verification links. Migrated fingerprints use
-- md5 because it is a Postgres built-in; new application writes use fp:<sha256-16>.
-- Both forms are opaque, irreversible and only used for audit correlation.

UPDATE "core_audit_logs"
SET "metadataJson" = "metadataJson" - 'verificationCode'
WHERE "action" = 'certificate.verify.query'
  AND "metadataJson" ? 'verificationCode';

UPDATE "core_audit_logs"
SET "subjectId" = 'fp:' || md5("subjectId")
WHERE "action" = 'certificate.verify.query'
  AND "subjectType" = 'certificate_verification_code'
  AND "subjectId" IS NOT NULL
  AND "subjectId" <> ''
  AND "subjectId" NOT LIKE 'fp:%';
