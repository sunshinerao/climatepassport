-- V2.1 multi-programme scope foundation (CP-TODO-241).
-- Field ownership: docs/FIELD_OWNERSHIP_AND_SCOPE_ADR_V21_20260919.md
-- All changes are additive; existing rows and summer-school behavior are untouched.

DO $$ BEGIN
  CREATE TYPE "ScopedAccessRole" AS ENUM ('PROGRAMME_ADMIN', 'PROGRAMME_OPERATOR', 'PROGRAMME_VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ScopedAccessAction" AS ENUM ('READ', 'WRITE', 'MANAGE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RepresentationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ChannelClientType" AS ENUM ('USER_FACING', 'MACHINE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SourceMappingStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameEn" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "programmes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameEn" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "programmes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "editions" (
  "id" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameEn" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "editions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "access_memberships" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "editionId" TEXT,
  "role" "ScopedAccessRole" NOT NULL,
  "grantorUserId" TEXT,
  "basisJson" JSONB,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "access_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "object_authorizations" (
  "id" TEXT NOT NULL,
  "subjectUserId" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "editionId" TEXT,
  "action" "ScopedAccessAction" NOT NULL,
  "purpose" TEXT,
  "grantorUserId" TEXT NOT NULL,
  "basisJson" JSONB,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "object_authorizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "institution_representations" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "editionId" TEXT,
  "actionScope" TEXT[],
  "grantorUserId" TEXT,
  "status" "RepresentationStatus" NOT NULL DEFAULT 'ACTIVE',
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "basisJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "institution_representations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "channel_clients" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "type" "ChannelClientType" NOT NULL,
  "programmeId" TEXT NOT NULL,
  "machineKeyRef" TEXT,
  "allowedOrigins" TEXT[],
  "allowedScopes" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "channel_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "source_object_mappings" (
  "id" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "editionId" TEXT,
  "sourceSystem" TEXT NOT NULL,
  "sourceEditionRef" TEXT NOT NULL DEFAULT '',
  "sourceObjectId" TEXT NOT NULL,
  "activityId" TEXT,
  "sourceVersion" TEXT,
  "authoritativeFieldsJson" JSONB,
  "applyStatus" "SourceMappingStatus" NOT NULL DEFAULT 'ACTIVE',
  "idempotencyKey" TEXT,
  "receiptJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "source_object_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_key_key" ON "tenants"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "programmes_key_key" ON "programmes"("key");
CREATE INDEX IF NOT EXISTS "programmes_tenantId_idx" ON "programmes"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "editions_programmeId_key_key" ON "editions"("programmeId", "key");

CREATE UNIQUE INDEX IF NOT EXISTS "access_memberships_userId_programmeId_editionId_role_key"
  ON "access_memberships"("userId", "programmeId", "editionId", "role");
CREATE INDEX IF NOT EXISTS "access_memberships_userId_isActive_idx" ON "access_memberships"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "access_memberships_programmeId_role_idx" ON "access_memberships"("programmeId", "role");

CREATE INDEX IF NOT EXISTS "object_authorizations_subjectUserId_objectType_objectId_isActive_idx"
  ON "object_authorizations"("subjectUserId", "objectType", "objectId", "isActive");
CREATE INDEX IF NOT EXISTS "object_authorizations_programmeId_objectType_idx"
  ON "object_authorizations"("programmeId", "objectType");

CREATE INDEX IF NOT EXISTS "institution_representations_institutionId_status_idx" ON "institution_representations"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "institution_representations_userId_status_idx" ON "institution_representations"("userId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "channel_clients_key_key" ON "channel_clients"("key");

CREATE UNIQUE INDEX IF NOT EXISTS "source_object_mappings_sourceSystem_sourceEditionRef_sourceObjectId_key"
  ON "source_object_mappings"("sourceSystem", "sourceEditionRef", "sourceObjectId");
CREATE UNIQUE INDEX IF NOT EXISTS "source_object_mappings_idempotencyKey_key" ON "source_object_mappings"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "source_object_mappings_activityId_applyStatus_idx"
  ON "source_object_mappings"("activityId", "applyStatus");

DO $$ BEGIN
  ALTER TABLE "programmes"
    ADD CONSTRAINT "programmes_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "editions"
    ADD CONSTRAINT "editions_programmeId_fkey"
    FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "access_memberships"
    ADD CONSTRAINT "access_memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "access_memberships"
    ADD CONSTRAINT "access_memberships_grantorUserId_fkey"
    FOREIGN KEY ("grantorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "access_memberships"
    ADD CONSTRAINT "access_memberships_programmeId_fkey"
    FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "access_memberships"
    ADD CONSTRAINT "access_memberships_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "object_authorizations"
    ADD CONSTRAINT "object_authorizations_subjectUserId_fkey"
    FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "object_authorizations"
    ADD CONSTRAINT "object_authorizations_grantorUserId_fkey"
    FOREIGN KEY ("grantorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "object_authorizations"
    ADD CONSTRAINT "object_authorizations_programmeId_fkey"
    FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "object_authorizations"
    ADD CONSTRAINT "object_authorizations_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "institution_representations"
    ADD CONSTRAINT "institution_representations_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "institution_representations"
    ADD CONSTRAINT "institution_representations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "institution_representations"
    ADD CONSTRAINT "institution_representations_programmeId_fkey"
    FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "institution_representations"
    ADD CONSTRAINT "institution_representations_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "institution_representations"
    ADD CONSTRAINT "institution_representations_grantorUserId_fkey"
    FOREIGN KEY ("grantorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "channel_clients"
    ADD CONSTRAINT "channel_clients_programmeId_fkey"
    FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "source_object_mappings"
    ADD CONSTRAINT "source_object_mappings_programmeId_fkey"
    FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "source_object_mappings"
    ADD CONSTRAINT "source_object_mappings_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "source_object_mappings"
    ADD CONSTRAINT "source_object_mappings_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
