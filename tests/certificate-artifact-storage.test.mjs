import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);
function loadStorage(fetchImpl = globalThis.fetch) {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificate-artifact-storage.ts");
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, require, process, Buffer, fetch: fetchImpl, Date, Error, URL };
  sandbox.module.exports = sandbox.exports; vm.runInNewContext(compiled, sandbox, { filename: sourcePath }); return sandbox.module.exports;
}

test("artifact storage fails closed for missing configuration and rejects traversal keys", async () => {
  const old = { ...process.env }; delete process.env.CERTIFICATE_ARTIFACT_STORAGE;
  const storage = loadStorage();
  await assert.rejects(storage.putCertificateArtifact("issue", { bytes: Buffer.from("x"), contentType: "text/html", fileName: "x.html" }), /not configured/);
  assert.throws(() => storage.normalizeCertificateArtifactKey("certificates/../secret.html"), /Invalid/);
  assert.throws(() => storage.normalizeCertificateArtifactKey("certificates/id/not-a-hash.html"), /Invalid/);
  process.env = old;
});

test("local storage atomically persists immutable artifact and validates hash on read", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "certificate-artifact-"));
  const oldMode = process.env.CERTIFICATE_ARTIFACT_STORAGE, oldRoot = process.env.CERTIFICATE_ARTIFACT_LOCAL_ROOT;
  process.env.CERTIFICATE_ARTIFACT_STORAGE = "local"; process.env.CERTIFICATE_ARTIFACT_LOCAL_ROOT = root;
  const storage = loadStorage(); const artifact = { bytes: Buffer.from("<html>safe</html>"), contentType: "text/html", fileName: "unsafe/../certificate.html" };
  const stored = await storage.putCertificateArtifact("issue_1", artifact);
  assert.equal(stored.byteSize, artifact.bytes.length); assert.equal(stored.sha256.length, 64); assert.deepEqual(await storage.getCertificateArtifact(stored), artifact.bytes);
  assert.equal(fs.existsSync(path.join(root, stored.key)), true);
  process.env.CERTIFICATE_ARTIFACT_STORAGE = oldMode; process.env.CERTIFICATE_ARTIFACT_LOCAL_ROOT = oldRoot; fs.rmSync(root, { recursive: true, force: true });
});

test("local storage persists bounded PDF artifacts with a PDF key", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "certificate-pdf-artifact-"));
  const oldMode = process.env.CERTIFICATE_ARTIFACT_STORAGE, oldRoot = process.env.CERTIFICATE_ARTIFACT_LOCAL_ROOT;
  process.env.CERTIFICATE_ARTIFACT_STORAGE = "local"; process.env.CERTIFICATE_ARTIFACT_LOCAL_ROOT = root;
  const storage = loadStorage();
  const bytes = Buffer.from("%PDF-1.7\nfixture");
  const stored = await storage.storeBuiltCertificateArtifact("issue_pdf", { bytes, mimeType: "application/pdf", fileName: "气候证书.pdf" });
  assert.match(stored.artifactKey, /\.pdf$/);
  assert.equal(stored.artifactContentType, "application/pdf");
  assert.equal(stored.generatedFileName, "气候证书.pdf");
  assert.deepEqual(await storage.getCertificateArtifact({ provider: stored.artifactProvider, key: stored.artifactKey, sha256: stored.artifactSha256 }), bytes);
  process.env.CERTIFICATE_ARTIFACT_STORAGE = oldMode; process.env.CERTIFICATE_ARTIFACT_LOCAL_ROOT = oldRoot; fs.rmSync(root, { recursive: true, force: true });
});

test("HTTP adapter uses private PUT/GET contract and legacy decoding refuses external URLs", async () => {
  const calls = []; const bytes = Buffer.from("<html>http</html>");
  const oldMode = process.env.CERTIFICATE_ARTIFACT_STORAGE, oldBase = process.env.CERTIFICATE_ARTIFACT_HTTP_BASE_URL, oldAuth = process.env.CERTIFICATE_ARTIFACT_HTTP_AUTHORIZATION;
  process.env.CERTIFICATE_ARTIFACT_STORAGE = "http"; process.env.CERTIFICATE_ARTIFACT_HTTP_BASE_URL = "https://store.internal"; process.env.CERTIFICATE_ARTIFACT_HTTP_AUTHORIZATION = "Bearer private";
  const storage = loadStorage(async (url, init = {}) => { calls.push({ url, init }); return init.method === "PUT" ? new Response("", { status: 201 }) : new Response(bytes, { status: 200 }); });
  const stored = await storage.putCertificateArtifact("issue_2", { bytes, contentType: "text/html", fileName: "certificate.html" });
  assert.equal(calls[0].init.headers.authorization, "Bearer private"); assert.equal(calls[0].init.headers["x-content-sha256"], stored.sha256); assert.deepEqual(await storage.getCertificateArtifact(stored), bytes);
  assert.equal(calls[1].init.headers.authorization, "Bearer private"); assert.equal(storage.decodeLegacyCertificateArtifact("https://169.254.169.254/latest/meta-data"), null); assert.equal(storage.decodeLegacyCertificateArtifact("data:text/html,%3Chtml%3Eok%3C/html%3E").bytes.toString(), "<html>ok</html>");
  process.env.CERTIFICATE_ARTIFACT_STORAGE = oldMode; process.env.CERTIFICATE_ARTIFACT_HTTP_BASE_URL = oldBase; process.env.CERTIFICATE_ARTIFACT_HTTP_AUTHORIZATION = oldAuth;
});

test("artifact route and issuance/UI sources use private authorized artifacts", () => {
  const root = path.resolve("apps/passport-web");
  const route = fs.readFileSync(path.join(root, "app/api/certificates/[id]/artifact/route.ts"), "utf8");
  assert.match(route, /issue\.userId !== user\.id && user\.role !== "ADMIN"/); assert.match(route, /private, no-store/); assert.match(route, /x-content-type-options/); assert.match(route, /content-security-policy/); assert.match(route, /disposition === "attachment"/);
  for (const relative of ["lib/server/certificate-issuance.ts", "app/api/admin/certificates/[id]/regenerate/route.ts", "lib/server/certificate-applications.ts", "lib/server/activity-checkin-certificate-issuance.ts", "app/api/admin/learning-experiences/applications/[id]/status/route.ts"]) {
    const source = fs.readFileSync(path.join(root, relative), "utf8"); assert.match(source, /storeBuiltCertificateArtifact/); assert.equal(source.includes("generatedFileUrl: artifact.dataUrl"), false);
  }
  const issueRoute = fs.readFileSync(path.join(root, "app/api/admin/certificates/issue/route.ts"), "utf8");
  assert.match(issueRoute, /issueCertificateToRecipient/);
  const batchService = fs.readFileSync(path.join(root, "lib/server/certificate-batch-issuance.ts"), "utf8");
  assert.match(batchService, /processCertificateBatchChunk/); assert.match(batchService, /leaseExpiresAt/);
  const ui = fs.readFileSync(path.join(root, "components/certificate-actions.tsx"), "utf8"); assert.match(ui, /\/artifact\?disposition=attachment/); assert.equal(ui.includes("generatedFileUrl"), false);
});
