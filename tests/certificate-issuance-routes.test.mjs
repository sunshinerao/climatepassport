import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const storageMock = {
  storeBuiltCertificateArtifact: async (_id, artifact) => ({ generatedFileName: artifact.fileName, artifactProvider: "local", artifactKey: "certificates/test/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.html", artifactVersion: "a".repeat(64), artifactContentType: "text/html", artifactByteSize: 15, artifactSha256: "a".repeat(64), artifactCreatedAt: new Date(), artifactVerifiedAt: new Date(), artifactState: "READY", artifactFailureReason: null }),
};

function createNextResponseMock() {
  function NextResponse(payload, init) {
    this.status = init?.status ?? 200;
    this.payload = payload;
    this.headers = init?.headers ?? {};
  }
  // Routes branch on `x instanceof NextResponse`, so json() must return an instance.
  NextResponse.json = (payload, init) => new NextResponse(payload, init);
  return NextResponse;
}

function loadRouteModule(sourcePath, moduleMocks) {
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

test("issue route returns 409 when duplicate issuance exists", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/admin/certificates/issue/route.ts");

  const prisma = {
    certificateDefinition: {
      findFirst: async () => ({
        id: "def-1",
        name: "Climate Course",
        nameEn: "Climate Course",
        category: { name: "Course", nameEn: "Course" },
        template: { renderConfigJson: {}, version: 1 },
      }),
    },
  };

  const route = loadRouteModule(sourcePath, {
    "next/server": { NextResponse: createNextResponseMock() },
    "@/lib/server/auth": {
      getCurrentUser: async () => ({ id: "admin-1", name: "Admin", role: "ADMIN" }),
      normalizeUserEmail: (value) => value.trim().toLowerCase(),
    },
    "@/lib/server/prisma": {
      getPrismaClient: () => prisma,
    },
    "@/lib/server/audit": {
      getRequestAuditContext: () => ({ ipAddress: "127.0.0.1", userAgent: "test-agent" }),
    },
    "@/lib/server/certificate-issuance": {
      issueCertificateToRecipient: async () => ({
        ok: false,
        email: "alice@example.com",
        status: 409,
        error: "Duplicate issuance is not allowed for this user and certificate definition.",
        issueId: "issue-existing",
        verificationCode: "CV-EXISTING",
      }),
      normalizeManualVariableValues: (values) => values ?? {},
    },
  });

  const request = new Request("https://passport.example/api/admin/certificates/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "alice@example.com",
      templateId: "123e4567-e89b-12d3-a456-426614174000",
    }),
  });

  const response = await route.POST(request);

  assert.equal(response.status, 409);
  assert.equal(
    response.payload.error,
    "Duplicate issuance is not allowed for this user and certificate definition.",
  );
  assert.equal(response.payload.issueId, "issue-existing");
  assert.equal(response.payload.verificationCode, "CV-EXISTING");
});

test("issue route proxies a successful single issuance", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/admin/certificates/issue/route.ts");

  const prisma = {
    certificateDefinition: {
      findFirst: async () => ({
        id: "def-1",
        name: "Climate Course",
        nameEn: "Climate Course",
        category: { name: "Course", nameEn: "Course" },
        template: { renderConfigJson: {}, version: 1 },
      }),
    },
  };

  let serviceInput = null;

  const route = loadRouteModule(sourcePath, {
    "next/server": { NextResponse: createNextResponseMock() },
    "@/lib/server/auth": {
      getCurrentUser: async () => ({ id: "admin-1", name: "Admin", role: "ADMIN" }),
      normalizeUserEmail: (value) => value.trim().toLowerCase(),
    },
    "@/lib/server/prisma": {
      getPrismaClient: () => prisma,
    },
    "@/lib/server/audit": {
      getRequestAuditContext: () => ({ ipAddress: "127.0.0.1", userAgent: "test-agent" }),
    },
    "@/lib/server/certificate-issuance": {
      issueCertificateToRecipient: async (_prisma, input) => {
        serviceInput = input;
        return {
          ok: true,
          email: input.email,
          issueId: "issue-1",
          verificationCode: "CV-MANUAL-1",
          verificationUrl: `${input.verificationUrlBase}/verify/certificate/CV-MANUAL-1`,
          fileName: "Course-Climate Course-Alice-CV-MANUAL-1.pdf",
          reissued: false,
          recipient: { id: "user-1", name: "Alice", normalizedEmail: input.email, created: false, climatePassportId: "PASS-1" },
          certificateName: input.manualVariableValues.certificateName ?? "Climate Course",
          categoryName: "Course",
        };
      },
      normalizeManualVariableValues: (values) => values ?? {},
    },
  });

  const request = new Request("https://passport.example/api/admin/certificates/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "alice@example.com",
      templateId: "123e4567-e89b-12d3-a456-426614174000",
      issueDate: "2026-05-24",
      variableValues: {
        certificateName: "Manual Title",
        roleName: "Speaker",
      },
    }),
  });

  const response = await route.POST(request);

  assert.equal(response.status, 200);
  assert.equal(response.payload.verificationCode, "CV-MANUAL-1");
  assert.ok(serviceInput);
  assert.equal(serviceInput.manualVariableValues.certificateName, "Manual Title");
  assert.equal(serviceInput.verificationUrlBase, "https://passport.example");
});

test("issue route supports batch issuance and returns summary", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/admin/certificates/issue/route.ts");

  const prisma = {
    certificateDefinition: {
      findFirst: async () => ({
        id: "def-1",
        name: "Climate Course",
        nameEn: "Climate Course",
        category: { name: "Course", nameEn: "Course" },
        template: { renderConfigJson: {}, version: 1 },
      }),
    },
  };

  const route = loadRouteModule(sourcePath, {
    "next/server": { NextResponse: createNextResponseMock() },
    "@/lib/server/auth": {
      getCurrentUser: async () => ({ id: "admin-1", name: "Admin", role: "ADMIN" }),
      normalizeUserEmail: (value) => value.trim().toLowerCase(),
    },
    "@/lib/server/prisma": {
      getPrismaClient: () => prisma,
    },
    "@/lib/server/audit": {
      getRequestAuditContext: () => ({ ipAddress: "127.0.0.1", userAgent: "test-agent" }),
    },
    "@/lib/server/certificate-issuance": {
      issueCertificateToRecipient: async (_prisma, input) => {
        if (input.email === "missing@example.com") {
          return {
            ok: false,
            email: input.email,
            status: 500,
            error: "Certificate artifact generation failed: render boom",
          };
        }
        return {
          ok: true,
          email: input.email,
          issueId: `issue-${input.email}`,
          verificationCode: "CV-BATCH-1",
          verificationUrl: `${input.verificationUrlBase}/verify/certificate/CV-BATCH-1`,
          fileName: "Course-Climate Course-Alice-CV-BATCH-1.pdf",
          reissued: false,
          recipient: { id: "user-1", name: "Alice", normalizedEmail: input.email, created: false, climatePassportId: "PASS-1" },
          certificateName: "Climate Course",
          categoryName: "Course",
        };
      },
      normalizeManualVariableValues: (values) => values ?? {},
    },
  });

  const request = new Request("https://passport.example/api/admin/certificates/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      templateId: "123e4567-e89b-12d3-a456-426614174000",
      emails: ["alice@example.com", "missing@example.com"],
      variableValues: {
        roleName: "Volunteer",
      },
    }),
  });

  const response = await route.POST(request);

  assert.equal(response.status, 200);
  assert.equal(response.payload.summary.total, 2);
  assert.equal(response.payload.summary.succeeded, 1);
  assert.equal(response.payload.summary.failed, 1);
  assert.equal(response.payload.results[0].email, "alice@example.com");
  assert.equal(response.payload.results[0].issueId, "issue-alice@example.com");
  assert.equal(response.payload.results[1].email, "missing@example.com");
  assert.equal(response.payload.results[1].error, "Certificate artifact generation failed: render boom");
});

test("learning application completion creates issued certificate with rendered file", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/admin/learning-experiences/applications/[id]/status/route.ts");

  let createdIssueData = null;

  const tx = {
    learningExperienceApplication: {
      update: async () => ({
        id: "app-1",
        user: { id: "user-1", name: "Alice", email: "alice@example.com" },
        program: {
          id: "program-1",
          slug: "climate-lab",
          title: "Climate Lab",
          titleEn: "Climate Lab",
          stages: [],
        },
        currentStage: null,
        participation: {
          id: "part-1",
          status: "COMPLETED",
          completionPercent: 100,
          pointsAwarded: 0,
        },
      }),
    },
    learningExperienceParticipation: {
      upsert: async () => ({
        id: "part-1",
        certificateIssueId: null,
        pointsAwarded: 0,
      }),
      update: async () => null,
    },
    certificateIssue: {
      findFirst: async () => null,
      findUnique: async () => null,
      create: async ({ data }) => {
        createdIssueData = data;
        return { id: "issue-1" };
      },
    },
    certificateDefinition: {
      findUnique: async () => ({
        id: "def-1",
        name: "Climate Completion",
        nameEn: "Climate Completion",
        isActive: true,
        category: { name: "Program", nameEn: "Program", isActive: true },
        template: { renderConfigJson: {}, isActive: true, version: 1 },
      }),
    },
    passportMilestone: {
      create: async () => null,
    },
    user: {
      update: async () => null,
    },
    pointTransaction: {
      create: async () => null,
    },
  };

  const prisma = {
    learningExperienceApplication: {
      findUnique: async () => ({
        id: "app-1",
        status: "ENROLLED",
        submittedAt: null,
        participation: null,
        userId: "user-1",
        programId: "program-1",
        program: {
          id: "program-1",
          managerUserId: "manager-1",
          certificateDefinitionId: "def-1",
          pointReward: 0,
          title: "Climate Lab",
          titleEn: "Climate Lab",
          programConfigJson: {},
          stages: [],
        },
      }),
    },
    $transaction: async (callback) => callback(tx),
  };

  const route = loadRouteModule(sourcePath, {
    "next/server": { NextResponse: createNextResponseMock() },
    "@/lib/server/admin-learning-experiences": {
      learningApplicationStatusOptions: [
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "INTERVIEW",
        "OFFERED",
        "WAITLISTED",
        "ACCEPTED",
        "ENROLLED",
        "COMPLETED",
        "REJECTED",
        "WITHDRAWN",
      ],
    },
    "@/lib/server/api-auth": {
      requireApiRole: async () => ({ id: "manager-1", name: "Manager", role: "EVENT_MANAGER" }),
    },
    "@/lib/server/prisma": {
      getPrismaClient: () => prisma,
    },
    "@/lib/server/certificates": {
      allocateCertificateVerificationCode: async () => "CV-LE-0001",
    },
    "@/lib/server/certificate-module": {
      parseCertificateRenderConfig: () => ({ issuerName: "Issuer" }),
      buildCertificateArtifactWithQr: async () => ({
        fileName: "Program-Climate Completion-Alice-CV-LE-0001.html",
        dataUrl: "data:text/html;charset=utf-8,%3Chtml%3Eok%3C/html%3E",
        pdfFileName: "Program-Climate Completion-Alice-CV-LE-0001.pdf",
        mimeType: "text/html",
      }),
    },
    "@/lib/server/certificate-artifact-storage": storageMock,
    "@/lib/server/certificate-variables": {
      buildIssuedCertificateVariableValues: () => ({}),
      extractCapabilityTags: () => [],
      extractLearningHoursFromProgramConfig: () => null,
    },
    "@/lib/server/point-ledger": {
      grantUserPoints: async () => ({ ok: true, awarded: false, reason: "non_positive_points" }),
    },
  });

  const request = new Request("https://passport.example/api/admin/learning-experiences/applications/app-1/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "COMPLETED" }),
  });

  const response = await route.PATCH(request, { params: { id: "app-1" } });

  assert.equal(response.status, 200);
  assert.ok(createdIssueData);
  assert.equal(createdIssueData.status, "ISSUED");
  assert.equal(createdIssueData.generatedFileName, "Program-Climate Completion-Alice-CV-LE-0001.html");
  assert.equal(createdIssueData.artifactState, "READY");
  assert.equal(createdIssueData.generatedFileUrl, undefined);
});
