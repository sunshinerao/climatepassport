CREATE TYPE "ActivityAiContentDraftKind" AS ENUM ('SUMMARY', 'HIGHLIGHTS', 'OVERVIEW_COPY');
CREATE TYPE "ActivityAiContentDraftStatus" AS ENUM ('REQUESTED', 'GENERATED', 'FAILED', 'EDITED', 'APPROVED', 'PUBLISHED', 'REJECTED', 'DELETED');

CREATE TABLE "activity_ai_content_drafts" (
  "id" TEXT NOT NULL, "activityId" TEXT NOT NULL, "kind" "ActivityAiContentDraftKind" NOT NULL,
  "status" "ActivityAiContentDraftStatus" NOT NULL DEFAULT 'REQUESTED', "locale" TEXT NOT NULL,
  "providerAlias" TEXT, "modelAlias" TEXT, "sourceHash" TEXT NOT NULL, "sourceFieldCount" INTEGER NOT NULL,
  "sourceCharacterCount" INTEGER NOT NULL, "outputJson" JSONB, "failureCode" TEXT, "actorUserId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "generatedAt" TIMESTAMP(3), "editedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3), "publishedAt" TIMESTAMP(3), "rejectedAt" TIMESTAMP(3), "deletedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "activity_ai_content_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_ai_content_drafts_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_ai_content_drafts_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "activity_ai_content_drafts_activityId_status_createdAt_idx" ON "activity_ai_content_drafts"("activityId", "status", "createdAt");
CREATE INDEX "activity_ai_content_drafts_actorUserId_requestedAt_idx" ON "activity_ai_content_drafts"("actorUserId", "requestedAt");
CREATE INDEX "activity_ai_content_drafts_expiresAt_idx" ON "activity_ai_content_drafts"("expiresAt");
CREATE INDEX "activity_ai_content_drafts_deletedAt_idx" ON "activity_ai_content_drafts"("deletedAt");
