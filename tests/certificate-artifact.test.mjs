import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadCertificateModule() {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificate-module.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: (moduleName) => {
      if (moduleName === "@climate-passport/passport-core") {
        return { maskPassportId: (value) => value };
      }
      if (moduleName === "@/lib/server/prisma") {
        return { getPrismaClient: () => null };
      }
      return require(moduleName);
    },
    Intl,
    Date,
    encodeURIComponent,
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const {
  buildCertificateArtifact,
  buildCertificateArtifactWithQr,
  parseCertificateRenderConfig,
  renderCertificateHtml,
} = loadCertificateModule();

test("parseCertificateRenderConfig accepts safe visual options only", () => {
  assert.equal(JSON.stringify(parseCertificateRenderConfig({
    issuerName: "Global Climate Alliance",
    pageSize: "A4_PORTRAIT",
    accentColor: "#123456",
    backgroundColor: "#abcdef",
  })), JSON.stringify({
    issuerName: "Global Climate Alliance",
    pageSize: "A4_PORTRAIT",
    accentColor: "#123456",
    backgroundColor: "#abcdef",
  }));

  assert.equal(JSON.stringify(parseCertificateRenderConfig({
    issuerName: " ",
    pageSize: "SCRIPT",
    accentColor: "red",
    backgroundColor: "url(evil)",
  })), JSON.stringify({}));
});

test("renderCertificateHtml escapes holder and certificate fields", () => {
  const html = renderCertificateHtml({
    holderName: "<Alice & Bob>",
    certificateName: "Climate <Credential>",
    categoryName: "Course & Role",
    issueDate: "2026-05-23",
    certificateNumber: "CV-123",
  });

  assert.equal(html.includes("<Alice & Bob>"), false);
  assert.equal(html.includes("&lt;Alice &amp; Bob&gt;"), true);
  assert.equal(html.includes("Climate &lt;Credential&gt;"), true);
});

test("buildCertificateArtifact returns stable html data url and file metadata", () => {
  const artifact = buildCertificateArtifact({
    holderName: "Alice",
    certificateName: "Climate Credential",
    categoryName: "Course",
    issueDate: new Date("2026-05-23T00:00:00.000Z"),
    certificateNumber: "CV-TEST",
    renderConfigJson: { issuerName: "GCA", pageSize: "DIGITAL_CARD", accentColor: "#112233" },
  });

  assert.equal(artifact.fileName, "Course-Climate Credential-Alice-CV-TEST.html");
  assert.equal(artifact.pdfFileName, "Course-Climate Credential-Alice-CV-TEST.pdf");
  assert.equal(artifact.mimeType, "text/html");
  assert.equal(artifact.dataUrl.startsWith("data:text/html;charset=utf-8,"), true);
  assert.equal(decodeURIComponent(artifact.dataUrl).includes("GCA"), true);
  assert.equal(decodeURIComponent(artifact.dataUrl).includes("digital-card"), true);
});

test("buildCertificateArtifactWithQr embeds a scannable verification SVG", async () => {
  const artifact = await buildCertificateArtifactWithQr({
    holderName: "Alice",
    certificateName: "Climate Credential",
    categoryName: "Course",
    issueDate: new Date("2026-05-23T00:00:00.000Z"),
    certificateNumber: "CV-TEST-QR",
    verificationUrl: "https://passport.example/verify/certificate/CV-TEST-QR",
    renderConfigJson: { accentColor: "#112233" },
  });

  const html = decodeURIComponent(artifact.dataUrl);

  assert.equal(artifact.fileName, "Course-Climate Credential-Alice-CV-TEST-QR.html");
  assert.equal(html.includes("https://passport.example/verify/certificate/CV-TEST-QR"), true);
  assert.equal(html.includes("<svg"), true);
  assert.equal(html.includes("Scan to verify this credential"), true);
});
