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

  const extended = parseCertificateRenderConfig({
    elements: [
      {
        id: "program-name",
        kind: "VARIABLE",
        variable: "programNameEn",
        x: 10,
        y: 10,
        width: 40,
        height: 8,
      },
      {
        id: "completion-date",
        kind: "VARIABLE",
        variable: "completionDate",
        x: 10,
        y: 20,
        width: 30,
        height: 8,
      },
    ],
  });

  assert.equal(extended.elements?.[0]?.variable, "programNameEn");
  assert.equal(extended.elements?.[1]?.variable, "completionDate");
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

test("renderCertificateHtml emits printable background image layer", () => {
  const html = renderCertificateHtml({
    holderName: "Alice",
    certificateName: "Climate Credential",
    categoryName: "Course",
    issueDate: "2026-05-23",
    certificateNumber: "CV-123",
    renderConfig: {
      backgroundImageUrl: "data:image/png;base64,AAAA",
    },
  });

  assert.equal(html.includes('class="cert-background-image"'), true);
  assert.equal(html.includes('src="data:image/png;base64,AAAA"'), true);
});

test("renderCertificateHtml resolves merged variable values", () => {
  const html = renderCertificateHtml({
    holderName: "Alice",
    certificateName: "Climate Credential",
    categoryName: "Course",
    issueDate: "2026-05-23",
    certificateNumber: "CV-123",
    variableValues: {
      programNameEn: "Ocean Summer School",
      completionDate: "2026-05-20",
      capabilityTags: ["Systems Thinking", "Climate Communication"],
    },
    renderConfig: {
      elements: [
        {
          id: "program-name",
          kind: "VARIABLE",
          variable: "programNameEn",
          x: 10,
          y: 10,
          width: 40,
          height: 8,
        },
        {
          id: "completion-date",
          kind: "VARIABLE",
          variable: "completionDate",
          x: 10,
          y: 20,
          width: 30,
          height: 8,
        },
        {
          id: "capability-tags",
          kind: "VARIABLE",
          variable: "capabilityTags",
          x: 10,
          y: 30,
          width: 70,
          height: 8,
        },
      ],
    },
  });

  assert.equal(html.includes("Ocean Summer School"), true);
  assert.equal(html.includes("2026-05-20"), true);
  assert.equal(html.includes("Systems Thinking, Climate Communication"), true);
});

test("buildCertificateArtifact returns stable html data url and file metadata", () => {
  const artifact = buildCertificateArtifact({
    holderName: "Alice",
    certificateName: "Climate Credential",
    categoryName: "Course",
    issueDate: new Date("2026-05-23T00:00:00.000Z"),
    certificateNumber: "CV-TEST",
    renderConfigJson: { issuerName: "GCA", pageSize: "DIGITAL_CARD", accentColor: "#112233" },
    variableValues: {
      programNameEn: "Ocean Summer School",
    },
  });

  assert.equal(artifact.fileName, "Course-Climate Credential-Alice-CV-TEST.html");
  assert.equal(artifact.pdfFileName, "Course-Climate Credential-Alice-CV-TEST.pdf");
  assert.equal(artifact.mimeType, "text/html");
  assert.equal(artifact.dataUrl.startsWith("data:text/html;charset=utf-8,"), true);
  assert.equal(decodeURIComponent(artifact.dataUrl).includes("GCA"), true);
  assert.equal(decodeURIComponent(artifact.dataUrl).includes("digital-card"), true);
  assert.equal(decodeURIComponent(artifact.dataUrl).includes("Ocean Summer School"), false);
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
    variableValues: {
      courseNameEn: "Climate Policy Bootcamp",
    },
  });

  const html = decodeURIComponent(artifact.dataUrl);

  assert.equal(artifact.fileName, "Course-Climate Credential-Alice-CV-TEST-QR.html");
  assert.equal(html.includes("https://passport.example/verify/certificate/CV-TEST-QR"), true);
  assert.equal(html.includes("<svg"), true);
  assert.equal(html.includes("Scan to verify this credential"), true);
  assert.equal(html.includes("Climate Policy Bootcamp"), false);
});

test("artifact builders forward variableValues into configured variable elements", async () => {
  const renderConfigJson = {
    elements: [
      {
        id: "program-name",
        kind: "VARIABLE",
        variable: "programNameEn",
        x: 10,
        y: 10,
        width: 40,
        height: 8,
      },
    ],
  };

  const artifact = buildCertificateArtifact({
    holderName: "Alice",
    certificateName: "Climate Credential",
    categoryName: "Course",
    issueDate: new Date("2026-05-23T00:00:00.000Z"),
    certificateNumber: "CV-TEST-VV",
    renderConfigJson,
    variableValues: {
      programNameEn: "Ocean Summer School",
    },
  });

  const artifactWithQr = await buildCertificateArtifactWithQr({
    holderName: "Alice",
    certificateName: "Climate Credential",
    categoryName: "Course",
    issueDate: new Date("2026-05-23T00:00:00.000Z"),
    certificateNumber: "CV-TEST-VV-QR",
    verificationUrl: "https://passport.example/verify/certificate/CV-TEST-VV-QR",
    renderConfigJson,
    variableValues: {
      programNameEn: "Climate Systems Lab",
    },
  });

  const html = decodeURIComponent(artifact.dataUrl);
  const htmlWithQr = decodeURIComponent(artifactWithQr.dataUrl);

  assert.equal(html.includes("Ocean Summer School"), true);
  assert.equal(htmlWithQr.includes("Climate Systems Lab"), true);
});
