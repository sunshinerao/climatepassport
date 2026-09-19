-- Additive Phase 1 certificate-application workflow; existing certificate issues remain unchanged.
CREATE TYPE "CertificateApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE "certificate_applications" (
  "id" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "status" "CertificateApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "statement" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "sourceLabel" TEXT,
  "idempotencyKey" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "applicantMessage" TEXT,
  "certificateIssueId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "certificate_applications_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "certificate_application_events" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "fromStatus" "CertificateApplicationStatus",
  "toStatus" "CertificateApplicationStatus" NOT NULL,
  "kind" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "certificate_application_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "certificate_applications_certificateIssueId_key" ON "certificate_applications"("certificateIssueId");
CREATE UNIQUE INDEX "certificate_applications_applicantId_idempotencyKey_key" ON "certificate_applications"("applicantId", "idempotencyKey");
CREATE UNIQUE INDEX "certificate_applications_one_open_per_definition" ON "certificate_applications"("applicantId", "definitionId") WHERE "status" IN ('DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION');
CREATE INDEX "certificate_applications_applicantId_createdAt_idx" ON "certificate_applications"("applicantId", "createdAt");
CREATE INDEX "certificate_applications_definitionId_status_idx" ON "certificate_applications"("definitionId", "status");
CREATE INDEX "certificate_applications_status_createdAt_idx" ON "certificate_applications"("status", "createdAt");
CREATE INDEX "certificate_application_events_applicationId_createdAt_idx" ON "certificate_application_events"("applicationId", "createdAt");
ALTER TABLE "certificate_applications" ADD CONSTRAINT "certificate_applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificate_applications" ADD CONSTRAINT "certificate_applications_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "certificate_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificate_applications" ADD CONSTRAINT "certificate_applications_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "certificate_applications" ADD CONSTRAINT "certificate_applications_certificateIssueId_fkey" FOREIGN KEY ("certificateIssueId") REFERENCES "certificate_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "certificate_application_events" ADD CONSTRAINT "certificate_application_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "certificate_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificate_application_events" ADD CONSTRAINT "certificate_application_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
