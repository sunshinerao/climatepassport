import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);
function loadRecords() {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificate-records.ts");
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, require };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}
const { parseCertificateRecordsQuery, buildCertificateRecordsWhere, buildCertificateRecordsAggregateWhere, certificateRecordsOrderBy } = loadRecords();

test("certificate records query bounds pagination and rejects invalid filters", () => {
  const query = parseCertificateRecordsQuery({ page: "0", pageSize: "999", status: "NOPE", category: "not-a-uuid", search: "  holder  " });
  assert.equal(query.page, 1); assert.equal(query.pageSize, 20); assert.equal(query.status, undefined); assert.equal(query.category, undefined); assert.equal(query.search, "holder");
  assert.equal(JSON.stringify(certificateRecordsOrderBy), JSON.stringify([{ issuedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]));
});

test("certificate records filters produce bounded deterministic database arguments", () => {
  const query = parseCertificateRecordsQuery({ page: "3", pageSize: "50", search: "ABC", status: "ISSUED", category: "11111111-1111-4111-8111-111111111111", issuedFrom: "2026-01-01", issuedTo: "2026-01-31" });
  const where = buildCertificateRecordsWhere(query);
  assert.equal(where.status, "ISSUED"); assert.equal(where.definition.categoryId, query.category); assert.equal(where.OR.length, 2); assert.equal(where.issuedAt.gte.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(JSON.stringify(buildCertificateRecordsAggregateWhere(query)), JSON.stringify(where));
});

test("records UI contains lifecycle actions without export or delete controls", () => {
  const source = fs.readFileSync(path.resolve("apps/passport-web/components/certificate-admin-prototype.tsx"), "utf8");
  const section = source.slice(source.indexOf("export function CertificateAdminRecords"), source.indexOf("export function CertificateAdminAuditLogs"));
  assert.equal(section.includes("Export CSV"), false); assert.equal(section.includes("Delete") || section.includes("删除"), false);
  assert.equal(section.includes('handleLifecycle(issue, "revoke")'), true); assert.equal(section.includes('handleLifecycle(issue, "restore")'), true); assert.equal(section.includes('handleLifecycle(issue, "regenerate")'), true);
  assert.equal(section.includes("rows.filter((issue) => !issue.status"), false);
  assert.match(section, /summary\.active/); assert.match(section, /summary\.revoked/);
});

test("lifecycle routes preserve guards, manual values, and transactional audits (CP-AUD-005)", () => {
  const root = path.resolve("apps/passport-web/app/api");
  const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
  const revoke = read("admin/certificates/[id]/revoke/route.ts");
  const restore = read("admin/certificates/[id]/restore/route.ts");
  const regenerate = read("admin/certificates/[id]/regenerate/route.ts");
  const artifact = read("certificates/[id]/artifact/route.ts");
  assert.match(revoke, /z\.string\(\)\.trim\(\)\.min\(3\)/); assert.match(revoke, /canRevokeCertificateStatus/); assert.match(revoke, /revocationReason: payload\.data\.reason/);
  assert.match(restore, /canRestoreCertificateStatus/); assert.match(regenerate, /canRegenerateCertificateStatus/); assert.match(regenerate, /\.\.\.snapshot\.variableValues/);
  for (const source of [revoke, restore, regenerate]) {
    assert.match(source, /\$transaction/);
    assert.match(source, /tx\.coreAuditLog\.create/);
    assert.equal(source.includes("void writeCoreAuditLog"), false, "critical state transitions must not use best-effort audit writes");
    assert.match(source, /updateMany\(\{/);
    assert.match(source, /CertificateStatusConflict/);
  }
  assert.match(artifact, /writeCoreAuditLog[\s\S]*?\.catch\(/); assert.match(artifact, /disposition === "attachment"/); assert.match(artifact, /downloadCount: \{ increment: 1 \}/);
});
