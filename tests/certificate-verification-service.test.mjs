import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const fingerprintFor = (code) => `fp:${createHash("sha256").update(code, "utf8").digest("hex").slice(0, 16)}`;

function loadCertificateSnapshotModule() {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificate-snapshot.ts");
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, require, Date, Number, Array, Object };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

function loadCertificateVerificationModule({ prismaClient, writeCoreAuditLog, canManageActivity = async () => false }) {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificate-verification.ts");
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
        return {
          maskPassportId: (value) => value ? `${value.slice(0, 2)}••••${value.slice(-3)}` : null,
        };
      }

      if (moduleName === "@/lib/server/audit") {
        return { writeCoreAuditLog };
      }

      if (moduleName === "@/lib/server/certificate-snapshot") {
        return loadCertificateSnapshotModule();
      }

      if (moduleName === "@/lib/server/verifier-activity") {
        return { canManageActivity };
      }

      if (moduleName === "@/lib/server/prisma") {
        return { getPrismaClient: () => prismaClient };
      }

      return require(moduleName);
    },
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

function buildIssue(overrides = {}) {
  return {
    id: "issue-1",
    userId: "user-1",
    sourceType: "LEARNING_EXPERIENCE",
    sourceId: "source-1",
    status: "ISSUED",
    publicVisible: true,
    generatedFileName: "certificate.pdf",
    verificationCode: "CV-TEST-001",
    issuedAt: new Date("2026-05-20T00:00:00.000Z"),
    variableValuesJson: {
      issuerName: "SHCW Academy",
      programNameEn: "Ocean Fellowship",
      capabilityTags: ["Climate Strategy", "Stewardship"],
    },
    renderSnapshotJson: null,
    user: {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      climatePassportId: "K7M9QF2-T8N4PZ",
    },
    definition: {
      name: "Program Completion",
      nameEn: "Program Completion",
      verificationMode: "PUBLIC_CODE",
      category: {
        name: "Learning Experience",
        nameEn: "Learning Experience",
        publicVerifyEnabled: true,
      },
    },
    verifications: [{ id: "v-1" }],
    ...overrides,
  };
}

test("issued render snapshot remains the public identity after mutable profile and definition changes", async () => {
  const prismaClient = {
    certificateIssue: {
      findUnique: async () => buildIssue({
        user: { id: "user-1", name: "Changed User", email: "changed@example.com", climatePassportId: "K7M9QF2-T8N4PZ" },
        definition: {
          name: "Changed Definition",
          nameEn: "Changed Definition",
          verificationMode: "PUBLIC_CODE",
          category: { name: "Changed Category", nameEn: "Changed Category", publicVerifyEnabled: true },
        },
        renderSnapshotJson: {
          schemaVersion: 1,
          templateId: "template-1",
          templateVersion: 3,
          renderConfigJson: {},
          holderName: "Issued Holder",
          certificateName: "Issued Credential",
          categoryName: "Issued Category",
          issueDate: "2026-05-20T00:00:00.000Z",
          variableValues: {
            certificateNameEn: "Issued Credential EN",
            categoryNameEn: "Issued Category EN",
            issuerName: "Issued Organization",
            capabilityTags: ["Issued Capability"],
          },
        },
      }),
    },
    coreAuditLog: { count: async () => 0 },
    certificateVerification: { create: async () => ({ id: "verification-1" }) },
  };
  const { resolvePublicCertificateVerification } = loadCertificateVerificationModule({ prismaClient, writeCoreAuditLog: async () => {} });
  const result = await resolvePublicCertificateVerification({ code: "CV-TEST-001", channel: "PUBLIC_PAGE", querySource: "QR_SCAN" });

  assert.equal(result.certificate?.holderName, "Issued Holder");
  assert.equal(result.certificate?.title, "Issued Credential");
  assert.equal(result.certificate?.titleEn, "Issued Credential EN");
  assert.equal(result.certificate?.credentialType, "Issued Category");
  assert.equal(result.certificate?.credentialTypeEn, "Issued Category EN");
  assert.equal(result.certificate?.issuingOrganization, "Issued Organization");
  assert.deepEqual(result.certificate?.competencies, ["Issued Capability"]);
});

test("resolvePublicCertificateVerification returns derived issuer, related source, and competencies", async () => {
  const auditLogs = [];
  const verificationWrites = [];
  const prismaClient = {
    certificateIssue: {
      findUnique: async () => buildIssue(),
    },
    coreAuditLog: {
      count: async () => 0,
    },
    certificateVerification: {
      create: async ({ data }) => {
        verificationWrites.push(data);
        return { id: "verification-1" };
      },
    },
  };
  const { resolvePublicCertificateVerification } = loadCertificateVerificationModule({
    prismaClient,
    writeCoreAuditLog: async (payload) => {
      auditLogs.push(payload);
    },
  });

  const result = await resolvePublicCertificateVerification({
    code: "cv-test-001",
    channel: "PUBLIC_PAGE",
    querySource: "WEB_QUERY",
  });

  assert.equal(result.result, "VALID");
  assert.equal(result.certificate?.issuingOrganization, "SHCW Academy");
  assert.equal(result.certificate?.relatedSource, "Ocean Fellowship");
  assert.deepEqual(result.certificate?.competencies, ["Climate Strategy", "Stewardship"]);
  assert.equal(verificationWrites[0].result, "VALID");
  assert.equal(auditLogs.at(-1)?.result, "valid");
});

test("resolvePublicCertificateVerification returns EXPIRED when variable values include a past expiry date", async () => {
  const prismaClient = {
    certificateIssue: {
      findUnique: async () => buildIssue({
        variableValuesJson: {
          issuerName: "Climate Passport",
          expiryDate: "2024-01-31",
        },
      }),
    },
    coreAuditLog: {
      count: async () => 0,
    },
    certificateVerification: {
      create: async () => ({ id: "verification-1" }),
    },
  };
  const { resolvePublicCertificateVerification } = loadCertificateVerificationModule({
    prismaClient,
    writeCoreAuditLog: async () => {},
  });

  const result = await resolvePublicCertificateVerification({
    code: "CV-TEST-001",
    channel: "PUBLIC_API",
    querySource: "WEB_QUERY",
  });

  assert.equal(result.result, "EXPIRED");
  assert.equal(result.valid, false);
  assert.equal(typeof result.certificate?.expiryDate, "string");
});

test("resolvePublicCertificateVerification hides certificate details from blocked public access", async () => {
  const verificationWrites = [];
  const auditLogs = [];
  const prismaClient = {
    certificateIssue: {
      findUnique: async () => buildIssue({
        definition: {
          name: "Internal Credential",
          nameEn: "Internal Credential",
          verificationMode: "INTERNAL_ONLY",
          category: {
            name: "Operations",
            nameEn: "Operations",
            publicVerifyEnabled: true,
          },
        },
      }),
    },
    coreAuditLog: {
      count: async () => 0,
    },
    certificateVerification: {
      create: async ({ data }) => {
        verificationWrites.push(data);
        return { id: "verification-1" };
      },
    },
  };
  const { resolvePublicCertificateVerification } = loadCertificateVerificationModule({
    prismaClient,
    writeCoreAuditLog: async (payload) => {
      auditLogs.push(payload);
    },
  });

  const result = await resolvePublicCertificateVerification({
    code: "CV-TEST-001",
    channel: "PUBLIC_API",
    querySource: "WEB_QUERY",
  });

  assert.equal(result.result, "INVALID");
  assert.equal(result.accessLevel, "PUBLIC");
  assert.equal(result.certificate, undefined);
  assert.equal(result.message, "This credential is not available for public verification.");
  assert.equal(verificationWrites[0].result, "INVALID");
  assert.equal(auditLogs.at(-1)?.result, "invalid");
});

function buildAccessPrisma(issueOverrides = {}, { batchItem = null, issuance = null } = {}) {
  const issue = buildIssue(issueOverrides);
  return {
    issue,
    prismaClient: {
      certificateIssue: { findUnique: async () => issue },
      coreAuditLog: { count: async () => 0 },
      certificateVerification: { create: async () => ({ id: "verification-1" }) },
      activityCertificateIssuance: { findUnique: async () => issuance },
      certificateBatchItem: { findUnique: async () => batchItem },
    },
  };
}

test("role names alone do not grant extended verification fields (CP-AUD-001)", async () => {
  for (const role of ["ADMIN", "VERIFIER", "STAFF", "SPECIAL_PASS_MANAGER", "EVENT_MANAGER"]) {
    const { prismaClient } = buildAccessPrisma();
    const { resolvePublicCertificateVerification } = loadCertificateVerificationModule({
      prismaClient,
      writeCoreAuditLog: async () => {},
      canManageActivity: async () => false,
    });

    const result = await resolvePublicCertificateVerification({
      code: "CV-TEST-001",
      channel: "PUBLIC_API",
      querySource: "WEB_QUERY",
      requester: { userId: `user-${role.toLowerCase()}`, role },
    });

    assert.equal(result.accessLevel, "PUBLIC", `${role} must not receive extended fields without a resource grant`);
    assert.equal(result.certificate?.extended, undefined);
    assert.equal(result.certificate?.viewer.canViewExtendedFields, false);
  }
});

test("event manager managing the certificate source activity sees extended fields", async () => {
  const { prismaClient } = buildAccessPrisma(
    { sourceType: "CERTIFICATE_BATCH", sourceId: "certificate-batch-item:item-1" },
    { batchItem: { batch: { activityId: "act-1" } } },
  );
  const { resolvePublicCertificateVerification } = loadCertificateVerificationModule({
    prismaClient,
    writeCoreAuditLog: async () => {},
    canManageActivity: async (_prisma, actor, activityId) => actor.id === "em-related" && activityId === "act-1",
  });

  const result = await resolvePublicCertificateVerification({
    code: "CV-TEST-001",
    channel: "PUBLIC_API",
    querySource: "WEB_QUERY",
    requester: { userId: "em-related", role: "EVENT_MANAGER" },
  });

  assert.equal(result.accessLevel, "STAFF");
  assert.equal(result.certificate?.extended?.issueId, "issue-1");
  assert.equal(result.certificate?.extended?.holderEmail, "alice@example.com");
});

test("event manager without source link or without management rights gets public fields only", async () => {
  const unrelated = buildAccessPrisma(
    { sourceType: "CERTIFICATE_BATCH", sourceId: "certificate-batch-item:item-1" },
    { batchItem: { batch: { activityId: "act-1" } } },
  );
  const { resolvePublicCertificateVerification: resolveUnrelated } = loadCertificateVerificationModule({
    prismaClient: unrelated.prismaClient,
    writeCoreAuditLog: async () => {},
    canManageActivity: async () => false,
  });
  const unrelatedResult = await resolveUnrelated({
    code: "CV-TEST-001",
    channel: "PUBLIC_API",
    querySource: "WEB_QUERY",
    requester: { userId: "em-other", role: "EVENT_MANAGER" },
  });
  assert.equal(unrelatedResult.accessLevel, "PUBLIC");
  assert.equal(unrelatedResult.certificate?.extended, undefined);

  const unlinked = buildAccessPrisma();
  const { resolvePublicCertificateVerification: resolveUnlinked } = loadCertificateVerificationModule({
    prismaClient: unlinked.prismaClient,
    writeCoreAuditLog: async () => {},
    canManageActivity: async () => true,
  });
  const unlinkedResult = await resolveUnlinked({
    code: "CV-TEST-001",
    channel: "PUBLIC_API",
    querySource: "WEB_QUERY",
    requester: { userId: "em-related", role: "EVENT_MANAGER" },
  });
  assert.equal(unlinkedResult.accessLevel, "PUBLIC", "activity certificate without a resolvable source never grants staff access");
  assert.equal(unlinkedResult.certificate?.extended, undefined);
});

test("holder still sees extended fields", async () => {
  const { prismaClient } = buildAccessPrisma();
  const { resolvePublicCertificateVerification } = loadCertificateVerificationModule({
    prismaClient,
    writeCoreAuditLog: async () => {},
  });

  const result = await resolvePublicCertificateVerification({
    code: "CV-TEST-001",
    channel: "PUBLIC_API",
    querySource: "WEB_QUERY",
    requester: { userId: "user-1", role: "ATTENDEE" },
  });

  assert.equal(result.accessLevel, "HOLDER");
  assert.equal(result.certificate?.extended?.holderEmail, "alice@example.com");
});

test("audit logs never persist the raw verification code (CP-AUD-002)", async () => {
  const auditLogs = [];
  const { prismaClient, issue } = buildAccessPrisma();
  prismaClient.certificateIssue.findUnique = async ({ where }) => (where.verificationCode === issue.verificationCode ? issue : null);
  const { resolvePublicCertificateVerification } = loadCertificateVerificationModule({
    prismaClient,
    writeCoreAuditLog: async (payload) => {
      auditLogs.push(payload);
    },
  });

  await resolvePublicCertificateVerification({ code: "CV-TEST-001", channel: "PUBLIC_API", querySource: "QR_SCAN" });
  const foundLog = auditLogs.at(-1);
  assert.equal(foundLog.subjectType, "certificate_issue");
  assert.equal(foundLog.subjectId, "issue-1");
  assert.equal("verificationCode" in (foundLog.metadataJson ?? {}), false, "found-certificate audit must not carry the raw code");

  await resolvePublicCertificateVerification({ code: "CV-MISSING-999", channel: "PUBLIC_API", querySource: "QR_SCAN" });
  const notFoundLog = auditLogs.at(-1);
  assert.equal(notFoundLog.subjectType, "certificate_verification_code");
  assert.equal(notFoundLog.subjectId, fingerprintFor("CV-MISSING-999"), "not-found audit stores a truncated fingerprint, not the raw code");
  assert.equal(notFoundLog.subjectId.includes("CV-MISSING-999"), false);

  await resolvePublicCertificateVerification({ code: "CV-PREVIEW", channel: "PUBLIC_PAGE", querySource: "QR_SCAN" });
  const previewLog = auditLogs.at(-1);
  assert.equal(previewLog.subjectType, "certificate_verification_code");
  assert.notEqual(previewLog.subjectId, "CV-PREVIEW");
  assert.match(previewLog.subjectId, /^fp:[0-9a-f]{16}$/);
});
