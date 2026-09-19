import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

export function createNextResponseMock() {
  function NextResponse(body, init) {
    this.body = body;
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? "";
    this.headers = init?.headers ?? {};
  }
  NextResponse.json = function (payload, init) {
    return { status: init?.status ?? 200, payload };
  };
  NextResponse.redirect = function (url, status) {
    return { status: status ?? 307, payload: { url } };
  };
  return NextResponse;
}

export function createDefaultMocks(overrides = {}) {
  const NextResponse = createNextResponseMock();
  return {
    "next/server": { NextResponse },
    "next/navigation": {
      redirect: (url) => {
        const err = new Error(`redirect:${url}`);
        err.name = "NEXT_REDIRECT";
        throw err;
      },
    },
    "next/headers": {
      cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
    },
    "@/lib/site-content": { locales: ["en", "zh", "fr", "de"] },
    "@/lib/server/audit": { getRequestAuditContext: () => ({}), writeCoreAuditLog: async () => null },
    "@/lib/server/achievement-badge": { createAchievementRecord: async () => ({ id: "achievement-1" }) },
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hash:${token}`,
      createOpaqueToken: () => "opaque-token",
      createCertificateVerificationCode: () => "CV-TEST-001",
      maskPassportId: (id) => (id ? `${id.slice(0, 3)}-****-${id.slice(-4)}` : null),
    },
    "@/lib/server/certificate-verification": {
      resolvePublicCertificateVerification: async () => ({
        httpStatus: 404,
        valid: false,
        result: "NOT_FOUND",
        verificationCode: "CV-000",
        accessLevel: "PUBLIC",
      }),
    },
    "@/lib/server/qr": {
      issueQrToken: async () => ({ token: "qr-token", tokenId: "qr-1", type: "IDENTITY", expiresAt: new Date() }),
      getIdentityQrExpiry: () => new Date(Date.now() + 60_000),
      getEventCheckinQrExpiry: () => new Date(Date.now() + 60_000),
      getInvitationSpecialPassQrExpiry: () => new Date(Date.now() + 60_000),
    },
    "@/lib/server/identity-qr-verification": {
      resolveIdentityQrVerification: async () => ({
        ok: false,
        status: "MISSING_TOKEN",
        httpStatus: 400,
        error: "Missing token.",
      }),
    },
    "@/lib/server/verifier-activity": {
      canManageActivity: async () => false,
      canVerifyActivity: async () => false,
      isEmptyCertificateCondition: () => true,
      loadVerifiableActivities: async () => [],
    },
    "@/lib/server/verifier-invitation-special-pass": {
      scanInvitationSpecialPassQr: async () => ({ result: "invalid" }),
    },
    "@/lib/server/activity-rewards": {
      triggerActivityRewards: async () => {},
      syncParticipationToPassport: async () => {},
    },
    "@/lib/server/activity-checkin-certificate-issuance": {
      finalizeActivityCheckinCertificateIssuance: async () => ({ status: "issued" }),
    },
    "@/lib/server/certificate-artifact-storage": {
      decodeLegacyCertificateArtifact: () => null,
      getCertificateArtifact: async () => Buffer.from("<html></html>"),
      storeBuiltCertificateArtifact: async () => ({
        generatedFileName: "cert.html",
        artifactProvider: "local",
        artifactKey: "certificates/test/" + "a".repeat(64) + ".html",
        artifactVersion: "a".repeat(64),
        artifactContentType: "text/html",
        artifactByteSize: 10,
        artifactSha256: "a".repeat(64),
        artifactCreatedAt: new Date(),
        artifactVerifiedAt: new Date(),
        artifactState: "READY",
        artifactFailureReason: null,
      }),
    },
    "@/lib/server/certificate-issuance": {
      normalizeManualVariableValues: (values) => values ?? {},
      issueCertificateToRecipient: async (_prisma, input) => ({
        ok: true,
        email: input.email,
        issueId: "issue-test-1",
        verificationCode: "CV-TEST-001",
        verificationUrl: `${input.verificationUrlBase}/verify/certificate/CV-TEST-001`,
        fileName: "cert.pdf",
        reissued: false,
        recipient: { id: "u-1", name: "A", normalizedEmail: input.email, created: false, climatePassportId: null },
        certificateName: "Cert",
        categoryName: "Cat",
      }),
    },
    "@/lib/server/certificate-snapshot": {
      createCertificateRenderSnapshot: (value) => ({ schemaVersion: 1, ...value }),
      parseCertificateRenderSnapshot: () => null,
      snapshotText: () => null,
    },
    "@/lib/server/certificate-module": {
      parseCertificateRenderConfig: () => ({}),
      buildCertificateArtifactWithQr: async () => ({
        fileName: "cert.html",
        pdfFileName: "cert.pdf",
        mimeType: "text/html",
        html: "<html></html>",
        dataUrl: "data:text/html;charset=utf-8,%3Chtml%3E%3C%2Fhtml%3E",
      }),
      buildCertificatePdfArtifactWithQr: async () => ({
        fileName: "cert.pdf",
        pdfFileName: "cert.pdf",
        mimeType: "application/pdf",
        html: "<html></html>",
        bytes: Buffer.from("%PDF-test"),
      }),
      buildCertificateArtifact: async () => ({
        fileName: "cert.html",
        pdfFileName: "cert.pdf",
        mimeType: "text/html",
        html: "<html></html>",
        dataUrl: "data:text/html;charset=utf-8,%3Chtml%3E%3C%2Fhtml%3E",
      }),
      getCertificateIssueForPublicVerification: async () => null,
      serializeCertificateCard: () => ({}),
      serializePublicHolder: () => ({}),
    },
    "@/lib/server/certificate-variables": {
      buildIssuedCertificateVariableValues: () => ({}),
      extractCapabilityTags: () => [],
      extractLearningHoursFromProgramConfig: () => null,
    },
    "@/lib/server/certificates": {
      allocateCertificateVerificationCode: async () => "CV-TEST-001",
      canDownloadCertificateStatus: (status) => status === "ISSUED",
      canMakeCertificatePublicStatus: (status) => status === "ISSUED",
      canRegenerateCertificateStatus: (status) => status !== "REVOKED",
      canRestoreCertificateStatus: (status) => status === "REVOKED",
      canRevokeCertificateStatus: (status) => status !== "REVOKED",
      getCertificateStatusAfterRegeneration: () => "ISSUED",
      serializePublicCertificateVerification: () => ({}),
    },
    "@/lib/server/passport-user-provisioning": {
      ensurePassportUserByEmail: async () => ({
        id: "u-1",
        email: "a@b.com",
        name: "A",
        role: "ATTENDEE",
        status: "ACTIVE",
        climatePassportId: null,
        created: false,
        normalizedEmail: "a@b.com",
      }),
    },
    ...overrides,
  };
}

export function loadRouteModule(sourcePath, moduleMocks = {}, globals = {}) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const mocks = createDefaultMocks(moduleMocks);

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: (id) => {
      if (Object.prototype.hasOwnProperty.call(mocks, id)) {
        return mocks[id];
      }
      return require(id);
    },
    URL,
    Request,
    Response,
    Headers,
    Date,
    console,
    Buffer,
    crypto,
    setTimeout,
    clearTimeout,
    process,
    TextEncoder,
    TextDecoder,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    ...globals,
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}
