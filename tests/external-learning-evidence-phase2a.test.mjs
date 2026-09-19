import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => fs.readFileSync(path.resolve(file), "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260913050000_external_learning_evidence_phase2a/migration.sql");
const contracts = read("packages/passport-contracts/src/index.ts");
const helper = read("apps/passport-web/lib/server/external-learning.ts");
const webhook = read("apps/passport-web/app/api/integrations/learning/[providerKey]/webhooks/route.ts");
const accounts = read("apps/passport-web/app/api/admin/external-learning/accounts/route.ts");
const mappings = read("apps/passport-web/app/api/admin/external-learning/course-mappings/route.ts");

test("Phase 2A schema and local migration define scoped uniqueness, enums, and exclusive mapping targets", () => {
  for (const value of ["ExternalLearningProviderStatus", "DRAFT", "ACTIVE", "DISABLED", "ExternalLearningAccountStatus", "ExternalLearningEvidenceState"]) assert.match(schema, new RegExp(value));
  assert.match(schema, /@@unique\(\[providerId, externalSubjectHash\]\)/);
  assert.match(schema, /@@unique\(\[providerId, externalCourseHash\]\)/);
  assert.match(schema, /@@unique\(\[providerId, deliveryId\]\)/);
  assert.match(schema, /@@unique\(\[providerId, externalEventId\]\)/);
  assert.match(migration, /target_check" CHECK \(\("learningExperienceProgramId" IS NOT NULL\) <> \("activityId" IS NOT NULL\)\)/);
});

test("webhook is raw-body HMAC, replay bounded, timing-safe, redacted, and refuses unconfigured providers", () => {
  assert.match(helper, /timingSafeEqual/); assert.match(helper, /update\(rawBody\)/); assert.match(helper, /MAX_EXTERNAL_LEARNING_BODY_BYTES = 64 \* 1024/);
  assert.match(helper, /NODE_ENV !== "production"/); assert.match(helper, /local:EXTERNAL_LEARNING_WEBHOOK_SECRET/);
  assert.match(webhook, /provider\.status !== "ACTIVE".*status: 404/); assert.match(webhook, /await request\.arrayBuffer\(\)/);
  assert.match(webhook, /WEBHOOK_MAX_AGE_SECONDS/); assert.match(webhook, /rawBody\.length > MAX_EXTERNAL_LEARNING_BODY_BYTES/);
  assert.match(webhook, /redactExternalLearningHeaders/); assert.doesNotMatch(webhook, /rawPayload|payloadJson|request\.json\(\)/);
  assert.match(helper, /SENSITIVE_HEADERS/); assert.match(helper, /authorization/);
});

test("webhook receipt is idempotent and has no normalization, completion, credential, points, or writeback call", () => {
  assert.match(webhook, /externalLearningInboxEvent\.create/); assert.match(webhook, /error\.code === "P2002"/); assert.match(webhook, /status: 202/);
  for (const prohibited of ["externalLearningEvidence.create", "certificate", "point", "achievement", "participation", "writeback", "normalize"]) assert.doesNotMatch(webhook.toLowerCase(), new RegExp(prohibited));
  assert.match(webhook, /sensitive: true/);
  const unavailable = webhook.indexOf("if (limit.unavailable)");
  const rateLimited = webhook.indexOf("if (!limit.allowed)");
  assert.ok(unavailable >= 0 && unavailable < rateLimited, "unavailable rate-limit backend must return 503 before a 429 response");
  assert.match(webhook, /limit\.unavailable.*SERVICE_UNAVAILABLE.*status: 503/);
});

test("admin account and mapping APIs are strict, opaque, bounded, and enforce provider/target constraints", () => {
  for (const source of [accounts, mappings]) { assert.match(source, /user\?\.role === "ADMIN"/); assert.match(source, /ExternalLearningAdminListQuerySchema/); assert.match(source, /take: query\.data\.limit \+ 1/); assert.match(source, /sha256Reference/); }
  assert.match(contracts, /ExternalLearningAccountPayloadSchema/); assert.match(contracts, /ExternalLearningCourseMappingPayloadSchema/); assert.match(contracts, /Exactly one target is required/);
  assert.match(contracts, /action: z\.enum\(\["VERIFY", "DISABLE"\]\)/); assert.match(accounts, /externalSubjectHash: sha256Reference/); assert.doesNotMatch(accounts, /externalSubjectId:/);
  assert.match(mappings, /provider\?\.status !== "ACTIVE"/); assert.match(mappings, /learningExperienceProgram\.findUnique/); assert.match(mappings, /activity\.findUnique/); assert.match(contracts, /action: z\.enum\(\["ACTIVATE", "DISABLE"\]\)/);
  assert.match(accounts, /EXTERNAL_LEARNING_ACCOUNT_\$\{body\.data\.action\}D/); assert.match(mappings, /EXTERNAL_LEARNING_COURSE_MAPPING_\$\{body\.data\.action\}D/);
});
