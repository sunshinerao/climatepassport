DO $$ BEGIN
  CREATE TYPE "AchievementType" AS ENUM (
    'LEARNING',
    'EVENT',
    'PROJECT',
    'CONTRIBUTION',
    'COMMUNICATION',
    'VERIFIED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AchievementStatus" AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'REVOKED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AchievementVerificationLevel" AS ENUM (
    'SELF_RECORDED',
    'SYSTEM_RECORDED',
    'PLATFORM_VERIFIED',
    'INSTITUTION_VERIFIED',
    'EXPERT_REVIEWED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AchievementSourceType" AS ENUM (
    'USER_SUBMISSION',
    'SYSTEM_EVENT',
    'COURSE_COMPLETION',
    'EVENT_REGISTRATION',
    'EVENT_CHECKIN',
    'PROJECT_SUBMISSION',
    'ADMIN_CREATED',
    'INSTITUTION_IMPORT',
    'CERTIFICATE_ISSUED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BadgeCategory" AS ENUM (
    'PARTICIPATION',
    'LEARNING',
    'CAPABILITY',
    'ROLE',
    'CONTRIBUTION',
    'IMPACT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BadgeLevel" AS ENUM (
    'EXPLORER',
    'LEARNER',
    'PRACTITIONER',
    'LEADER',
    'AMBASSADOR'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BadgeVerificationGrade" AS ENUM (
    'BASIC',
    'VERIFIED',
    'INSTITUTIONAL',
    'EXPERT_REVIEWED',
    'CREDENTIAL_GRADE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BadgeAwardStatus" AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'REVOKED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "achievements" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "AchievementType" NOT NULL,
  "status" "AchievementStatus" NOT NULL DEFAULT 'APPROVED',
  "verificationLevel" "AchievementVerificationLevel" NOT NULL DEFAULT 'SYSTEM_RECORDED',
  "sourceType" "AchievementSourceType",
  "sourceId" TEXT,
  "relatedCourseId" TEXT,
  "relatedEventId" TEXT,
  "relatedProjectId" TEXT,
  "relatedCertificateId" TEXT,
  "issuerName" TEXT,
  "issuerOrganization" TEXT,
  "validatorUserId" TEXT,
  "validatedAt" TIMESTAMP(3),
  "evidenceUrl" TEXT,
  "evidenceText" TEXT,
  "evidenceJson" JSONB,
  "points" INTEGER NOT NULL DEFAULT 0,
  "skillTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "topicTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sdgTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "isBadgeEligible" BOOLEAN NOT NULL DEFAULT true,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "badge_definitions" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameZh" TEXT,
  "description" TEXT,
  "descriptionZh" TEXT,
  "category" "BadgeCategory" NOT NULL,
  "level" "BadgeLevel",
  "verificationGrade" "BadgeVerificationGrade" NOT NULL DEFAULT 'BASIC',
  "issuerName" TEXT,
  "issuerOrganization" TEXT,
  "issuerLogoUrl" TEXT,
  "iconUrl" TEXT,
  "sealImageUrl" TEXT,
  "colorTheme" TEXT,
  "criteriaText" TEXT,
  "criteriaJson" JSONB,
  "requiredPoints" INTEGER,
  "requiredAchievementTypes" "AchievementType"[] DEFAULT ARRAY[]::"AchievementType"[],
  "requiredAchievementIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "requiredSkillTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "requiredTopicTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "minVerificationLevel" "AchievementVerificationLevel",
  "validityDays" INTEGER,
  "isRenewable" BOOLEAN NOT NULL DEFAULT false,
  "renewalCriteriaJson" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "badge_awards" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "badgeDefinitionId" TEXT NOT NULL,
  "status" "BadgeAwardStatus" NOT NULL DEFAULT 'ACTIVE',
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  "awardedByUserId" TEXT,
  "awardedByOrgName" TEXT,
  "verificationUrl" TEXT,
  "verificationToken" TEXT,
  "evidenceSnapshotJson" JSONB,
  "relatedAchievementIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "badge_awards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "badge_definitions_code_key" ON "badge_definitions"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "badge_awards_verificationToken_key" ON "badge_awards"("verificationToken");

CREATE INDEX IF NOT EXISTS "achievements_userId_createdAt_idx" ON "achievements"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "achievements_type_status_idx" ON "achievements"("type", "status");
CREATE INDEX IF NOT EXISTS "achievements_verificationLevel_idx" ON "achievements"("verificationLevel");
CREATE INDEX IF NOT EXISTS "achievements_sourceType_sourceId_idx" ON "achievements"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "badge_definitions_isActive_displayOrder_idx" ON "badge_definitions"("isActive", "displayOrder");
CREATE INDEX IF NOT EXISTS "badge_definitions_category_level_idx" ON "badge_definitions"("category", "level");
CREATE INDEX IF NOT EXISTS "badge_awards_userId_awardedAt_idx" ON "badge_awards"("userId", "awardedAt");
CREATE INDEX IF NOT EXISTS "badge_awards_badgeDefinitionId_status_idx" ON "badge_awards"("badgeDefinitionId", "status");

DO $$ BEGIN
  ALTER TABLE "achievements"
    ADD CONSTRAINT "achievements_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "badge_awards"
    ADD CONSTRAINT "badge_awards_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "badge_awards"
    ADD CONSTRAINT "badge_awards_badgeDefinitionId_fkey"
    FOREIGN KEY ("badgeDefinitionId") REFERENCES "badge_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
