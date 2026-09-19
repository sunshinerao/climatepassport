-- Additive, local-only Phase 3A explainable portfolio schema.
CREATE TYPE "PortfolioRuleSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "PortfolioEvidenceSourceKind" AS ENUM ('ISSUED_CERTIFICATE', 'VERIFIED_ACHIEVEMENT', 'LEARNING_COMPLETION', 'VERIFIED_ACTIVITY_PARTICIPATION');
CREATE TYPE "PortfolioShareConsentMode" AS ENUM ('PRIVATE', 'PUBLIC_PROFILE', 'DIRECT_SHARE');
CREATE TYPE "PortfolioShareConsentStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "PortfolioShareLinkStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TABLE "competency_dimensions" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "nameEn" TEXT,
  "description" TEXT, "descriptionEn" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "competency_dimensions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "competency_dimensions_key_key" ON "competency_dimensions"("key");

CREATE TABLE "portfolio_rule_sets" (
  "id" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" "PortfolioRuleSetStatus" NOT NULL DEFAULT 'DRAFT',
  "name" TEXT NOT NULL, "createdByUserId" TEXT, "activatedAt" TIMESTAMP(3), "retiredAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portfolio_rule_sets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "portfolio_rule_sets_version_key" ON "portfolio_rule_sets"("version");
CREATE INDEX "portfolio_rule_sets_status_idx" ON "portfolio_rule_sets"("status");
CREATE UNIQUE INDEX "portfolio_rule_sets_one_active" ON "portfolio_rule_sets"("status") WHERE "status" = 'ACTIVE';

CREATE TABLE "portfolio_evidence_rules" (
  "id" TEXT NOT NULL, "ruleSetId" TEXT NOT NULL, "dimensionId" TEXT NOT NULL, "sourceKind" "PortfolioEvidenceSourceKind" NOT NULL,
  "predicateJson" JSONB NOT NULL, "weight" INTEGER NOT NULL DEFAULT 1, "reason" TEXT NOT NULL, "reasonEn" TEXT, "distinctKey" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portfolio_evidence_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "portfolio_evidence_rules_ruleSetId_sourceKind_idx" ON "portfolio_evidence_rules"("ruleSetId", "sourceKind");
ALTER TABLE "portfolio_evidence_rules" ADD CONSTRAINT "portfolio_evidence_rules_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "portfolio_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portfolio_evidence_rules" ADD CONSTRAINT "portfolio_evidence_rules_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "competency_dimensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "portfolio_share_consents" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "mode" "PortfolioShareConsentMode" NOT NULL DEFAULT 'PRIVATE', "status" "PortfolioShareConsentStatus" NOT NULL DEFAULT 'ACTIVE',
  "fieldAllowlist" TEXT[] NOT NULL, "policyVersion" TEXT NOT NULL, "expiresAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "portfolio_share_consents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "portfolio_share_consents_userId_key" ON "portfolio_share_consents"("userId");
ALTER TABLE "portfolio_share_consents" ADD CONSTRAINT "portfolio_share_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "portfolio_share_links" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "fieldAllowlist" TEXT[] NOT NULL, "policyVersion" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "maxAccessCount" INTEGER, "accessCount" INTEGER NOT NULL DEFAULT 0, "status" "PortfolioShareLinkStatus" NOT NULL DEFAULT 'ACTIVE', "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portfolio_share_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "portfolio_share_links_tokenHash_key" ON "portfolio_share_links"("tokenHash");
CREATE INDEX "portfolio_share_links_userId_status_idx" ON "portfolio_share_links"("userId", "status");
ALTER TABLE "portfolio_share_links" ADD CONSTRAINT "portfolio_share_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Static immutable dimension keys and initial constrained rules. The application never creates these on a GET.
INSERT INTO "competency_dimensions" ("id", "key", "name", "nameEn", "sortOrder") VALUES
  ('00000000-0000-4000-8000-000000000301', 'LEARNING', '学习', 'Learning', 1),
  ('00000000-0000-4000-8000-000000000302', 'ACTION', '行动', 'Action', 2),
  ('00000000-0000-4000-8000-000000000303', 'INNOVATION', '创新', 'Innovation', 3),
  ('00000000-0000-4000-8000-000000000304', 'ORGANIZATION', '组织', 'Organization', 4),
  ('00000000-0000-4000-8000-000000000305', 'INFLUENCE', '影响力', 'Influence', 5)
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "portfolio_rule_sets" ("id", "version", "status", "name", "activatedAt") VALUES ('00000000-0000-4000-8000-000000000310', 1, 'ACTIVE', 'Initial verified portfolio rules', CURRENT_TIMESTAMP) ON CONFLICT ("version") DO NOTHING;
INSERT INTO "portfolio_evidence_rules" ("id", "ruleSetId", "dimensionId", "sourceKind", "predicateJson", "weight", "reason", "reasonEn") VALUES
  ('00000000-0000-4000-8000-000000000311','00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000301','ISSUED_CERTIFICATE','{}',1,'已签发证书','Issued certificate'),
  ('00000000-0000-4000-8000-000000000312','00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000302','VERIFIED_ACTIVITY_PARTICIPATION','{}',1,'已验证活动参与','Verified activity participation'),
  ('00000000-0000-4000-8000-000000000313','00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000303','VERIFIED_ACHIEVEMENT','{}',1,'平台验证成就','Platform-verified achievement'),
  ('00000000-0000-4000-8000-000000000314','00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000304','LEARNING_COMPLETION','{}',1,'已完成学习经历','Completed learning experience'),
  ('00000000-0000-4000-8000-000000000315','00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000305','VERIFIED_ACHIEVEMENT','{"type":"COMMUNICATION"}',1,'平台验证传播成就','Platform-verified communication achievement')
ON CONFLICT ("id") DO NOTHING;
