ALTER TABLE "certificate_categories"
ADD COLUMN "autoIssueEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "userRequestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pdfEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "publicVerifyEnabled" BOOLEAN NOT NULL DEFAULT true;
