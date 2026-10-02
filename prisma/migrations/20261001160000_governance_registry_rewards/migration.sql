-- CreateTable
CREATE TABLE "governance_projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "activityId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_sources" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "channelClientId" TEXT NOT NULL,
    "sourceApp" TEXT NOT NULL,
    "sourceAuthority" TEXT NOT NULL,
    "externalUnitId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "rpAudience" TEXT NOT NULL,
    "verifierUserId" TEXT NOT NULL,

    CONSTRAINT "governance_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_bindings" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "verificationRef" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "headEventId" TEXT,
    "terminalRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "governance_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_rule_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "conditionJson" JSONB NOT NULL,
    "rewardsJson" JSONB NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "digest" TEXT NOT NULL,

    CONSTRAINT "governance_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_facts" (
    "id" TEXT NOT NULL,
    "bindingId" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "supersedesEventId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "digest" TEXT NOT NULL,
    "factsJson" JSONB,
    "consentId" TEXT,
    "state" TEXT NOT NULL,

    CONSTRAINT "governance_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_reward_tasks" (
    "id" TEXT NOT NULL,
    "factId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "dependencyFactId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_reward_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_reward_grants" (
    "id" TEXT NOT NULL,
    "factId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "pointTransactionId" TEXT NOT NULL,
    "reversalTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "governance_reward_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_reward_dispatches" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardValueJson" JSONB NOT NULL,
    "conditionJson" JSONB,
    "factsJson" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_reward_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "governance_projects_code_key" ON "governance_projects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "governance_projects_activityId_key" ON "governance_projects"("activityId");

-- CreateIndex
CREATE INDEX "governance_projects_programmeId_status_idx" ON "governance_projects"("programmeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "governance_sources_channelClientId_externalUnitId_key" ON "governance_sources"("channelClientId", "externalUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_bindings_sourceId_sourceRecordId_key" ON "governance_bindings"("sourceId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_rule_versions_projectId_version_key" ON "governance_rule_versions"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "governance_facts_bindingId_eventId_key" ON "governance_facts"("bindingId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_facts_bindingId_sourceVersion_key" ON "governance_facts"("bindingId", "sourceVersion");

-- CreateIndex
CREATE INDEX "governance_reward_tasks_state_nextAttemptAt_idx" ON "governance_reward_tasks"("state", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "governance_reward_tasks_factId_operation_type_key" ON "governance_reward_tasks"("factId", "operation", "type");

-- CreateIndex
CREATE UNIQUE INDEX "governance_reward_grants_pointTransactionId_key" ON "governance_reward_grants"("pointTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_reward_grants_reversalTransactionId_key" ON "governance_reward_grants"("reversalTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_reward_grants_factId_type_key" ON "governance_reward_grants"("factId", "type");

-- CreateIndex
CREATE INDEX "activity_reward_dispatches_state_nextAttemptAt_idx" ON "activity_reward_dispatches"("state", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "activity_reward_dispatches_ruleId_userId_key" ON "activity_reward_dispatches"("ruleId", "userId");

-- AddForeignKey
ALTER TABLE "governance_projects" ADD CONSTRAINT "governance_projects_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_projects" ADD CONSTRAINT "governance_projects_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_projects" ADD CONSTRAINT "governance_projects_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_sources" ADD CONSTRAINT "governance_sources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "governance_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_sources" ADD CONSTRAINT "governance_sources_channelClientId_fkey" FOREIGN KEY ("channelClientId") REFERENCES "channel_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_bindings" ADD CONSTRAINT "governance_bindings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "governance_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_bindings" ADD CONSTRAINT "governance_bindings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_rule_versions" ADD CONSTRAINT "governance_rule_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "governance_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_facts" ADD CONSTRAINT "governance_facts_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "governance_bindings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_facts" ADD CONSTRAINT "governance_facts_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "governance_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_reward_tasks" ADD CONSTRAINT "governance_reward_tasks_factId_fkey" FOREIGN KEY ("factId") REFERENCES "governance_facts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_reward_grants" ADD CONSTRAINT "governance_reward_grants_factId_fkey" FOREIGN KEY ("factId") REFERENCES "governance_facts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_reward_grants" ADD CONSTRAINT "governance_reward_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Approved rule content is immutable, including when retired. Status changes remain explicit.
CREATE FUNCTION governance_rule_content_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status <> 'DRAFT' AND (
  NEW."projectId" IS DISTINCT FROM OLD."projectId" OR NEW.version IS DISTINCT FROM OLD.version OR
  NEW."conditionJson" IS DISTINCT FROM OLD."conditionJson" OR NEW."rewardsJson" IS DISTINCT FROM OLD."rewardsJson" OR
  NEW."validFrom" IS DISTINCT FROM OLD."validFrom" OR NEW."validUntil" IS DISTINCT FROM OLD."validUntil" OR
  NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId" OR NEW.digest IS DISTINCT FROM OLD.digest
 ) THEN RAISE EXCEPTION 'GOV_FROZEN'; END IF;
 IF OLD.status <> NEW.status AND NOT ((OLD.status='DRAFT' AND NEW.status='APPROVED') OR (OLD.status='APPROVED' AND NEW.status='PUBLISHED') OR (OLD.status='PUBLISHED' AND NEW.status='RETIRED')) THEN RAISE EXCEPTION 'GOV_STATE_CONFLICT'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER governance_rule_frozen BEFORE UPDATE ON governance_rule_versions FOR EACH ROW EXECUTE FUNCTION governance_rule_content_frozen();
ALTER TABLE governance_rule_versions ADD CONSTRAINT governance_rule_window CHECK ("validUntil">"validFrom");
ALTER TABLE governance_rule_versions ADD CONSTRAINT governance_rule_version_positive CHECK(version>0);
ALTER TABLE governance_reward_tasks ADD CONSTRAINT governance_reward_positive CHECK(points>0);
ALTER TABLE governance_reward_grants ADD CONSTRAINT governance_grant_positive CHECK(points>0);
ALTER TABLE governance_facts ADD CONSTRAINT governance_fact_version_positive CHECK("sourceVersion">0);
