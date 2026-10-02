-- Prepared only. Deliberate credential-version rotation invalidates old links/codes.
ALTER TABLE "auth_email_tokens" ADD COLUMN "credential_version" TEXT NOT NULL DEFAULT 'legacy';
CREATE TABLE "auth_mail_outbox" (
 "id" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "email" TEXT NOT NULL,
 "payload" JSONB NOT NULL,
 "credentialVersion" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "dedupeKey" TEXT NOT NULL,
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseId" TEXT,
 "leaseExpiresAt" TIMESTAMP(3),
 "deliveryStartedAt" TIMESTAMP(3),
 "credentialId" TEXT,
 "failureCode" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "auth_mail_outbox_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "auth_mail_outbox_kind_check" CHECK ("kind" IN ('REGISTER','VERIFY','RESET')),
 CONSTRAINT "auth_mail_outbox_status_check" CHECK ("status" IN ('PENDING','PROCESSING','SENT','SKIPPED','FAILED','UNKNOWN'))
);
CREATE UNIQUE INDEX "auth_mail_outbox_dedupeKey_key" ON "auth_mail_outbox"("dedupeKey");
CREATE INDEX "auth_mail_outbox_status_nextAttemptAt_idx" ON "auth_mail_outbox"("status","nextAttemptAt");
CREATE INDEX "auth_mail_outbox_status_leaseExpiresAt_idx" ON "auth_mail_outbox"("status","leaseExpiresAt");
