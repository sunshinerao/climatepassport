-- AlterEnum: Add INTERVIEW and OFFERED to ActivityApplicationStatus
-- These support the Learning Experience application review workflow
-- (shortlisted → interview → offered → accepted/rejected/waitlisted)

ALTER TYPE "ActivityApplicationStatus" ADD VALUE IF NOT EXISTS 'INTERVIEW';
ALTER TYPE "ActivityApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFERED';
