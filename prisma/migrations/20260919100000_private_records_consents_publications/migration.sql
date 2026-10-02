-- Wave 1 (CP-TODO-247/248/249/250/251): generic private records with immutable
-- revisions, controlled assets with scan gates, immutable evidence versions,
-- purpose-scoped consents with guardian linkage, minimal external decision
-- receipts, and publication projections for the read gate.
-- All additive; no existing table or behavior changes.

CREATE TABLE IF NOT EXISTS "scoped_records" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "programmeId" TEXT,
  "recordType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "currentRevision" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT,
  "withdrawnAt" TIMESTAMP(3),
  "withdrawnById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scoped_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scoped_records_ownerUserId_recordType_idx" ON "scoped_records"("ownerUserId", "recordType");
CREATE INDEX "scoped_records_programmeId_recordType_idx" ON "scoped_records"("programmeId", "recordType");
ALTER TABLE "scoped_records" ADD CONSTRAINT "scoped_records_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scoped_records" ADD CONSTRAINT "scoped_records_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scoped_records" ADD CONSTRAINT "scoped_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "record_revisions" (
  "id" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "record_revisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "record_revisions_recordId_revision_key" ON "record_revisions"("recordId", "revision");
ALTER TABLE "record_revisions" ADD CONSTRAINT "record_revisions_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "scoped_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "record_revisions" ADD CONSTRAINT "record_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "controlled_assets" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'evidence',
  "scanStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "scanCheckedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "controlled_assets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "controlled_assets_storageKey_key" ON "controlled_assets"("storageKey");
CREATE INDEX "controlled_assets_ownerUserId_status_idx" ON "controlled_assets"("ownerUserId", "status");
ALTER TABLE "controlled_assets" ADD CONSTRAINT "controlled_assets_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "evidence_versions" (
  "id" TEXT NOT NULL,
  "recordId" TEXT,
  "assetId" TEXT,
  "derivedFromAssetId" TEXT,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "snapshotJson" JSONB NOT NULL,
  "createdById" TEXT,
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "evidence_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evidence_versions_recordId_version_key" ON "evidence_versions"("recordId", "version");
ALTER TABLE "evidence_versions" ADD CONSTRAINT "evidence_versions_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "scoped_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence_versions" ADD CONSTRAINT "evidence_versions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "controlled_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence_versions" ADD CONSTRAINT "evidence_versions_derivedFromAssetId_fkey" FOREIGN KEY ("derivedFromAssetId") REFERENCES "controlled_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence_versions" ADD CONSTRAINT "evidence_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "consent_records" (
  "id" TEXT NOT NULL,
  "subjectUserId" TEXT NOT NULL,
  "grantorUserId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "channel" TEXT,
  "programmeId" TEXT,
  "objectType" TEXT,
  "objectId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "guardianUserId" TEXT,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "evidenceJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "consent_records_subjectUserId_purpose_status_idx" ON "consent_records"("subjectUserId", "purpose", "status");
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_grantorUserId_fkey" FOREIGN KEY ("grantorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "external_decision_receipts" (
  "id" TEXT NOT NULL,
  "issuerKey" TEXT NOT NULL,
  "programmeId" TEXT,
  "objectType" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "objectRevision" INTEGER NOT NULL DEFAULT 1,
  "purpose" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "minimalJson" JSONB NOT NULL,
  "signature" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "external_decision_receipts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_decision_receipts_idempotencyKey_key" ON "external_decision_receipts"("idempotencyKey");
CREATE INDEX "external_decision_receipts_object_idx" ON "external_decision_receipts"("objectType", "objectId", "objectRevision");

CREATE TABLE IF NOT EXISTS "publication_projections" (
  "id" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "projectionJson" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "withdrawnById" TEXT,
  "dispatchId" TEXT,

  CONSTRAINT "publication_projections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "publication_projections_objectType_objectId_version_key" ON "publication_projections"("objectType", "objectId", "version");
CREATE INDEX "publication_projections_objectType_objectId_status_idx" ON "publication_projections"("objectType", "objectId", "status");
ALTER TABLE "publication_projections" ADD CONSTRAINT "publication_projections_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "publication_projections" ADD CONSTRAINT "publication_projections_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
