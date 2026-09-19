-- Bounded automatic issuance reservations for authoritative Activity QR check-ins.
CREATE TYPE "ActivityCertificateIssuanceStatus" AS ENUM ('PENDING', 'ISSUED', 'FAILED');

CREATE TABLE "activity_certificate_issuances" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "participationId" TEXT NOT NULL,
  "checkinRecordId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "certificateDefinitionId" TEXT NOT NULL,
  "certificateIssueId" TEXT,
  "status" "ActivityCertificateIssuanceStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "activity_certificate_issuances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "activity_certificate_issuances_certificateIssueId_key" ON "activity_certificate_issuances"("certificateIssueId");
CREATE UNIQUE INDEX "activity_certificate_issuances_ruleId_participationId_key" ON "activity_certificate_issuances"("ruleId", "participationId");
CREATE INDEX "activity_certificate_issuances_activityId_status_idx" ON "activity_certificate_issuances"("activityId", "status");
CREATE INDEX "activity_certificate_issuances_participationId_idx" ON "activity_certificate_issuances"("participationId");
CREATE INDEX "activity_certificate_issuances_checkinRecordId_idx" ON "activity_certificate_issuances"("checkinRecordId");
CREATE INDEX "activity_certificate_issuances_certificateDefinitionId_idx" ON "activity_certificate_issuances"("certificateDefinitionId");

ALTER TABLE "activity_certificate_rules" ADD CONSTRAINT "activity_certificate_rules_certificateDefinitionId_fkey" FOREIGN KEY ("certificateDefinitionId") REFERENCES "certificate_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_certificate_issuances" ADD CONSTRAINT "activity_certificate_issuances_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_certificate_issuances" ADD CONSTRAINT "activity_certificate_issuances_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "activity_participations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_certificate_issuances" ADD CONSTRAINT "activity_certificate_issuances_checkinRecordId_fkey" FOREIGN KEY ("checkinRecordId") REFERENCES "activity_checkin_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_certificate_issuances" ADD CONSTRAINT "activity_certificate_issuances_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "activity_certificate_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_certificate_issuances" ADD CONSTRAINT "activity_certificate_issuances_certificateDefinitionId_fkey" FOREIGN KEY ("certificateDefinitionId") REFERENCES "certificate_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_certificate_issuances" ADD CONSTRAINT "activity_certificate_issuances_certificateIssueId_fkey" FOREIGN KEY ("certificateIssueId") REFERENCES "certificate_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
