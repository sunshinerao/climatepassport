-- AlterTable
ALTER TABLE "governance_bindings" ADD COLUMN     "participationId" TEXT;

-- AlterTable
ALTER TABLE "governance_reward_tasks" ADD COLUMN     "rewardJson" JSONB;

-- AlterTable
ALTER TABLE "governance_reward_grants" ADD COLUMN     "badgeAwardId" TEXT,
ADD COLUMN     "certificateIssueId" TEXT,
ADD COLUMN     "publicVisible" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "pointTransactionId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "governance_participations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_reward_decisions" (
    "id" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "activeGrantId" TEXT,
    "basisFactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_reward_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "governance_participations_projectId_userId_key" ON "governance_participations"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_reward_decisions_activeGrantId_key" ON "governance_reward_decisions"("activeGrantId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_reward_decisions_participationId_type_key" ON "governance_reward_decisions"("participationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "governance_reward_grants_badgeAwardId_key" ON "governance_reward_grants"("badgeAwardId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_reward_grants_certificateIssueId_key" ON "governance_reward_grants"("certificateIssueId");

-- AddForeignKey
ALTER TABLE "governance_bindings" ADD CONSTRAINT "governance_bindings_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "governance_participations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_participations" ADD CONSTRAINT "governance_participations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "governance_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_participations" ADD CONSTRAINT "governance_participations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_participations" ADD CONSTRAINT "governance_participations_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "governance_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_reward_decisions" ADD CONSTRAINT "governance_reward_decisions_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "governance_participations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE governance_reward_tasks DROP CONSTRAINT governance_reward_positive;
ALTER TABLE governance_reward_grants DROP CONSTRAINT governance_grant_positive;
ALTER TABLE governance_reward_tasks ADD CONSTRAINT governance_reward_amount CHECK ((type='POINTS' AND points>0) OR (type IN ('BADGE','CERTIFICATE') AND points=0));
ALTER TABLE governance_reward_grants ADD CONSTRAINT governance_grant_amount CHECK ((type='POINTS' AND points>0) OR (type IN ('BADGE','CERTIFICATE') AND points=0));
