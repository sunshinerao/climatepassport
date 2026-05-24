import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadAdminCertificateModule() {
  const sourcePath = path.resolve("apps/passport-web/lib/server/admin-certificates.ts");
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
    require,
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const {
  buildCertificateCategoryWriteData,
  buildCertificateDefinitionWriteData,
  buildCertificateTemplateRenderConfig,
  buildCertificateTemplateWriteData,
  certificateCategoryPayloadSchema,
  certificateTemplatePayloadSchema,
} = loadAdminCertificateModule();

test("certificateCategoryPayloadSchema rejects unsafe category keys", () => {
  assert.equal(certificateCategoryPayloadSchema.safeParse({
    key: "../course",
    name: "Course Certificate",
  }).success, false);

  const parsed = certificateCategoryPayloadSchema.parse({
    key: "course-certificate",
    name: "Course Certificate",
    isActive: true,
  });

  assert.equal(JSON.stringify(buildCertificateCategoryWriteData(parsed)), JSON.stringify({
    key: "course-certificate",
    name: "Course Certificate",
    nameEn: null,
    description: null,
    descriptionEn: null,
    order: 0,
    isActive: true,
  }));
});

test("certificate template payload builds render config and issue definition", () => {
  const parsed = certificateTemplatePayloadSchema.parse({
    categoryId: "11111111-1111-4111-8111-111111111111",
    name: "Speaker Certificate",
    nameEn: "Speaker Certificate",
    templateType: "CUSTOM",
    issuerName: "Climate Passport",
    pageSize: "DIGITAL_CARD",
    accentColor: "#123456",
    backgroundColor: "#f7fbf8",
    approvalMode: "manual",
  });

  const renderConfig = buildCertificateTemplateRenderConfig(parsed);
  assert.equal(renderConfig.issuerName, "Climate Passport");
  assert.equal(renderConfig.pageSize, "DIGITAL_CARD");
  assert.equal(renderConfig.accentColor, "#123456");
  assert.equal(renderConfig.backgroundColor, "#f7fbf8");
  assert.equal(Array.isArray(renderConfig.elements), true);
  assert.equal(renderConfig.elements.some((item) => item.kind === "QR"), true);

  const templateData = buildCertificateTemplateWriteData(parsed);
  assert.equal(templateData.templateType, "CUSTOM");
  assert.equal(templateData.version, 1);
  assert.equal(templateData.isActive, true);

  const definitionData = buildCertificateDefinitionWriteData(
    parsed,
    "22222222-2222-4222-8222-222222222222",
  );
  assert.equal(definitionData.name, "Speaker Certificate");
  assert.equal(definitionData.templateId, "22222222-2222-4222-8222-222222222222");
  assert.equal(definitionData.approvalMode, "manual");
  assert.equal(definitionData.verificationMode, "PUBLIC_CODE");
});
