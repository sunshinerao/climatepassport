-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EVENT', 'LEARNING', 'CHALLENGE', 'PROJECT', 'TASK', 'COURSE');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "ActivityLocationType" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "ActivityApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ActivityParticipationStatus" AS ENUM ('REGISTERED', 'ACCEPTED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ABSENT', 'CERTIFIED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityRoleType" AS ENUM ('APPLICANT', 'PARTICIPANT', 'ATTENDEE', 'SPEAKER', 'MODERATOR', 'PANELIST', 'MENTOR', 'REVIEWER', 'VOLUNTEER', 'ORGANIZER', 'TEAM_LEADER', 'TEAM_MEMBER', 'LEARNER', 'INSTRUCTOR', 'PARTNER_REPRESENTATIVE', 'MEDIA');

-- CreateEnum
CREATE TYPE "ActivityTaskType" AS ENUM ('CHECK_IN', 'UPLOAD', 'QUIZ', 'REFLECTION', 'ATTENDANCE', 'SHARE', 'SURVEY', 'LEARNING_UNIT', 'PROJECT_MILESTONE', 'TEAM_ACTION');

-- CreateEnum
CREATE TYPE "ActivitySubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "ActivityCheckinMethod" AS ENUM ('QR_CODE', 'MANUAL', 'GEO', 'NFC', 'FACIAL');

-- CreateEnum
CREATE TYPE "ActivityCheckinStatus" AS ENUM ('VALID', 'DUPLICATE', 'INVALID', 'OUTSIDE_WINDOW', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ActivityRewardTrigger" AS ENUM ('REGISTRATION_APPROVED', 'CHECKIN_COMPLETED', 'TASK_COMPLETED', 'CONSECUTIVE_CHECKIN', 'SUBMISSION_APPROVED', 'COURSE_COMPLETED', 'PROJECT_COMPLETED', 'EXCELLENT_REVIEW', 'ROLE_ASSIGNED', 'REFERRAL_SUCCESS', 'PARTICIPATION_COMPLETED');

-- CreateEnum
CREATE TYPE "ActivityRewardType" AS ENUM ('POINTS', 'BADGE', 'CERTIFICATE', 'PASSPORT_ENTRY', 'LEADERBOARD', 'SKILL_TAG', 'NOTIFICATION');

-- CreateEnum
CREATE TYPE "ActivityReviewObjectType" AS ENUM ('APPLICATION', 'SUBMISSION', 'CHECKIN', 'CERTIFICATE_REQUEST', 'PROJECT_OUTPUT', 'VOLUNTEER_HOURS');

-- CreateEnum
CREATE TYPE "ActivityReviewType" AS ENUM ('AUTO', 'ADMIN', 'MENTOR', 'ORGANIZATION', 'EXPERT', 'MULTI_SCORE', 'PUBLIC_VOTE');

-- CreateEnum
CREATE TYPE "ActivityReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED');

-- AlterTable
ALTER TABLE "achievements" ALTER COLUMN "skillTags" DROP DEFAULT,
ALTER COLUMN "topicTags" DROP DEFAULT,
ALTER COLUMN "sdgTags" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "badge_awards" ALTER COLUMN "relatedAchievementIds" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "badge_definitions" ALTER COLUMN "requiredAchievementTypes" DROP DEFAULT,
ALTER COLUMN "requiredAchievementIds" DROP DEFAULT,
ALTER COLUMN "requiredSkillTags" DROP DEFAULT,
ALTER COLUMN "requiredTopicTags" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "passport_milestones" ADD COLUMN     "activityId" TEXT;

-- AlterTable
ALTER TABLE "point_transactions" ADD COLUMN     "activityId" TEXT;

-- AlterTable
ALTER TABLE "qr_tokens" ADD COLUMN     "activityId" TEXT;

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "subtitle" TEXT,
    "subtitleEn" TEXT,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "coverImage" TEXT,
    "summary" TEXT,
    "summaryEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "organizerUserId" TEXT,
    "organizerName" TEXT,
    "partnerIds" TEXT[],
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locationType" "ActivityLocationType",
    "locationJson" JSONB,
    "onlineUrl" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ActivityVisibility" NOT NULL DEFAULT 'PUBLIC',
    "capacity" INTEGER,
    "registrationOpenAt" TIMESTAMP(3),
    "registrationCloseAt" TIMESTAMP(3),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'zh',
    "tags" TEXT[],
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_details" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "configJson" JSONB NOT NULL,

    CONSTRAINT "activity_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_roles" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "roleType" "ActivityRoleType" NOT NULL,
    "formTemplateId" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "maxCount" INTEGER,
    "permissionsJson" JSONB,
    "certificateDefinitionId" TEXT,
    "pointsRuleJson" JSONB,
    "badgeRuleJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_applications" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleType" "ActivityRoleType",
    "formResponseJson" JSONB,
    "status" "ActivityApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_participations" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleType" "ActivityRoleType",
    "status" "ActivityParticipationStatus" NOT NULL DEFAULT 'REGISTERED',
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "certificateIssueId" TEXT,
    "badgeAwardIds" TEXT[],
    "passportSynced" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_form_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fieldsJson" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_tasks" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" "ActivityTaskType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TIMESTAMP(3),
    "dueTime" TIMESTAMP(3),
    "points" INTEGER NOT NULL DEFAULT 0,
    "badgeTriggerDefinitionId" TEXT,
    "requiresSubmission" BOOLEAN NOT NULL DEFAULT false,
    "requiresCheckin" BOOLEAN NOT NULL DEFAULT false,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "ruleJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "taskId" TEXT,
    "fileUrls" TEXT[],
    "textContent" TEXT,
    "linkUrl" TEXT,
    "mediaType" TEXT,
    "status" "ActivitySubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedByUserId" TEXT,
    "reviewComment" TEXT,
    "score" DECIMAL(5,2),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_checkin_records" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "taskId" TEXT,
    "userId" TEXT NOT NULL,
    "method" "ActivityCheckinMethod" NOT NULL,
    "status" "ActivityCheckinStatus" NOT NULL,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "locationJson" JSONB,
    "verifiedByUserId" TEXT,
    "checkinAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_checkin_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_reward_rules" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "trigger" "ActivityRewardTrigger" NOT NULL,
    "rewardType" "ActivityRewardType" NOT NULL,
    "rewardValueJson" JSONB NOT NULL,
    "conditionJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_reward_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_certificate_rules" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "certificateDefinitionId" TEXT NOT NULL,
    "conditionJson" JSONB,
    "autoIssue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_certificate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_review_workflows" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "objectType" "ActivityReviewObjectType" NOT NULL,
    "objectId" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "reviewType" "ActivityReviewType" NOT NULL,
    "status" "ActivityReviewStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_review_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_deliverables" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "submissionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "project_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activities_slug_key" ON "activities"("slug");

-- CreateIndex
CREATE INDEX "activities_type_status_idx" ON "activities"("type", "status");

-- CreateIndex
CREATE INDEX "activities_status_startTime_idx" ON "activities"("status", "startTime");

-- CreateIndex
CREATE INDEX "activities_organizerUserId_idx" ON "activities"("organizerUserId");

-- CreateIndex
CREATE INDEX "activities_isFeatured_startTime_idx" ON "activities"("isFeatured", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "activity_details_activityId_key" ON "activity_details"("activityId");

-- CreateIndex
CREATE INDEX "activity_roles_activityId_idx" ON "activity_roles"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_roles_activityId_roleType_key" ON "activity_roles"("activityId", "roleType");

-- CreateIndex
CREATE INDEX "activity_applications_userId_status_idx" ON "activity_applications"("userId", "status");

-- CreateIndex
CREATE INDEX "activity_applications_activityId_status_idx" ON "activity_applications"("activityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "activity_applications_activityId_userId_key" ON "activity_applications"("activityId", "userId");

-- CreateIndex
CREATE INDEX "activity_participations_userId_status_idx" ON "activity_participations"("userId", "status");

-- CreateIndex
CREATE INDEX "activity_participations_activityId_idx" ON "activity_participations"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_participations_activityId_userId_key" ON "activity_participations"("activityId", "userId");

-- CreateIndex
CREATE INDEX "activity_tasks_activityId_taskType_idx" ON "activity_tasks"("activityId", "taskType");

-- CreateIndex
CREATE INDEX "activity_tasks_parentTaskId_idx" ON "activity_tasks"("parentTaskId");

-- CreateIndex
CREATE INDEX "activity_submissions_taskId_userId_idx" ON "activity_submissions"("taskId", "userId");

-- CreateIndex
CREATE INDEX "activity_submissions_activityId_status_idx" ON "activity_submissions"("activityId", "status");

-- CreateIndex
CREATE INDEX "activity_checkin_records_activityId_userId_idx" ON "activity_checkin_records"("activityId", "userId");

-- CreateIndex
CREATE INDEX "activity_checkin_records_taskId_idx" ON "activity_checkin_records"("taskId");

-- CreateIndex
CREATE INDEX "activity_checkin_records_checkinAt_idx" ON "activity_checkin_records"("checkinAt");

-- CreateIndex
CREATE INDEX "activity_reward_rules_activityId_trigger_idx" ON "activity_reward_rules"("activityId", "trigger");

-- CreateIndex
CREATE INDEX "activity_certificate_rules_activityId_idx" ON "activity_certificate_rules"("activityId");

-- CreateIndex
CREATE INDEX "activity_review_workflows_activityId_objectType_idx" ON "activity_review_workflows"("activityId", "objectType");

-- CreateIndex
CREATE INDEX "activity_review_workflows_objectType_objectId_idx" ON "activity_review_workflows"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "activity_review_workflows_reviewerUserId_idx" ON "activity_review_workflows"("reviewerUserId");

-- CreateIndex
CREATE INDEX "project_milestones_activityId_idx" ON "project_milestones"("activityId");

-- CreateIndex
CREATE INDEX "project_deliverables_milestoneId_idx" ON "project_deliverables"("milestoneId");

-- CreateIndex
CREATE INDEX "passport_milestones_activityId_idx" ON "passport_milestones"("activityId");

-- CreateIndex
CREATE INDEX "point_transactions_activityId_idx" ON "point_transactions"("activityId");

-- CreateIndex
CREATE INDEX "qr_tokens_activityId_type_idx" ON "qr_tokens"("activityId", "type");

-- AddForeignKey
ALTER TABLE "activity_details" ADD CONSTRAINT "activity_details_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_roles" ADD CONSTRAINT "activity_roles_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_applications" ADD CONSTRAINT "activity_applications_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_participations" ADD CONSTRAINT "activity_participations_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_tasks" ADD CONSTRAINT "activity_tasks_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_tasks" ADD CONSTRAINT "activity_tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "activity_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_submissions" ADD CONSTRAINT "activity_submissions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_submissions" ADD CONSTRAINT "activity_submissions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "activity_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_checkin_records" ADD CONSTRAINT "activity_checkin_records_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_checkin_records" ADD CONSTRAINT "activity_checkin_records_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "activity_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_reward_rules" ADD CONSTRAINT "activity_reward_rules_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_certificate_rules" ADD CONSTRAINT "activity_certificate_rules_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_review_workflows" ADD CONSTRAINT "activity_review_workflows_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "project_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
