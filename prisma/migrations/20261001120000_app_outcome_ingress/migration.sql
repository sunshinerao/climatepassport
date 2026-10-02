-- CreateTable
CREATE TABLE "app_outcome_sources" (
    "id" TEXT NOT NULL,
    "channelClientId" TEXT NOT NULL,
    "sourceApp" TEXT NOT NULL,
    "sourceAuthority" TEXT NOT NULL,
    "identityIssuer" TEXT NOT NULL,
    "identityClientId" TEXT NOT NULL,
    "allowedKinds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_outcome_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_outcome_bindings" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verificationRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_outcome_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_outcome_streams" (
    "id" TEXT NOT NULL,
    "bindingId" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "headEventId" TEXT,
    "kind" TEXT,
    "outcomeStatus" TEXT,
    "evidenceRefs" TEXT[],
    "consentId" TEXT,
    "consentVersion" INTEGER,
    "terminalRevoked" BOOLEAN NOT NULL DEFAULT false,
    "suppressedAt" TIMESTAMP(3),
    "tombstoneExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_outcome_streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_outcome_events" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "digest" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "supersedesEventId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "consentId" TEXT,
    "payloadJson" JSONB,
    "state" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "app_outcome_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_outcome_sources_channelClientId_key" ON "app_outcome_sources"("channelClientId");

-- CreateIndex
CREATE INDEX "app_outcome_bindings_userId_idx" ON "app_outcome_bindings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "app_outcome_bindings_sourceId_subjectHash_sourceRecordId_key" ON "app_outcome_bindings"("sourceId", "subjectHash", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "app_outcome_streams_bindingId_key" ON "app_outcome_streams"("bindingId");

-- CreateIndex
CREATE INDEX "app_outcome_streams_tombstoneExpiresAt_idx" ON "app_outcome_streams"("tombstoneExpiresAt");

-- CreateIndex
CREATE INDEX "app_outcome_events_streamId_state_idx" ON "app_outcome_events"("streamId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "app_outcome_events_sourceId_eventId_key" ON "app_outcome_events"("sourceId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "app_outcome_events_streamId_sourceVersion_key" ON "app_outcome_events"("streamId", "sourceVersion");

-- AddForeignKey
ALTER TABLE "app_outcome_sources" ADD CONSTRAINT "app_outcome_sources_channelClientId_fkey" FOREIGN KEY ("channelClientId") REFERENCES "channel_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_outcome_bindings" ADD CONSTRAINT "app_outcome_bindings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "app_outcome_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_outcome_bindings" ADD CONSTRAINT "app_outcome_bindings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_outcome_streams" ADD CONSTRAINT "app_outcome_streams_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "app_outcome_bindings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_outcome_events" ADD CONSTRAINT "app_outcome_events_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "app_outcome_streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

