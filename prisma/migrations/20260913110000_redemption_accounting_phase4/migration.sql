-- Additive, local-only Phase 4 internal redemption accounting foundation.
-- No User.points or point_transactions data is changed.
CREATE TYPE "RedemptionIntentStatus" AS ENUM ('CREATED', 'RESERVED', 'CANCELLED', 'EXPIRED', 'SETTLED', 'REFUNDED');
CREATE TYPE "PointJournalType" AS ENUM ('RESERVE', 'CANCEL', 'EXPIRE', 'SETTLE', 'REFUND');
CREATE TYPE "PointPostingAccount" AS ENUM ('USER_RESERVED', 'REDEMPTION_CLEARING', 'REDEMPTION_SETTLED');
CREATE TYPE "PointPostingDirection" AS ENUM ('DEBIT', 'CREDIT');

CREATE TABLE "redemption_intents" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "points" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "status" "RedemptionIntentStatus" NOT NULL DEFAULT 'CREATED',
  "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "redemption_intents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "redemption_intents_points_positive" CHECK ("points" > 0)
);
CREATE UNIQUE INDEX "redemption_intents_userId_idempotencyKey_key" ON "redemption_intents"("userId", "idempotencyKey");
CREATE INDEX "redemption_intents_userId_status_idx" ON "redemption_intents"("userId", "status");
CREATE INDEX "redemption_intents_status_expiresAt_idx" ON "redemption_intents"("status", "expiresAt");
ALTER TABLE "redemption_intents" ADD CONSTRAINT "redemption_intents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "point_journals" (
  "id" TEXT NOT NULL, "intentId" TEXT NOT NULL, "type" "PointJournalType" NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "point_journals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "point_journals_idempotencyKey_key" ON "point_journals"("idempotencyKey");
CREATE INDEX "point_journals_intentId_createdAt_idx" ON "point_journals"("intentId", "createdAt");
ALTER TABLE "point_journals" ADD CONSTRAINT "point_journals_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "redemption_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "point_postings" (
  "id" TEXT NOT NULL, "journalId" TEXT NOT NULL, "account" "PointPostingAccount" NOT NULL,
  "direction" "PointPostingDirection" NOT NULL, "points" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "point_postings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "point_postings_points_positive" CHECK ("points" > 0)
);
CREATE INDEX "point_postings_account_direction_idx" ON "point_postings"("account", "direction");
CREATE INDEX "point_postings_journalId_idx" ON "point_postings"("journalId");
ALTER TABLE "point_postings" ADD CONSTRAINT "point_postings_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "point_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
