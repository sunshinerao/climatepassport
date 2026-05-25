import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadCertificateVerificationModule({ prismaClient, writeCoreAuditLog }) {
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