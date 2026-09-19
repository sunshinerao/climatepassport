-- Additive, local-only Phase 3 controlled PROJECT Interest & Application workflow.
-- Creates no drops, renames, or recruitment/matching/public-directory surfaces.

ALTER TABLE "activities"
  ADD COLUMN "applicantListVisibleToApplicants" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowInterestWithoutApplication" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "project_application_consents" (
  "id" TEXT NOT NULL,
  "activityApplicationId" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL DEFAULT 'PROJECT_APPLICATION_CONSENT_V1',
  "shareName" BOOLEAN NOT NULL DEFAULT false,
  "shareEmail" BOOLEAN NOT NULL DEFAULT false,
  "shareTitle" BOOLEAN NOT NULL DEFAULT false,
  "shareBio" BOOLEAN NOT NULL DEFAULT false,
  "shareAffiliations" BOOLEAN NOT NULL DEFAULT false,
  "sharePortfolioLink" BOOLEAN NOT NULL DEFAULT false,
  "portfolioShareLinkId" TEXT,
  "purposeSnapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_application_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_application_consents_activityApplicationId_key" ON "project_application_consents"("activityApplicationId");
CREATE INDEX "project_application_consents_activityApplicationId_idx" ON "project_application_consents"("activityApplicationId");
CREATE INDEX "project_application_consents_portfolioShareLinkId_idx" ON "project_application_consents"("portfolioShareLinkId");

ALTER TABLE "project_application_consents"
  ADD CONSTRAINT "project_application_consents_activityApplicationId_fkey"
    FOREIGN KEY ("activityApplicationId") REFERENCES "activity_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_application_consents_portfolioShareLinkId_fkey"
    FOREIGN KEY ("portfolioShareLinkId") REFERENCES "portfolio_share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
