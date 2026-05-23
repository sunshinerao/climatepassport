CREATE TYPE "QrTokenType" AS ENUM ('IDENTITY', 'EVENT_CHECKIN', 'CERTIFICATE_VERIFICATION', 'INVITATION_SPECIAL_PASS');

CREATE TYPE "QrTokenStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');

CREATE TABLE "qr_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "QrTokenType" NOT NULL,
    "status" "QrTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT,
    "eventId" TEXT,
    "certificateIssueId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "scopeJson" JSONB,
    "metadataJson" JSONB,
    "expiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "result" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "qr_tokens_tokenHash_key" ON "qr_tokens"("tokenHash");
CREATE INDEX "qr_tokens_type_status_idx" ON "qr_tokens"("type", "status");
CREATE INDEX "qr_tokens_userId_type_idx" ON "qr_tokens"("userId", "type");
CREATE INDEX "qr_tokens_eventId_type_idx" ON "qr_tokens"("eventId", "type");
CREATE INDEX "qr_tokens_certificateIssueId_idx" ON "qr_tokens"("certificateIssueId");
CREATE INDEX "qr_tokens_expiresAt_idx" ON "qr_tokens"("expiresAt");
CREATE INDEX "core_audit_logs_actorUserId_createdAt_idx" ON "core_audit_logs"("actorUserId", "createdAt");
CREATE INDEX "core_audit_logs_action_createdAt_idx" ON "core_audit_logs"("action", "createdAt");
CREATE INDEX "core_audit_logs_subjectType_subjectId_idx" ON "core_audit_logs"("subjectType", "subjectId");

ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_certificateIssueId_fkey" FOREIGN KEY ("certificateIssueId") REFERENCES "certificate_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_audit_logs" ADD CONSTRAINT "core_audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
