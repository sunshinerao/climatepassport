-- Provider-neutral private certificate artifact metadata. Existing generatedFileUrl values remain untouched.
CREATE TYPE "CertificateArtifactState" AS ENUM ('NONE', 'PENDING', 'READY', 'LEGACY_INLINE', 'LEGACY_EXTERNAL', 'MISSING', 'FAILED');
ALTER TABLE "certificate_issues"
  ADD COLUMN "artifactProvider" TEXT,
  ADD COLUMN "artifactKey" TEXT,
  ADD COLUMN "artifactVersion" TEXT,
  ADD COLUMN "artifactContentType" TEXT,
  ADD COLUMN "artifactByteSize" INTEGER,
  ADD COLUMN "artifactSha256" TEXT,
  ADD COLUMN "artifactCreatedAt" TIMESTAMP(3),
  ADD COLUMN "artifactVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "artifactState" "CertificateArtifactState" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "artifactFailureReason" TEXT;
