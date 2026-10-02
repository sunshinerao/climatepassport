-- CP-TODO-244: reliable outbox (outbound dispatches).
-- Local business writes and outbound events commit in the same transaction;
-- a bounded processor claims rows with compare-and-set leases, retries with
-- backoff, dead-letters exhausted rows, and records idempotent receipts.
-- ChannelClient gains an optional callback URL (https required off-localhost).

ALTER TABLE "channel_clients" ADD COLUMN "callbackUrl" TEXT;

CREATE TABLE IF NOT EXISTS "outbound_dispatches" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "payloadJson" JSONB NOT NULL,
  "channelClientId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseExpiresAt" TIMESTAMP(3),
  "receiptJson" JSONB,
  "lastError" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "outbound_dispatches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbound_dispatches_idempotencyKey_key" ON "outbound_dispatches"("idempotencyKey");
CREATE INDEX "outbound_dispatches_status_nextRetryAt_idx" ON "outbound_dispatches"("status", "nextRetryAt");
CREATE INDEX "outbound_dispatches_channelClientId_status_idx" ON "outbound_dispatches"("channelClientId", "status");

ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_channelClientId_fkey"
  FOREIGN KEY ("channelClientId") REFERENCES "channel_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
