import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260913030000_activity_checkin_certificate_issuance/migration.sql");
const scanner = read("apps/passport-web/app/api/verifier/scan/route.ts");
const helper = read("apps/passport-web/lib/server/activity-checkin-certificate-issuance.ts");

test("activity certificate issuance schema and local migration reserve one rule per participation with durable links", () => {
  assert.match(schema, /model ActivityCertificateIssuance[\s\S]*@@unique\(\[ruleId, participationId\]\)/);
  for (const field of ["activityId", "participationId", "checkinRecordId", "certificateDefinitionId", "certificateIssueId", "attemptCount", "error"]) assert.match(schema, new RegExp(`\\b${field}\\b`));
  assert.match(migration, /CREATE TABLE "activity_certificate_issuances"/);
  assert.match(migration, /ruleId_participationId_key/);
  for (const foreignKey of ["activityId_fkey", "participationId_fkey", "checkinRecordId_fkey", "ruleId_fkey", "certificateDefinitionId_fkey", "certificateIssueId_fkey"]) assert.match(migration, new RegExp(foreignKey));
});

test("only authoritative unified scanner reserves and awaits eligible Activity QR issuance", () => {
  assert.match(scanner, /qr\.type === "ACTIVITY_CHECKIN"/);
  assert.match(scanner, /activityCheckinRecord\.create/);
  assert.match(scanner, /activityCertificateIssuance\.upsert/);
  assert.match(scanner, /ruleId_participationId/);
  assert.match(scanner, /Promise\.all\(checkin\.issuances\.map\(finalizeActivityCheckinCertificateIssuance\)\)/);
  assert.match(scanner, /certificateIssuance: \{[\s\S]*reserved:[\s\S]*issued:[\s\S]*failed:/);
  for (const directRoute of ["apps/passport-web/app/api/activity-checkin/route.ts", "apps/passport-web/app/api/checkin/activity-verify/route.ts"]) assert.doesNotMatch(read(directRoute), /finalizeActivityCheckinCertificateIssuance|activityCertificateIssuance/);
});

test("eligibility is unconditional active automatic chain only and finalization is idempotent", () => {
  for (const requirement of ["issuance.rule.trigger === \"ACTIVITY_CHECKIN\"", "issuance.rule.autoIssue", "issuance.rule.isActive", "!issuance.rule.requiresAdminConfirmation", "isEmptyCertificateCondition", "certificateDefinition.isActive", "approvalMode === \"auto\"", "template.isActive", "category.isActive", "category.autoIssueEnabled"]) assert.match(helper, new RegExp(requirement.replace(/[.]/g, "\\.")));
  assert.match(helper, /if \(issuance\.rule\.notifyUser\)/);
  assert.match(helper, /if \(issuance\.status === "ISSUED"\) return \{ status: "issued"/);
  assert.match(helper, /status: "FAILED"[\s\S]*safeError/);
  assert.match(helper, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(helper, /tx\.coreAuditLog\.create/);
  assert.match(helper, /tx\.notification\.create/);
  assert.match(helper, /sourceType: "ACTIVITY_CHECKIN"/);
});

test("issued Activity certificates snapshot a reproducible sanitized render contract and provenance", () => {
  for (const field of ["schemaVersion: 1", "templateId:", "templateVersion:", "renderConfigJson", "holderName", "certificateName", "categoryName", "issuedAt:", "variableValues", "activityId:", "participationId:", "checkinRecordId:", "ruleId:", "issuanceId:"]) assert.ok(helper.includes(field), `snapshot must include ${field}`);
  assert.match(helper, /parseCertificateRenderConfig\(issuance\.certificateDefinition\.template\.renderConfigJson\)/);
  assert.match(helper, /checkinRecord\.checkinAt/);
});

test("scanner issuance summary is data-minimized", () => {
  const summary = scanner.slice(scanner.indexOf("certificateIssuance:"), scanner.indexOf("certificateIssuance:") + 260);
  assert.doesNotMatch(summary, /issuanceId|checkinRecordId|participationId|certificateIssueId|userId/);
});
