import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function createNextResponseMock() {
  return {
    json(payload, init) {
      return {
        status: init?.status ?? 200,
        payload,
      };
    },
  };
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
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

test("issue route returns 409 when duplicate issuance exists", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/admin/certificates/issue/route.ts");

  const prisma = {
    $transaction: async (callback) => callback(prisma),
    user: {
      findUnique: async () => ({ id: "user-1", name: "Alice" }),
    },
    certificateDefinition: {
      findFirst: async () => ({
        id: "def-1",
        name: "Climate Course",
        nameEn: "Climate Course",
        category: { name: "Course", nameEn: "Course" },
        template: { renderConfigJson: {} },
      }),
    },
    certificateIssue: {
      findFirst: async () => ({ id: "issue-existing", verificationCode: "CV-EXISTING" }),
      findUnique: async () => null,
      create: async () => {
        throw new Error("create should not be called for duplicate issuance");
      },
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
    "@/lib/server/passport-user-provisioning": {
      ensurePassportUserByEmail: async () => ({
        id: "user-1",
        email: "alice@example.com",
        name: "Alice",
        role: "ATTENDEE",
        status: "ACTIVE",
        climatePassportId: "PASS-1",
        created: false,
        normalizedEmail: "alice@example.com",
      }),
    },
    "@/lib/server/certificates": {
      allocateCertificateVerificationCode: async () => {
        throw new Error("allocate should not be called for duplicate issuance");
      },
    },
    "@/lib/server/certificate-module": {
      parseCertificateRenderConfig: () => ({}),
      buildCertificateArtifactWithQr: async () => {
        throw new Error("artifact build should not be called for duplicate issuance");
      },
    },
    "@/lib/server/certificate-variables": {
      buildIssuedCertificateVariableValues: () => ({}),
    },
    "@/lib/server/achievement-badge": {
      createAchievementRecord: async () => ({ id: "achievement-1" }),
    },
    "@/lib/server/audit": {
      getRequestAuditContext: () => ({}),
      writeCoreAuditLog: async () => {
        throw new Error("audit log should not be called for duplicate issuance");
      },
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

test("issue route merges manual variable values into artifact rendering", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/admin/certificates/issue/route.ts");

  let artifactInput = null;
  let createdIssueData = null;

  const prisma = {
    $transaction: async (callback) => callback(prisma),
    user: {
      findUnique: async () => ({ id: "user-1", name: "Alice" }),
    },
    certificateDefinition: {
      findFirst: async () => ({
        id: "def-1",
        name: "Climate Course",
        nameEn: "Climate Course",
        category: { name: "Course", nameEn: "Course" },
        template: { renderConfigJson: {} },
      }),
    },
    certificateIssue: {
      findFirst: async () => null,
      findUnique: async () => null,
      create: async ({ data }) => {
        createdIssueData = data;
        return { id: "issue-1", verificationCode: data.verificationCode, generatedFileName: data.generatedFileName };
      },
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
    "@/lib/server/passport-user-provisioning": {
      ensurePassportUserByEmail: async () => ({
        id: "user-1",
        email: "alice@example.com",
        name: "Alice",
        role: "ATTENDEE",
        status: "ACTIVE",
        climatePassportId: "PASS-1",
        created: false,
        normalizedEmail: "alice@example.com",
      }),
    },
    "@/lib/server/certificates": {
      allocateCertificateVerificationCode: async () => "CV-MANUAL-1",
    },
    "@/lib/server/certificate-module": {
      parseCertificateRenderConfig: () => ({ issuerName: "Climate Passport" }),
      buildCertificateArtifactWithQr: async (input) => {
        artifactInput = input;
        return {
          fileName: "Course-Manual Title-Alice-CV-MANUAL-1.html",
          dataUrl: "data:text/html;charset=utf-8,%3Chtml%3Emanual%3C/html%3E",
          pdfFileName: "Course-Manual Title-Alice-CV-MANUAL-1.pdf",
          mimeType: "text/html",
        };
      },
    },
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
      getRequestAuditContext: () => ({}),
      writeCoreAuditLog: async () => null,
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
  assert.ok(artifactInput);
  assert.equal(artifactInput.certificateName, "Manual Title");
  assert.equal(artifactInput.variableValues.roleName, "Speaker");
  assert.equal(createdIssueData.status, "ISSUED");
});

test("issue route supports batch issuance and returns summary", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/admin/certificates/issue/route.ts");

  const createdIssues = [];

  const prisma = {
    $transaction: async (callback) => callback(prisma),
    user: {
      findUnique: async ({ where }) => {
        if (where.email === "alice@example.com") {
          return { id: "user-1", name: "Alice" };
        }
        return null;
      },
    },
    certificateDefinition: {
      findFirst: async () => ({
        id: "def-1",
        name: "Climate Course",
        nameEn: "Climate Course",
        category: { name: "Course", nameEn: "Course" },
        template: { renderConfigJson: {} },
      }),
    },
    certificateIssue: {
      findFirst: async () => null,
      findUnique: async () => null,
      create: async ({ data }) => {
        createdIssues.push(data);
        return {
          id: `issue-${createdIssues.length}`,
          verificationCode: data.verificationCode,
          generatedFileName: data.generatedFileName,
        };
      },
    },
  };

  let sequence = 0;

  const route = loadRouteModule(sourcePath, {
    "next/server": { NextResponse: createNextResponseMock() },
    "@/lib/server/auth": {
      getCurrentUser: async () => ({ id: "admin-1", name: "Admin", role: "ADMIN" }),
      normalizeUserEmail: (value) => value.trim().toLowerCase(),
    },
    "@/lib/server/prisma": {
      getPrismaClient: () => prisma,
    },
    "@/lib/server/passport-user-provisioning": {
      ensurePassportUserByEmail: async (tx, { email }) => {
        if (email === "alice@example.com") {
          return {
            id: "user-1",
            email,
            name: "Alice",
            role: "ATTENDEE",
            status: "ACTIVE",
            climatePassportId: "PASS-1",
            created: false,
            normalizedEmail: email,
          };
        }

        return {
          id: "user-2",
          email,
          name: "missing",
          role: "ATTENDEE",
          status: "PENDING",
          climatePassportId: "PASS-2",
          created: true,
          normalizedEmail: email,
        };
      },
    },
    "@/lib/server/certificates": {
      allocateCertificateVerificationCode: async () => `CV-BATCH-${++sequence}`,
    },
    "@/lib/server/certificate-module": {
      parseCertificateRenderConfig: () => ({ issuerName: "Climate Passport" }),
      buildCertificateArtifactWithQr: async ({ certificateNumber }) => ({
        fileName: `Course-Climate Course-Alice-${certificateNumber}.html`,
        dataUrl: "data:text/html;charset=utf-8,%3Chtml%3Ebatch%3C/html%3E",
        pdfFileName: `Course-Climate Course-Alice-${certificateNumber}.pdf`,
        mimeType: "text/html",
      }),
    },
    "@/lib/server/certificate-variables": {
      buildIssuedCertificateVariableValues: () => ({
        holderName: "Alice",
        certificateName: "Climate Course",
        categoryName: "Course",
      }),
    },
    "@/lib/server/achievement-badge": {
      createAchievementRecord: async () => ({ id: "achievement-1" }),
    },
    "@/lib/server/audit": {
      getRequestAuditContext: () => ({}),
      writeCoreAuditLog: async () => null,
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
  assert.equal(response.payload.summary.succeeded, 2);
  assert.equal(response.payload.summary.failed, 0);
  assert.equal(createdIssues.length, 2);
  assert.equal(response.payload.results[1].email, "missing@example.com");
  assert.equal(response.payload.results[1].error, undefined);
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
        category: { name: "Program", nameEn: "Program" },
        template: { renderConfigJson: {} },
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
    "@/lib/server/auth": {
      requireRoleAccess: async () => ({ id: "manager-1", name: "Manager", role: "EVENT_MANAGER" }),
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
  assert.equal(
    createdIssueData.generatedFileUrl,
    "data:text/html;charset=utf-8,%3Chtml%3Eok%3C/html%3E",
  );
});
