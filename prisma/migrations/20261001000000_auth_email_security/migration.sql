-- Security cutover: invalidate existing credentials; do not carry plaintext codes forward.
-- Migration prepared only; execution requires separately approved database rollout.
UPDATE "auth_email_tokens" SET "consumedAt" = CURRENT_TIMESTAMP WHERE "consumedAt" IS NULL;
ALTER TABLE "auth_email_tokens" ADD COLUMN "code_hash" TEXT;
ALTER TABLE "auth_email_tokens" DROP COLUMN "code";
CREATE TABLE "AuthRequestLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthRequestLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "AuthRequestLimit_windowStart_idx" ON "AuthRequestLimit"("windowStart");
