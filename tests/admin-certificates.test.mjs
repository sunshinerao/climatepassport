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

  const writeData = buildCertificateCategoryWriteData(parsed);
  assert.equal(writeData.key, "course-certificate");
  assert.equal(writeData.name, "Course Certificate");
  assert.equal(writeData.nameEn, null);
  assert.equal(writeData.description, null);
  assert.equal(writeData.descriptionEn, null);
  assert.equal(writeData.order, undefined);
  assert.equal(writeData.isActive, true);

  const orderedWriteData = buildCertificateCategoryWriteData(parsed, 9);
  assert.equal(orderedWriteData.key, "course-certificate");
  assert.equal(orderedWriteData.name, "Course Certificate");
  assert.equal(orderedWriteData.nameEn, null);
  assert.equal(orderedWriteData.description, null);
  assert.equal(orderedWriteData.descriptionEn, null);
  assert.equal(orderedWriteData.order, 9);
  assert.equal(orderedWriteData.isActive, true);
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
  assert.equal(templateData.templateConfigJson.fields.includes("completionDate"), true);
  assert.equal(templateData.templateConfigJson.fields.includes("learningHours"), true);
  assert.equal(templateData.templateConfigJson.fields.includes("capabilityTags"), true);
  assert.equal(templateData.templateConfigJson.fields.includes("signer"), true);
  assert.equal(templateData.templateConfigJson.fields.includes("institutionName"), true);

  const definitionData = buildCertificateDefinitionWriteData(
    parsed,
    "22222222-2222-4222-8222-222222222222",
  );
  assert.equal(definitionData.name, "Speaker Certificate");
  assert.equal(definitionData.templateId, "22222222-2222-4222-8222-222222222222");
  assert.equal(definitionData.approvalMode, "manual");
  assert.equal(definitionData.verificationMode, "PUBLIC_CODE");
});

test("certificate template render config sanitizes preview-compatible element payloads", () => {
  const parsed = certificateTemplatePayloadSchema.parse({
    categoryId: "11111111-1111-4111-8111-111111111111",
    name: "Speaker Certificate",
    templateType: "CUSTOM",
    elements: [
      {
        id: "verification-qr",
        kind: "QR",
        x: 78,
        y: 72,
        width: 14,
        height: 16,
        qrLabelGap: "2",
        qrLabelOffsetY: "-1",
        qrLabelFontSize: "9",
        content: "Scan to verify this credential",
        label: null,
        extraField: "ignored",
      },
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

  const renderConfig = buildCertificateTemplateRenderConfig(parsed);
  assert.equal(Array.isArray(renderConfig.elements), true);
  assert.equal(renderConfig.elements.length, 3);
  assert.equal(renderConfig.elements[0].kind, "QR");
  assert.equal(renderConfig.elements[0].qrLabelGap, 2);
  assert.equal(renderConfig.elements[0].qrLabelOffsetY, -1);
  assert.equal(renderConfig.elements[0].qrLabelFontSize, 9);
  assert.equal(renderConfig.elements[0].label, undefined);
  assert.equal(renderConfig.elements[0].extraField, undefined);
  assert.equal(renderConfig.elements[1].variable, "programNameEn");
  assert.equal(renderConfig.elements[2].variable, "completionDate");
});
