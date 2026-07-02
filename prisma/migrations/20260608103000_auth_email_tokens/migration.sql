-- Create enum for auth email token purposes
CREATE TYPE "AuthEmailTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- Create table for verification/reset tokens
CREATE TABLE "auth_email_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" "AuthEmailTokenPurpose" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "code" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_email_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_email_tokens_tokenHash_key" ON "auth_email_tokens"("tokenHash");
CREATE INDEX "auth_email_tokens_userId_purpose_createdAt_idx" ON "auth_email_tokens"("userId", "purpose", "createdAt");
CREATE INDEX "auth_email_tokens_email_purpose_createdAt_idx" ON "auth_email_tokens"("email", "purpose", "createdAt");
CREATE INDEX "auth_email_tokens_expiresAt_idx" ON "auth_email_tokens"("expiresAt");

ALTER TABLE "auth_email_tokens"
ADD CONSTRAINT "auth_email_tokens_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill active users to keep existing accounts usable after enabling email verification checks
UPDATE "users"
SET "emailVerified" = COALESCE("emailVerified", "createdAt")
WHERE "status" = 'ACTIVE';
