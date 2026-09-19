import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const storageMock = {
  storeBuiltCertificateArtifact: async (_id, artifact) => ({ generatedFileName: artifact.fileName, artifactProvider: "local", artifactKey: "certificates/test/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.html", artifactVersion: "a".repeat(64), artifactContentType: artifact.mimeType ?? "text/html", artifactByteSize: 15, artifactSha256: "a".repeat(64), artifactCreatedAt: new Date(), artifactVerifiedAt: new Date(), artifactState: "READY", artifactFailureReason: null }),
};

function loadServiceModule(sourcePath, moduleMocks) {
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
      if (Object.prototype.hasOwnProperty.call(moduleMocks, moduleName)) {
        return moduleMocks[moduleName];
      }
      return require(moduleName);
    },
    URL,
    Request,
    Response,
    Date,
    console,
    setTimeout,
    clearTimeout,
    encodeURIComponent,
    crypto,
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

function buildDefinition() {
  return {
    id: "def-1",
    name: "Climate Course",
    nameEn: "Climate Course",
    category: { name: "Course", nameEn: "Course" },
    templateId: "tpl-1",
    template: { renderConfigJson: {}, version: 3 },
  };
}

function buildBaseMocks(overrides = {}) {
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    coreAuditLog: { create: async () => ({ id: "audit-1" }) },
    certificateIssue: {
      findFirst: async () => null,
      findUnique: async () => null,
      create: async ({ data }) => ({ id: "issue-1", verificationCode: data.verificationCode, generatedFileName: data.generatedFileName }),
      update: async ({ data }) => ({ id: data.id ?? "issue-1", verificationCode: data.verificationCode, generatedFileName: data.generatedFileName }),
    },
    ...overrides.prisma,
  };

  const mocks = {
    "@/lib/server/auth": {
      normalizeUserEmail: (value) => value.trim().toLowerCase(),
    },
    "@/lib/server/passport-user-provisioning": {
      ensurePassportUserByEmail: async (_tx, { email }) => ({
        id: "user-1",
        email,
        name: "Alice",
        role: "ATTENDEE",
        status: "ACTIVE",
        climatePassportId: "PASS-1",
        created: false,
        normalizedEmail: email,
      }),
    },
    "@/lib/server/certificates": {
      allocateCertificateVerificationCode: async () => "CV-SVC-1",
    },
    "@/lib/server/certificate-module": {
      parseCertificateRenderConfig: () => ({ issuerName: "Climate Passport" }),
      buildCertificatePdfArtifactWithQr: async ({ certificateNumber }) => ({
        fileName: `Course-Climate Course-Alice-${certificateNumber}.pdf`,
        bytes: Buffer.from("%PDF-1.4 test"),
        pdfFileName: `Course-Climate Course-Alice-${certificateNumber}.pdf`,
        mimeType: "application/pdf",
      }),
    },
    "@/lib/server/certificate-artifact-storage": storageMock,
    "@/lib/server/certificate-variables": {
      buildIssuedCertificateVariableValues: () => ({
        holderName: "Alice",
        certificateName: "Climate Course",
        certificateNameEn: "Climate Course",
        categoryName: "Course",
        categoryNameEn: "Course",
      }),
    },
    "@/lib/server/achievement-badge": {
      createAchievementRecord: async () => ({ id: "achievement-1" }),
    },
    "@/lib/server/audit": {
      writeCoreAuditLog: async () => null,
    },
    ...overrides.mocks,
  };

  return { prisma, mocks };
}

test("issuance service returns 409 and existing issue identifiers on duplicate", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificate-issuance.ts");
  const { prisma, mocks } = buildBaseMocks({
    prisma: {
      certificateIssue: {
        findFirst: async () => ({ id: "issue-existing", verificationCode: "CV-EXISTING" }),
        findUnique: async () => null,
        create: async () => {
          throw new Error("create should not be called for duplicate issuance");
        },
      },
    },
    mocks: {
      "@/lib/server/certificates": {
        allocateCertificateVerificationCode: async () => {
          throw new Error("allocate should not be called for duplicate issuance");
        },
      },
      "@/lib/server/certificate-module": {
        parseCertificateRenderConfig: () => ({}),
        buildCertificatePdfArtifactWithQr: async () => {
          throw new Error("artifact build should not be called for duplicate issuance");
        },
      },
    },
  });

  const service = loadServiceModule(sourcePath, mocks);
  const result = await service.issueCertificateToRecipient(prisma, {
    email: "alice@example.com",
    certificateDefinition: buildDefinition(),
    adminUser: { id: "admin-1", name: "Admin" },
    issuedAt: new Date("2026-05-24T00:00:00Z"),
    manualVariableValues: {},
    verificationUrlBase: "https://passport.example",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.issueId, "issue-existing");
  assert.equal(result.verificationCode, "CV-EXISTING");
});

test("issuance service merges manual variable values into artifact rendering and persists source", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificate-issuance.ts");

  let artifactInput = null;
  let createdIssueData = null;
  let achievementInput = null;
  let auditInput = null;

  const { prisma, mocks } = buildBaseMocks({
    prisma: {
      coreAuditLog: {
        create: async ({ data }) => {
          auditInput = data;
          return { id: "audit-1" };
        },
      },
      certificateIssue: {
        findFirst: async () => null,
        findUnique: async () => null,
        create: async ({ data }) => {
          createdIssueData = data;
          return { id: "issue-1", verificationCode: data.verificationCode, generatedFileName: data.generatedFileName };
        },
      },
    },
    mocks: {
      "@/lib/server/certificate-module": {
        parseCertificateRenderConfig: () => ({ issuerName: "Climate Passport" }),
        buildCertificatePdfArtifactWithQr: async (input) => {
          artifactInput = input;
          return {
            fileName: "Course-Manual Title-Alice-CV-SVC-1.pdf",
            bytes: Buffer.from("%PDF-1.4 merged"),
            pdfFileName: "Course-Manual Title-Alice-CV-SVC-1.pdf",
            mimeType: "application/pdf",
          };
        },
      },
      "@/lib/server/achievement-badge": {
        createAchievementRecord: async (input) => {
          achievementInput = input;
          return { id: "achievement-1" };
        },
      },
    },
  });

  const service = loadServiceModule(sourcePath, mocks);
  const result = await service.issueCertificateToRecipient(prisma, {
    email: "Alice@Example.COM ",
    certificateDefinition: buildDefinition(),
    adminUser: { id: "admin-1", name: "Admin" },
    issuedAt: new Date("2026-05-24T00:00:00Z"),
    manualVariableValues: { certificateName: "Manual Title", roleName: "Speaker" },
    verificationUrlBase: "https://passport.example",
    sourceType: "CERTIFICATE_BATCH",
    sourceId: "certificate-batch-item:item-1",
    auditAction: "certificate.batch_item_issued",
    auditMetadata: { batchId: "batch-1" },
    auditContext: { ipAddress: "127.0.0.1", userAgent: "agent" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.email, "alice@example.com");
  assert.equal(result.verificationUrl, "https://passport.example/verify/certificate/CV-SVC-1");
  assert.ok(artifactInput);
  assert.equal(artifactInput.certificateName, "Manual Title");
  assert.equal(artifactInput.variableValues.roleName, "Speaker");
  assert.equal(artifactInput.certificateNumber, "CV-SVC-1");
  assert.ok(createdIssueData);
  assert.equal(createdIssueData.status, "ISSUED");
  assert.equal(createdIssueData.sourceType, "CERTIFICATE_BATCH");
  assert.equal(createdIssueData.sourceId, "certificate-batch-item:item-1");
  assert.equal(createdIssueData.approvedBy, "admin-1");
  assert.equal(createdIssueData.renderSnapshotJson.templateVersion, 3);
  assert.equal(createdIssueData.renderSnapshotJson.certificateName, "Manual Title");
  assert.equal(createdIssueData.generatedFileUrl, undefined);
  assert.ok(achievementInput);
  assert.equal(achievementInput.userId, "user-1");
  assert.equal(achievementInput.relatedCertificateId, "issue-1");
  assert.equal(auditInput.action, "certificate.batch_item_issued");
  assert.equal(auditInput.metadataJson.batchId, "batch-1");
  assert.equal(auditInput.ipAddress, "127.0.0.1");
});

test("issuance service uses deterministic issue id and honors skipDuplicateIssueId", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificate-issuance.ts");

  const seenDuplicateWhere = [];
  let createdIssueData = null;

  const { prisma, mocks } = buildBaseMocks({
    prisma: {
      certificateIssue: {
        findFirst: async ({ where }) => {
          seenDuplicateWhere.push(where);
          return null;
        },
        findUnique: async () => null,
        create: async ({ data }) => {
          createdIssueData = data;
          return { id: data.id, verificationCode: data.verificationCode, generatedFileName: data.generatedFileName };
        },
      },
    },
  });

  const service = loadServiceModule(sourcePath, mocks);
  const result = await service.issueCertificateToRecipient(prisma, {
    email: "alice@example.com",
    certificateDefinition: buildDefinition(),
    adminUser: { id: "admin-1", name: "Admin" },
    issuedAt: new Date("2026-05-24T00:00:00Z"),
    manualVariableValues: {},
    verificationUrlBase: "https://passport.example",
    deterministicIssueId: "deterministic-issue-id",
    skipDuplicateIssueId: "reconciled-issue-id",
  });

  assert.equal(result.ok, true);
  assert.equal(result.issueId, "deterministic-issue-id");
  assert.ok(seenDuplicateWhere.length > 0);
  assert.deepEqual([...seenDuplicateWhere[0].id.notIn], ["reconciled-issue-id"]);
  assert.equal(createdIssueData.id, "deterministic-issue-id");
});

test("normalizeManualVariableValues drops empty values and keeps arrays", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificate-issuance.ts");
  const { mocks } = buildBaseMocks();
  const service = loadServiceModule(sourcePath, mocks);

  const normalized = service.normalizeManualVariableValues({
    certificateName: "  Title ",
    empty: "   ",
    nil: null,
    capabilityTags: [" a ", "", "b"],
    none: [],
  });

  assert.equal(normalized.certificateName, "Title");
  assert.equal(normalized.empty, undefined);
  assert.equal(normalized.nil, undefined);
  assert.deepEqual(normalized.capabilityTags, ["a", "b"]);
  assert.equal(normalized.none, undefined);
});
