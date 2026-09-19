-- Additive, local-only Phase 3 Person/Institution compatibility master-data package.
-- Creates no drops, renames, or recruitment/matching/public-directory surfaces.

CREATE TYPE "PersonVerificationStatus" AS ENUM ('DRAFT', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "PersonAffiliationStatus" AS ENUM ('ACTIVE', 'ENDED', 'PENDING');
CREATE TYPE "PersonRoleType" AS ENUM ('SPEAKER', 'MODERATOR', 'PANELIST', 'MENTOR', 'ORGANIZER', 'PARTNER', 'MEDIA', 'VOLUNTEER', 'STAFF', 'OTHER');
CREATE TYPE "InstitutionVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED');

CREATE TABLE "people" (
  "id" TEXT NOT NULL,
  "slug" TEXT,
  "displayName" TEXT NOT NULL,
  "displayNameEn" TEXT,
  "salutation" TEXT,
  "title" TEXT,
  "titleEn" TEXT,
  "bio" TEXT,
  "bioEn" TEXT,
  "countryOrRegion" TEXT,
  "countryOrRegionEn" TEXT,
  "avatar" TEXT,
  "website" TEXT,
  "linkedin" TEXT,
  "twitter" TEXT,
  "orcid" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "PersonVerificationStatus" NOT NULL DEFAULT 'DRAFT',
  "verificationMetadata" JSONB,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "people_slug_key" ON "people"("slug");
CREATE UNIQUE INDEX "people_userId_key" ON "people"("userId");
CREATE INDEX "people_verificationStatus_idx" ON "people"("verificationStatus");
CREATE INDEX "people_displayName_idx" ON "people"("displayName");

CREATE TABLE "person_affiliations" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "institutionId" TEXT,
  "organizationName" TEXT,
  "organizationNameEn" TEXT,
  "department" TEXT,
  "title" TEXT,
  "titleEn" TEXT,
  "startYear" INTEGER,
  "endYear" INTEGER,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "status" "PersonAffiliationStatus" NOT NULL DEFAULT 'ACTIVE',
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "person_affiliations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "person_affiliations_personId_idx" ON "person_affiliations"("personId");
CREATE INDEX "person_affiliations_institutionId_idx" ON "person_affiliations"("institutionId");

CREATE TABLE "person_role_profiles" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "roleType" "PersonRoleType" NOT NULL,
  "roleTitle" TEXT,
  "roleTitleEn" TEXT,
  "scopeInstitutionId" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "startYear" INTEGER,
  "endYear" INTEGER,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "person_role_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "person_role_profiles_personId_roleType_idx" ON "person_role_profiles"("personId", "roleType");

ALTER TABLE "institutions"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "parentInstitutionId" TEXT,
  ADD COLUMN "governanceType" TEXT,
  ADD COLUMN "verificationStatus" "InstitutionVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "publicContactEmail" TEXT,
  ADD COLUMN "publicContactPhone" TEXT,
  ADD COLUMN "headquartersAddress" TEXT,
  ADD COLUMN "foundingYear" INTEGER;

CREATE INDEX "institutions_parentInstitutionId_idx" ON "institutions"("parentInstitutionId");
CREATE INDEX "institutions_verificationStatus_idx" ON "institutions"("verificationStatus");

ALTER TABLE "speakers"
  ADD COLUMN "personId" TEXT;

CREATE INDEX "speakers_personId_idx" ON "speakers"("personId");

ALTER TABLE "people" ADD CONSTRAINT "people_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "person_affiliations" ADD CONSTRAINT "person_affiliations_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_affiliations" ADD CONSTRAINT "person_affiliations_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "person_role_profiles" ADD CONSTRAINT "person_role_profiles_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_role_profiles" ADD CONSTRAINT "person_role_profiles_scopeInstitutionId_fkey" FOREIGN KEY ("scopeInstitutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_parentInstitutionId_fkey" FOREIGN KEY ("parentInstitutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
