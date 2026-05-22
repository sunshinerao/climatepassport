-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('VISITOR', 'ATTENDEE', 'ORGANIZATION', 'SPONSOR', 'SPEAKER', 'MEDIA', 'ADMIN', 'EVENT_MANAGER', 'SPECIAL_PASS_MANAGER', 'STAFF', 'VERIFIER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING_APPROVAL', 'REGISTERED', 'CANCELLED', 'ATTENDED', 'WAITLIST', 'REJECTED');

-- CreateEnum
CREATE TYPE "EventLayer" AS ENUM ('INSTITUTION', 'ECONOMY', 'ROOT', 'ACCELERATOR', 'COMPREHENSIVE');

-- CreateEnum
CREATE TYPE "EventHostType" AS ENUM ('OFFICIAL', 'CO_HOSTED', 'REGISTERED', 'SIDE_EVENT', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'UPLOADED', 'DOWNLOADED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SpecialPassStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SpecialPassEntryType" AS ENUM ('DOMESTIC', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "ContactCategory" AS ENUM ('GENERAL', 'ORGANIZATION', 'PARTNERSHIP', 'SPEAKER', 'MEDIA', 'SPONSOR', 'VOLUNTEER', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactMessageStatus" AS ENUM ('PENDING', 'REPLIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'DELIVERED', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('REGISTRATION', 'ATTENDANCE', 'CERTIFICATE', 'INVITATION', 'SPECIAL_PASS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CertificateTemplateType" AS ENUM ('ATTENDANCE', 'LEARNING', 'ACHIEVEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CertificateVerificationMode" AS ENUM ('PUBLIC_CODE', 'INTERNAL_ONLY', 'QR_CODE');

-- CreateEnum
CREATE TYPE "CertificateIssueStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'GENERATED', 'ISSUED', 'REVOKED');

-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('VALID', 'INVALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "ChannelKey" AS ENUM ('SHCW');

-- CreateEnum
CREATE TYPE "LearningExperienceProgramStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LearningExperienceApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW', 'OFFERED', 'WAITLISTED', 'ACCEPTED', 'REJECTED', 'ENROLLED', 'COMPLETED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LearningExperienceParticipationStatus" AS ENUM ('ADMITTED', 'ACTIVE', 'COMPLETED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salutation" TEXT,
    "avatar" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "bio" TEXT,
    "country" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ATTENDEE',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "staffPermissions" TEXT,
    "passCode" TEXT NOT NULL,
    "climatePassportId" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "emailVerified" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "website" TEXT,
    "description" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "category" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "partners" JSONB,
    "partnersEn" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "shortName" TEXT,
    "shortNameEn" TEXT,
    "logo" TEXT,
    "website" TEXT,
    "orgType" TEXT,
    "countryOrRegion" TEXT,
    "countryOrRegionEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "shortDesc" TEXT,
    "shortDescEn" TEXT,
    "highlights" JSONB,
    "highlightsEn" JSONB,
    "highlightsGeneratedAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "venueEn" TEXT,
    "address" TEXT,
    "addressEn" TEXT,
    "city" TEXT,
    "cityEn" TEXT,
    "image" TEXT,
    "partners" JSONB,
    "partnersEn" JSONB,
    "type" TEXT NOT NULL,
    "eventLayer" "EventLayer",
    "hostType" "EventHostType",
    "trackId" TEXT,
    "managerUserId" TEXT,
    "venueCheckinSecret" TEXT,
    "invitationContentHtml_zh" TEXT,
    "invitationContentHtml_en" TEXT,
    "maxAttendees" INTEGER,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_institutions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "roleLabel" TEXT,
    "roleLabelEn" TEXT,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_verifiers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_verifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_date_slots" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "scheduleDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_date_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "notes" TEXT,
    "dietaryReq" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" TEXT,
    "checkInMethod" TEXT,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "eventId" TEXT,
    "registrationId" TEXT,
    "description" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speakers" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "salutation" TEXT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "avatar" TEXT,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "organization" TEXT NOT NULL,
    "organizationEn" TEXT,
    "organizationLogo" TEXT,
    "bio" TEXT,
    "bioEn" TEXT,
    "summary" TEXT,
    "summaryEn" TEXT,
    "countryOrRegion" TEXT,
    "countryOrRegionEn" TEXT,
    "relevanceToShcw" TEXT,
    "relevanceToShcwEn" TEXT,
    "expertiseTags" JSONB,
    "email" TEXT,
    "linkedin" TEXT,
    "twitter" TEXT,
    "website" TEXT,
    "isKeynote" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "agendaRoleDisplayMode" TEXT NOT NULL DEFAULT 'allCurrent',
    "institutionId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaker_roles" (
    "id" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "organization" TEXT NOT NULL,
    "organizationEn" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speaker_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_items" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "agendaDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "type" TEXT NOT NULL,
    "venue" TEXT,
    "speakerMeta" JSONB,
    "moderatorId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "scannedBy" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salutation" TEXT,
    "guestName" TEXT NOT NULL,
    "guestTitle" TEXT,
    "guestOrg" TEXT,
    "guestEmail" TEXT,
    "language" TEXT NOT NULL DEFAULT 'zh',
    "eventId" TEXT,
    "purpose" TEXT,
    "notes" TEXT,
    "customMainContent" TEXT,
    "aiEnhancedBodyZh" TEXT,
    "aiEnhancedBodyEn" TEXT,
    "signaturePresetId" TEXT,
    "useStamp" BOOLEAN NOT NULL DEFAULT false,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "letterFileUrl" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_passes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryType" "SpecialPassEntryType" NOT NULL,
    "status" "SpecialPassStatus" NOT NULL DEFAULT 'PENDING',
    "country" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "docValidFrom" TEXT NOT NULL,
    "docValidTo" TEXT NOT NULL,
    "docPhoto" TEXT,
    "docPhotoBack" TEXT,
    "photo" TEXT,
    "organization" TEXT,
    "jobTitle" TEXT,
    "docType" TEXT,
    "email" TEXT,
    "phoneArea" TEXT,
    "phone" TEXT,
    "contactMethod" TEXT,
    "contactValue" TEXT,
    "adminNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "organization" TEXT,
    "userId" TEXT,
    "category" "ContactCategory" NOT NULL DEFAULT 'GENERAL',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "ContactMessageStatus" NOT NULL DEFAULT 'PENDING',
    "adminReply" TEXT,
    "adminNotes" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "marketingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "kind" "NotificationKind" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "body" TEXT NOT NULL,
    "bodyEn" TEXT,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "pointThreshold" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievement_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementDefinitionId" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "certificateIssueId" TEXT,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passport_milestones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "eventId" TEXT,
    "certificateIssueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passport_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "templateType" "CertificateTemplateType" NOT NULL,
    "templateConfigJson" JSONB NOT NULL,
    "renderConfigJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_definitions" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "achievementDefinitionId" TEXT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "issueRule" JSONB,
    "approvalMode" TEXT NOT NULL DEFAULT 'auto',
    "verificationMode" "CertificateVerificationMode" NOT NULL DEFAULT 'PUBLIC_CODE',
    "pointReward" INTEGER,
    "milestoneTitleTemplate" TEXT,
    "milestoneTitleTemplateEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_issues" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "status" "CertificateIssueStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedFileUrl" TEXT,
    "generatedFileName" TEXT,
    "verificationCode" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "pointsAwarded" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_verifications" (
    "id" TEXT NOT NULL,
    "certificateIssueId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" TEXT,
    "verificationChannel" TEXT NOT NULL,
    "result" "VerificationResult" NOT NULL DEFAULT 'VALID',
    "metadataJson" JSONB,

    CONSTRAINT "certificate_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_session_bridges" (
    "id" TEXT NOT NULL,
    "channel" "ChannelKey" NOT NULL DEFAULT 'SHCW',
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetPath" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_session_bridges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_experience_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_experience_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_experience_programs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "managerUserId" TEXT,
    "certificateDefinitionId" TEXT,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "summary" TEXT,
    "summaryEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "location" TEXT,
    "locationEn" TEXT,
    "applicationOpenAt" TIMESTAMP(3),
    "applicationCloseAt" TIMESTAMP(3),
    "cohortStartAt" TIMESTAMP(3),
    "cohortEndAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "pointReward" INTEGER,
    "status" "LearningExperienceProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "applicationSchemaJson" JSONB,
    "programConfigJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_experience_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_experience_stages" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDecisionStage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_experience_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_experience_applications" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStageId" TEXT,
    "status" "LearningExperienceApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "answersJson" JSONB,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_experience_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_experience_participations" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "certificateIssueId" TEXT,
    "status" "LearningExperienceParticipationStatus" NOT NULL DEFAULT 'ADMITTED',
    "completionPercent" INTEGER NOT NULL DEFAULT 0,
    "mentorReviewJson" JSONB,
    "outcomeSummary" TEXT,
    "outcomeSummaryEn" TEXT,
    "pointsAwarded" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_experience_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_experience_program_event_links" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL,
    "title" TEXT,
    "titleEn" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_experience_program_event_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summer_school_applications" (
    "id" TEXT NOT NULL,
    "projectSlug" TEXT NOT NULL,
    "projectType" TEXT,
    "applicationStatus" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT,
    "phone" TEXT,
    "guardianName" TEXT,
    "guardianEmail" TEXT,
    "guardianPhone" TEXT,
    "channel" TEXT,
    "climatePassportId" TEXT NOT NULL,
    "userId" TEXT,
    "learningExperienceProgramId" TEXT,
    "learningExperienceApplicationId" TEXT,
    "answersJson" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "summer_school_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AgendaItemToSpeaker" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_passCode_key" ON "users"("passCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_climatePassportId_key" ON "users"("climatePassportId");

-- CreateIndex
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_passCode_idx" ON "users"("passCode");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_userId_key" ON "organizations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_code_key" ON "tracks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_slug_key" ON "institutions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "events_venueCheckinSecret_key" ON "events"("venueCheckinSecret");

-- CreateIndex
CREATE INDEX "events_startDate_idx" ON "events"("startDate");

-- CreateIndex
CREATE INDEX "events_trackId_idx" ON "events"("trackId");

-- CreateIndex
CREATE INDEX "events_managerUserId_idx" ON "events"("managerUserId");

-- CreateIndex
CREATE INDEX "events_isPinned_startDate_startTime_idx" ON "events"("isPinned", "startDate", "startTime");

-- CreateIndex
CREATE INDEX "event_institutions_eventId_order_idx" ON "event_institutions"("eventId", "order");

-- CreateIndex
CREATE INDEX "event_institutions_institutionId_idx" ON "event_institutions"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "event_institutions_eventId_institutionId_key" ON "event_institutions"("eventId", "institutionId");

-- CreateIndex
CREATE INDEX "event_verifiers_userId_idx" ON "event_verifiers"("userId");

-- CreateIndex
CREATE INDEX "event_verifiers_eventId_idx" ON "event_verifiers"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_verifiers_userId_eventId_key" ON "event_verifiers"("userId", "eventId");

-- CreateIndex
CREATE INDEX "event_date_slots_eventId_scheduleDate_idx" ON "event_date_slots"("eventId", "scheduleDate");

-- CreateIndex
CREATE UNIQUE INDEX "event_date_slots_eventId_scheduleDate_key" ON "event_date_slots"("eventId", "scheduleDate");

-- CreateIndex
CREATE INDEX "registrations_userId_idx" ON "registrations"("userId");

-- CreateIndex
CREATE INDEX "registrations_eventId_idx" ON "registrations"("eventId");

-- CreateIndex
CREATE INDEX "registrations_checkedInBy_idx" ON "registrations"("checkedInBy");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_userId_eventId_key" ON "registrations"("userId", "eventId");

-- CreateIndex
CREATE INDEX "wishlists_userId_idx" ON "wishlists"("userId");

-- CreateIndex
CREATE INDEX "wishlists_eventId_idx" ON "wishlists"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_userId_eventId_key" ON "wishlists"("userId", "eventId");

-- CreateIndex
CREATE INDEX "point_transactions_userId_idx" ON "point_transactions"("userId");

-- CreateIndex
CREATE INDEX "point_transactions_type_idx" ON "point_transactions"("type");

-- CreateIndex
CREATE INDEX "point_transactions_createdAt_idx" ON "point_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "speakers_slug_key" ON "speakers"("slug");

-- CreateIndex
CREATE INDEX "agenda_items_eventId_idx" ON "agenda_items"("eventId");

-- CreateIndex
CREATE INDEX "agenda_items_eventId_agendaDate_idx" ON "agenda_items"("eventId", "agendaDate");

-- CreateIndex
CREATE INDEX "agenda_items_moderatorId_idx" ON "agenda_items"("moderatorId");

-- CreateIndex
CREATE INDEX "checkins_userId_idx" ON "checkins"("userId");

-- CreateIndex
CREATE INDEX "checkins_eventId_idx" ON "checkins"("eventId");

-- CreateIndex
CREATE INDEX "checkins_scannedBy_idx" ON "checkins"("scannedBy");

-- CreateIndex
CREATE INDEX "invitation_requests_userId_idx" ON "invitation_requests"("userId");

-- CreateIndex
CREATE INDEX "invitation_requests_status_idx" ON "invitation_requests"("status");

-- CreateIndex
CREATE INDEX "invitation_requests_eventId_idx" ON "invitation_requests"("eventId");

-- CreateIndex
CREATE INDEX "special_passes_userId_idx" ON "special_passes"("userId");

-- CreateIndex
CREATE INDEX "special_passes_status_idx" ON "special_passes"("status");

-- CreateIndex
CREATE INDEX "special_passes_entryType_idx" ON "special_passes"("entryType");

-- CreateIndex
CREATE INDEX "contact_messages_category_idx" ON "contact_messages"("category");

-- CreateIndex
CREATE INDEX "contact_messages_status_idx" ON "contact_messages"("status");

-- CreateIndex
CREATE INDEX "contact_messages_userId_idx" ON "contact_messages"("userId");

-- CreateIndex
CREATE INDEX "contact_messages_createdAt_idx" ON "contact_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "notifications_kind_idx" ON "notifications"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_definitions_key_key" ON "achievement_definitions"("key");

-- CreateIndex
CREATE INDEX "user_achievements_userId_idx" ON "user_achievements"("userId");

-- CreateIndex
CREATE INDEX "user_achievements_achievementDefinitionId_idx" ON "user_achievements"("achievementDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementDefinitionId_sourceId_key" ON "user_achievements"("userId", "achievementDefinitionId", "sourceId");

-- CreateIndex
CREATE INDEX "passport_milestones_userId_idx" ON "passport_milestones"("userId");

-- CreateIndex
CREATE INDEX "passport_milestones_eventId_idx" ON "passport_milestones"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_categories_key_key" ON "certificate_categories"("key");

-- CreateIndex
CREATE INDEX "certificate_templates_categoryId_isActive_idx" ON "certificate_templates"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "certificate_definitions_categoryId_isActive_idx" ON "certificate_definitions"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "certificate_definitions_templateId_idx" ON "certificate_definitions"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_issues_verificationCode_key" ON "certificate_issues"("verificationCode");

-- CreateIndex
CREATE INDEX "certificate_issues_definitionId_idx" ON "certificate_issues"("definitionId");

-- CreateIndex
CREATE INDEX "certificate_issues_userId_idx" ON "certificate_issues"("userId");

-- CreateIndex
CREATE INDEX "certificate_issues_status_idx" ON "certificate_issues"("status");

-- CreateIndex
CREATE INDEX "certificate_verifications_certificateIssueId_idx" ON "certificate_verifications"("certificateIssueId");

-- CreateIndex
CREATE INDEX "certificate_verifications_verifiedAt_idx" ON "certificate_verifications"("verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "channel_session_bridges_tokenHash_key" ON "channel_session_bridges"("tokenHash");

-- CreateIndex
CREATE INDEX "channel_session_bridges_channel_expiresAt_idx" ON "channel_session_bridges"("channel", "expiresAt");

-- CreateIndex
CREATE INDEX "channel_session_bridges_userId_createdAt_idx" ON "channel_session_bridges"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "learning_experience_categories_slug_key" ON "learning_experience_categories"("slug");

-- CreateIndex
CREATE INDEX "learning_experience_categories_order_idx" ON "learning_experience_categories"("order");

-- CreateIndex
CREATE UNIQUE INDEX "learning_experience_programs_slug_key" ON "learning_experience_programs"("slug");

-- CreateIndex
CREATE INDEX "learning_experience_programs_categoryId_status_idx" ON "learning_experience_programs"("categoryId", "status");

-- CreateIndex
CREATE INDEX "learning_experience_programs_managerUserId_idx" ON "learning_experience_programs"("managerUserId");

-- CreateIndex
CREATE INDEX "learning_experience_programs_isPublished_applicationOpenAt_idx" ON "learning_experience_programs"("isPublished", "applicationOpenAt");

-- CreateIndex
CREATE INDEX "learning_experience_stages_programId_order_idx" ON "learning_experience_stages"("programId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "learning_experience_stages_programId_key_key" ON "learning_experience_stages"("programId", "key");

-- CreateIndex
CREATE INDEX "learning_experience_applications_userId_status_idx" ON "learning_experience_applications"("userId", "status");

-- CreateIndex
CREATE INDEX "learning_experience_applications_programId_status_idx" ON "learning_experience_applications"("programId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "learning_experience_applications_programId_userId_key" ON "learning_experience_applications"("programId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_experience_participations_applicationId_key" ON "learning_experience_participations"("applicationId");

-- CreateIndex
CREATE INDEX "learning_experience_participations_userId_status_idx" ON "learning_experience_participations"("userId", "status");

-- CreateIndex
CREATE INDEX "learning_experience_participations_programId_status_idx" ON "learning_experience_participations"("programId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "learning_experience_participations_programId_userId_key" ON "learning_experience_participations"("programId", "userId");

-- CreateIndex
CREATE INDEX "learning_experience_program_event_links_eventId_idx" ON "learning_experience_program_event_links"("eventId");

-- CreateIndex
CREATE INDEX "learning_experience_program_event_links_programId_order_idx" ON "learning_experience_program_event_links"("programId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "learning_experience_program_event_links_programId_eventId_l_key" ON "learning_experience_program_event_links"("programId", "eventId", "linkType");

-- CreateIndex
CREATE INDEX "summer_school_applications_email_idx" ON "summer_school_applications"("email");

-- CreateIndex
CREATE INDEX "summer_school_applications_climatePassportId_idx" ON "summer_school_applications"("climatePassportId");

-- CreateIndex
CREATE INDEX "summer_school_applications_userId_idx" ON "summer_school_applications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "summer_school_applications_projectSlug_email_key" ON "summer_school_applications"("projectSlug", "email");

-- CreateIndex
CREATE UNIQUE INDEX "_AgendaItemToSpeaker_AB_unique" ON "_AgendaItemToSpeaker"("A", "B");

-- CreateIndex
CREATE INDEX "_AgendaItemToSpeaker_B_index" ON "_AgendaItemToSpeaker"("B");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_institutions" ADD CONSTRAINT "event_institutions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_institutions" ADD CONSTRAINT "event_institutions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_verifiers" ADD CONSTRAINT "event_verifiers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_verifiers" ADD CONSTRAINT "event_verifiers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_date_slots" ADD CONSTRAINT "event_date_slots_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker_roles" ADD CONSTRAINT "speaker_roles_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "speakers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_requests" ADD CONSTRAINT "invitation_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_requests" ADD CONSTRAINT "invitation_requests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_passes" ADD CONSTRAINT "special_passes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementDefinitionId_fkey" FOREIGN KEY ("achievementDefinitionId") REFERENCES "achievement_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_certificateIssueId_fkey" FOREIGN KEY ("certificateIssueId") REFERENCES "certificate_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_milestones" ADD CONSTRAINT "passport_milestones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_milestones" ADD CONSTRAINT "passport_milestones_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_milestones" ADD CONSTRAINT "passport_milestones_certificateIssueId_fkey" FOREIGN KEY ("certificateIssueId") REFERENCES "certificate_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "certificate_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_definitions" ADD CONSTRAINT "certificate_definitions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "certificate_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_definitions" ADD CONSTRAINT "certificate_definitions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "certificate_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_definitions" ADD CONSTRAINT "certificate_definitions_achievementDefinitionId_fkey" FOREIGN KEY ("achievementDefinitionId") REFERENCES "achievement_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_issues" ADD CONSTRAINT "certificate_issues_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "certificate_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_issues" ADD CONSTRAINT "certificate_issues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_issues" ADD CONSTRAINT "certificate_issues_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_verifications" ADD CONSTRAINT "certificate_verifications_certificateIssueId_fkey" FOREIGN KEY ("certificateIssueId") REFERENCES "certificate_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_verifications" ADD CONSTRAINT "certificate_verifications_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_session_bridges" ADD CONSTRAINT "channel_session_bridges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_programs" ADD CONSTRAINT "learning_experience_programs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "learning_experience_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_programs" ADD CONSTRAINT "learning_experience_programs_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_programs" ADD CONSTRAINT "learning_experience_programs_certificateDefinitionId_fkey" FOREIGN KEY ("certificateDefinitionId") REFERENCES "certificate_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_stages" ADD CONSTRAINT "learning_experience_stages_programId_fkey" FOREIGN KEY ("programId") REFERENCES "learning_experience_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_applications" ADD CONSTRAINT "learning_experience_applications_programId_fkey" FOREIGN KEY ("programId") REFERENCES "learning_experience_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_applications" ADD CONSTRAINT "learning_experience_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_applications" ADD CONSTRAINT "learning_experience_applications_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "learning_experience_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_participations" ADD CONSTRAINT "learning_experience_participations_programId_fkey" FOREIGN KEY ("programId") REFERENCES "learning_experience_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_participations" ADD CONSTRAINT "learning_experience_participations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_participations" ADD CONSTRAINT "learning_experience_participations_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "learning_experience_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_participations" ADD CONSTRAINT "learning_experience_participations_certificateIssueId_fkey" FOREIGN KEY ("certificateIssueId") REFERENCES "certificate_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_program_event_links" ADD CONSTRAINT "learning_experience_program_event_links_programId_fkey" FOREIGN KEY ("programId") REFERENCES "learning_experience_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_experience_program_event_links" ADD CONSTRAINT "learning_experience_program_event_links_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summer_school_applications" ADD CONSTRAINT "summer_school_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summer_school_applications" ADD CONSTRAINT "summer_school_applications_learningExperienceProgramId_fkey" FOREIGN KEY ("learningExperienceProgramId") REFERENCES "learning_experience_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summer_school_applications" ADD CONSTRAINT "summer_school_applications_learningExperienceApplicationId_fkey" FOREIGN KEY ("learningExperienceApplicationId") REFERENCES "learning_experience_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgendaItemToSpeaker" ADD CONSTRAINT "_AgendaItemToSpeaker_A_fkey" FOREIGN KEY ("A") REFERENCES "agenda_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgendaItemToSpeaker" ADD CONSTRAINT "_AgendaItemToSpeaker_B_fkey" FOREIGN KEY ("B") REFERENCES "speakers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

