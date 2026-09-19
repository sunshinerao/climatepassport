import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("certificate application schema and migration preserve independent state and constraints", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260913020000_certificate_applications_phase1/migration.sql");
  assert.match(schema, /enum CertificateApplicationStatus[\s\S]*NEEDS_INFORMATION[\s\S]*WITHDRAWN/);
  assert.match(schema, /model CertificateApplicationEvent/);
  assert.match(schema, /certificateIssueId\s+String\?\s+@unique/);
  assert.match(migration, /WHERE "status" IN \('DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION'\)/);
  assert.match(migration, /applicantId", "idempotencyKey/);
});

test("applicant routes enforce ownership, allowed states, eligibility, and idempotency", () => {
  const create = read("apps/passport-web/app/api/certificate-applications/route.ts");
  const item = read("apps/passport-web/app/api/certificate-applications/[id]/route.ts");
  const withdraw = read("apps/passport-web/app/api/certificate-applications/[id]/withdraw/route.ts");
  assert.match(create, /applicantId_idempotencyKey/);
  assert.match(create, /applicationEligibilityWhere/);
  assert.match(item, /applicantId: user.id/);
  assert.match(item, /"DRAFT", "NEEDS_INFORMATION"/);
  assert.match(withdraw, /"DRAFT", "SUBMITTED", "NEEDS_INFORMATION"/);
});

test("admin review requires admin role, visible messages, and submitted state", () => {
  const review = read("apps/passport-web/app/api/admin/certificate-applications/[id]/review/route.ts");
  assert.match(review, /reviewer.role !== "ADMIN"/);
  assert.match(review, /An applicant-visible message is required/);
  assert.match(review, /application.status !== "SUBMITTED"/);
});

test("approval preserves source provenance, consistent timestamp, event audit notification, and retry protection", () => {
  const service = read("apps/passport-web/lib/server/certificate-applications.ts");
  assert.match(service, /sourceType: "CERTIFICATE_APPLICATION", sourceId: current.id/);
  assert.match(service, /const issuedAt = new Date\(\)/);
  assert.match(service, /issueDate: issuedAt/);
  assert.match(service, /createCertificateRenderSnapshot/);
  for (const field of ["holderName", "certificateName", "categoryName", "issueDate", "variableValues"]) assert.match(service, new RegExp(field));
  assert.match(service, /certificateApplicationEvent\.create/);
  assert.match(service, /coreAuditLog\.create/);
  assert.match(service, /notification\.create/);
  assert.match(service, /P2002.*P2034/);
  assert.match(service, /Certificate artifact generation failed/);
});

test("certificate application UI has real editing/resubmission/history and no fake attachments", () => {
  const userUi = read("apps/passport-web/components/certificate-user-prototype.tsx");
  const adminUi = read("apps/passport-web/components/certificate-admin-prototype.tsx");
  assert.match(userUi, /saveApplication\(true\)/);
  assert.match(userUi, /editApplication\(application\)/);
  assert.match(userUi, /application\.events/);
  const applicationSection = adminUi.slice(adminUi.indexOf("export function CertificateAdminApplications"), adminUi.indexOf("export function CertificateAdminRules"));
  assert.doesNotMatch(applicationSection, /Attachments|附件|1 file/);
  assert.match(applicationSection, /certificate-applications.*review/);
});
