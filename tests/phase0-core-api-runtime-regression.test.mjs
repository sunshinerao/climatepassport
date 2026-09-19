import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadRouteModule } from "./_route-loader.mjs";

const tokenHash = (token) => `hash:${token}`;

const apiRoot = path.resolve("apps/passport-web/app/api");

const allowRateLimit = { allowed: true, unavailable: false };
const denyRateLimit = { allowed: false, unavailable: false, retryAfter: 5_000 };
const unavailableRateLimit = { allowed: false, unavailable: true };

function rateLimitMock(result = allowRateLimit) {
  return {
    checkRateLimitAsync: async () => result,
    getRateLimitHeaders: (r) => (r?.retryAfter ? { "Retry-After": String(Math.ceil(r.retryAfter / 1000)) } : {}),
    getRequestRateLimitKey: (_request, prefix) => `${prefix}:key`,
  };
}

function authMock(user = null) {
  return {
    getCurrentUser: async () => user,
    requireAuthenticatedUser: async () => {
      if (!user) {
        const err = new Error("redirect:/login");
        err.name = "NEXT_REDIRECT";
        throw err;
      }
      return user;
    },
    normalizeUserEmail: (value) => value.trim().toLowerCase(),
    getDashboardPathForRole: (_locale, role) => (role === "ADMIN" || role === "EVENT_MANAGER" ? "/en/admin/events" : "/en/dashboard/climate-passport"),
  };
}

function prismaMock(client = {}) {
  return { getPrismaClient: () => client };
}

function baseMocks({ authUser = null, prisma = {}, rateLimit = allowRateLimit, extra = {} } = {}) {
  return {
    "@/lib/server/auth": authMock(authUser),
    "@/lib/server/prisma": prismaMock(prisma),
    "@/lib/server/rate-limit": rateLimitMock(rateLimit),
    ...extra,
  };
}

function makeIssue(userId, overrides = {}) {
  return {
    id: "issue-1",
    userId,
    status: "ISSUED",
    generatedFileUrl: null,
    generatedFileName: "cert.html",
    verificationCode: "CV-TEST-001",
    downloadCount: 0,
    artifactProvider: "local",
    artifactKey: "certificates/test/key.html",
    artifactSha256: "a".repeat(64),
    artifactState: "READY",
    ...overrides,
  };
}

function makeCertificateDefinition() {
  return {
    id: "def-1",
    name: "Climate Course",
    nameEn: "Climate Course",
    category: { name: "Course", nameEn: "Course" },
    template: { renderConfigJson: {}, isActive: true, version: 1 },
    isActive: true,
  };
}

function issuePrisma(issue, updates = []) {
  return {
    certificateIssue: {
      findUnique: async () => issue,
      update: async (input) => { updates.push(input); return issue; },
    },
  };
}

test("QR identity route", async (t) => {
  const sourcePath = path.join(apiRoot, "qr/identity/route.ts");

  await t.test("GET missing token returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      extra: {
        "@/lib/server/identity-qr-verification": {
          resolveIdentityQrVerification: async () => ({
            ok: false,
            status: "MISSING_TOKEN",
            httpStatus: 400,
            error: "Missing token.",
          }),
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/qr/identity"));
    assert.equal(response.status, 400);
    assert.equal(response.payload.ok, false);
  });

  await t.test("GET invalid token returns 404", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      extra: {
        "@/lib/server/identity-qr-verification": {
          resolveIdentityQrVerification: async () => ({
            ok: false,
            status: "INVALID",
            httpStatus: 404,
            error: "QR token is invalid or expired.",
          }),
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/qr/identity?token=bad"));
    assert.equal(response.status, 404);
  });

  await t.test("GET valid identity returns verification", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      extra: {
        "@/lib/server/identity-qr-verification": {
          resolveIdentityQrVerification: async () => ({
            ok: true,
            status: "VALID",
            httpStatus: 200,
            verification: {
              type: "IDENTITY",
              expiresAt: new Date().toISOString(),
              issuedAt: new Date().toISOString(),
              user: {
                id: "u1",
                name: "Alice",
                role: "ATTENDEE",
                climatePassportId: "CP-000001",
                status: "ACTIVE",
              },
              metadata: null,
            },
          }),
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/qr/identity?token=tok"));
    assert.equal(response.status, 200);
    assert.equal(response.payload.verification.user.name, "Alice");
  });

  await t.test("POST rate-limit unavailable returns 503", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ rateLimit: unavailableRateLimit }));
    const response = await route.POST(new Request("https://passport.test/api/qr/identity", { method: "POST" }));
    assert.equal(response.status, 503);
  });

  await t.test("POST rate-limit denied returns 429", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ rateLimit: denyRateLimit }));
    const response = await route.POST(new Request("https://passport.test/api/qr/identity", { method: "POST" }));
    assert.equal(response.status, 429);
  });

  await t.test("POST unauthenticated returns 401", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/qr/identity", { method: "POST" }));
    assert.equal(response.status, 401);
  });

  await t.test("POST success issues identity QR", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u1", role: "ATTENDEE", climatePassportId: "CP-000001" },
      extra: {
        "@/lib/server/qr": {
          issueQrToken: async () => ({ token: "identity-token", type: "IDENTITY", expiresAt: new Date() }),
          getIdentityQrExpiry: () => new Date(Date.now() + 60_000),
        },
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/qr/identity", { method: "POST" }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.qr.token, "identity-token");
    assert.equal(response.payload.qr.type, "IDENTITY");
  });
});

test("verifier scan route", async (t) => {
  const sourcePath = path.join(apiRoot, "verifier/scan/route.ts");

  await t.test("unauthenticated returns 401", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/verifier/scan", {
      method: "POST",
      body: JSON.stringify({ token: "identity-token" }),
    }));
    assert.equal(response.status, 401);
  });

  await t.test("non-verifier role returns 403", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "u1", role: "ATTENDEE" } }));
    const response = await route.POST(new Request("https://passport.test/api/verifier/scan", {
      method: "POST",
      body: JSON.stringify({ token: "identity-token" }),
    }));
    assert.equal(response.status, 403);
  });

  await t.test("invalid payload returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "u1", role: "VERIFIER" } }));
    const response = await route.POST(new Request("https://passport.test/api/verifier/scan", {
      method: "POST",
      body: JSON.stringify({ token: "short" }),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("rate-limit unavailable returns 503", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "u1", role: "VERIFIER" }, rateLimit: unavailableRateLimit }));
    const response = await route.POST(new Request("https://passport.test/api/verifier/scan", {
      method: "POST",
      body: JSON.stringify({ token: "identity-token" }),
    }));
    assert.equal(response.status, 503);
  });

  await t.test("rate-limit denied returns 429", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "u1", role: "VERIFIER" }, rateLimit: denyRateLimit }));
    const response = await route.POST(new Request("https://passport.test/api/verifier/scan", {
      method: "POST",
      body: JSON.stringify({ token: "identity-token" }),
    }));
    assert.equal(response.status, 429);
  });

  await t.test("identity QR returns data-minimized identity response", async () => {
    const token = "identity-token";
    const hash = tokenHash(token);
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "v1", role: "VERIFIER" },
      prisma: {
        qrToken: {
          findUnique: async () => ({
            id: "qr-1",
            tokenHash: hash,
            type: "IDENTITY",
            status: "ACTIVE",
            expiresAt: new Date(Date.now() + 60_000),
            userId: "u1",
            user: { id: "u1", name: "Alice", climatePassportId: "CP-000001", status: "ACTIVE" },
          }),
        },
      },

    }));
    const response = await route.POST(new Request("https://passport.test/api/verifier/scan", {
      method: "POST",
      body: JSON.stringify({ token }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.result, "valid");
    assert.equal(response.payload.type, "IDENTITY");
    assert.equal(response.payload.identity.name, "Alice");
    assert.equal(response.payload.identity.climatePassportId, "CP-000001");
  });

  await t.test("unknown QR returns invalid 404", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "v1", role: "VERIFIER" },
      prisma: {
        qrToken: { findUnique: async () => null },
      },

    }));
    const response = await route.POST(new Request("https://passport.test/api/verifier/scan", {
      method: "POST",
      body: JSON.stringify({ token: "unknown-token" }),
    }));
    assert.equal(response.status, 404);
    assert.equal(response.payload.result, "invalid");
  });

  for (const [result, expectedStatus] of [
    ["invalid", 404],
    ["expired", 410],
    ["revoked", 410],
    ["wrong_event", 409],
    ["permission_denied", 403],
    ["not_approved", 409],
    ["already_used", 409],
    ["unsupported_context", 400],
  ]) {
    await t.test(`invitation/special-pass ${result} maps to ${expectedStatus}`, async () => {
      const route = loadRouteModule(sourcePath, baseMocks({
        authUser: { id: "v1", role: "VERIFIER" },
        prisma: {
          qrToken: {
            findUnique: async () => ({
              id: "qr-2",
              tokenHash: tokenHash("pass-token"),
              type: "INVITATION_SPECIAL_PASS",
              status: "ACTIVE",
              userId: "u2",
            }),
          },
        },
        extra: {
          "@/lib/server/verifier-invitation-special-pass": {
            scanInvitationSpecialPassQr: async () => ({ result }),
          },
        },
      }));
      const response = await route.POST(new Request("https://passport.test/api/verifier/scan", {
        method: "POST",
        body: JSON.stringify({ token: "pass-token", eventId: "00000000-0000-4000-9000-000000000000" }),
      }));
      assert.equal(response.status, expectedStatus);
      assert.equal(response.payload.result, result);
    });
  }

  await t.test("invitation/special-pass admitted returns data-minimized response", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "v1", role: "VERIFIER" },
        prisma: {
          qrToken: {
            findUnique: async () => ({
              id: "qr-3",
              tokenHash: tokenHash("pass-token"),
              type: "INVITATION_SPECIAL_PASS",
              status: "ACTIVE",
              userId: "u3",
            }),
          },
        },
        extra: {
          "@/lib/server/verifier-invitation-special-pass": {
            scanInvitationSpecialPassQr: async () => ({
              result: "admitted",
              credentialKind: "invitation",
              event: { title: "Event", titleEn: "Event" },
              holderName: "Guest",
            }),
          },
        },
    }));
    const response = await route.POST(new Request("https://passport.test/api/verifier/scan", {
      method: "POST",
      body: JSON.stringify({ token: "pass-token", eventId: "00000000-0000-4000-9000-000000000000" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.result, "admitted");
    assert.equal(response.payload.credentialKind, "invitation");
    assert.equal(response.payload.holderName, "Guest");
    assert.equal(response.payload.event.title, "Event");
  });
});

test("certificate revoke route", async (t) => {
  const sourcePath = path.join(apiRoot, "admin/certificates/[id]/revoke/route.ts");

  for (const role of ["EVENT_MANAGER", "VERIFIER", "ATTENDEE"]) {
    await t.test(`returns 403 for ${role}`, async () => {
      const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "u1", role } }));
      const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/revoke", {
        method: "POST",
        body: JSON.stringify({ reason: "Reason" }),
      }), { params: { id: "issue-1" } });
      assert.equal(response.status, 403);
    });
  }

  await t.test("invalid reason returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "admin-1", role: "ADMIN" } }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/revoke", {
      method: "POST",
      body: JSON.stringify({ reason: "ab" }),
    }), { params: { id: "issue-1" } });
    assert.equal(response.status, 400);
  });

  await t.test("missing certificate returns 404", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma: { certificateIssue: { findUnique: async () => null } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/revoke", {
      method: "POST",
      body: JSON.stringify({ reason: "Reason" }),
    }), { params: { id: "issue-1" } });
    assert.equal(response.status, 404);
  });

  await t.test("already revoked returns 409", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma: { certificateIssue: { findUnique: async () => ({ id: "issue-1", status: "REVOKED" }) } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/revoke", {
      method: "POST",
      body: JSON.stringify({ reason: "Reason" }),
    }), { params: { id: "issue-1" } });
    assert.equal(response.status, 409);
  });

  await t.test("success revokes certificate", async () => {
    let updated = null;
    const certificateIssue = {
      findUnique: async () => ({ id: "issue-1", status: "ISSUED" }),
      updateMany: async ({ data }) => { updated = data; return { count: 1 }; },
    };
    const coreAuditLog = { create: async () => ({ id: "audit-1" }) };
    const prisma = {
      certificateIssue,
      coreAuditLog,
      $transaction: async (callback) => callback({ certificateIssue, coreAuditLog }),
    };
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma,
    }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/revoke", {
      method: "POST",
      body: JSON.stringify({ reason: "Issued in error" }),
    }), { params: { id: "issue-1" } });
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(updated.status, "REVOKED");
    assert.equal(updated.revokedByUserId, "admin-1");
    assert.equal(updated.revocationReason, "Issued in error");
  });

  await t.test("concurrent revoke loses the compare-and-set race", async () => {
    const certificateIssue = {
      findUnique: async () => ({ id: "issue-1", status: "ISSUED" }),
      updateMany: async () => ({ count: 0 }),
    };
    const coreAuditLog = { create: async () => ({ id: "audit-1" }) };
    const prisma = {
      certificateIssue,
      coreAuditLog,
      $transaction: async (callback) => callback({ certificateIssue, coreAuditLog }),
    };
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma,
    }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/revoke", {
      method: "POST",
      body: JSON.stringify({ reason: "Concurrent change" }),
    }), { params: { id: "issue-1" } });
    assert.equal(response.status, 409);
  });

  await t.test("database unavailable returns 503", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "admin-1", role: "ADMIN" }, prisma: null }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/revoke", {
      method: "POST",
      body: JSON.stringify({ reason: "Reason" }),
    }), { params: { id: "issue-1" } });
    assert.equal(response.status, 503);
  });
});

test("certificate restore route", async (t) => {
  const sourcePath = path.join(apiRoot, "admin/certificates/[id]/restore/route.ts");

  for (const role of ["EVENT_MANAGER", "VERIFIER", "ATTENDEE"]) {
    await t.test(`returns 403 for ${role}`, async () => {
      const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "u1", role } }));
      const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/restore", { method: "POST" }), { params: { id: "issue-1" } });
      assert.equal(response.status, 403);
    });
  }

  await t.test("missing certificate returns 404", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma: { certificateIssue: { findUnique: async () => null } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/restore", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 404);
  });

  await t.test("non-revoked certificate returns 409", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma: { certificateIssue: { findUnique: async () => ({ id: "issue-1", status: "ISSUED" }) } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/restore", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 409);
  });

  await t.test("success restores revoked certificate", async () => {
    let updated = null;
    const certificateIssue = {
      findUnique: async () => ({ id: "issue-1", status: "REVOKED" }),
      updateMany: async ({ data }) => { updated = data; return { count: 1 }; },
    };
    const coreAuditLog = { create: async () => ({ id: "audit-1" }) };
    const prisma = {
      certificateIssue,
      coreAuditLog,
      $transaction: async (callback) => callback({ certificateIssue, coreAuditLog }),
    };
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma,
    }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/restore", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(updated.status, "ISSUED");
    assert.equal(updated.restoredByUserId, "admin-1");
  });

  await t.test("concurrent restore loses the compare-and-set race", async () => {
    const certificateIssue = {
      findUnique: async () => ({ id: "issue-1", status: "REVOKED" }),
      updateMany: async () => ({ count: 0 }),
    };
    const coreAuditLog = { create: async () => ({ id: "audit-1" }) };
    const prisma = {
      certificateIssue,
      coreAuditLog,
      $transaction: async (callback) => callback({ certificateIssue, coreAuditLog }),
    };
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma,
    }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/restore", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 409);
  });

  await t.test("database unavailable returns 503", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "admin-1", role: "ADMIN" }, prisma: null }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/restore", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 503);
  });
});

test("certificate application review route compare-and-set and reliable audit (CP-AUD-006/005)", async (t) => {
  const sourcePath = path.join(apiRoot, "admin/certificate-applications/[id]/review/route.ts");

  const submittedApplication = { id: "app-1", status: "SUBMITTED", definitionId: "def-1", applicantId: "user-1" };
  const extra = {
    "@/lib/server/certificate-applications": {
      approveCertificateApplication: async () => ({ error: "approve is covered by the service test", status: 409 }),
    },
  };
  const postReview = (route, body) => route.POST(new Request("https://passport.test/api/admin/certificate-applications/app-1/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), { params: { id: "app-1" } });

  for (const role of ["EVENT_MANAGER", "VERIFIER", "ATTENDEE"]) {
    await t.test(`returns 403 for ${role}`, async () => {
      const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "u1", role }, extra }));
      const response = await postReview(route, { action: "REJECT", message: "Not eligible" });
      assert.equal(response.status, 403);
    });
  }

  await t.test("message required for request_information and reject", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "admin-1", role: "ADMIN" }, extra }));
    assert.equal((await postReview(route, { action: "REJECT" })).status, 400);
    assert.equal((await postReview(route, { action: "REQUEST_INFORMATION" })).status, 400);
    assert.equal((await postReview(route, { action: "APPROVE_AND_ISSUE" })).status, 409);
  });

  await t.test("missing application returns 404", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma: { certificateApplication: { findUnique: async () => null } },
      extra,
    }));
    assert.equal((await postReview(route, { action: "REJECT", message: "Not eligible" })).status, 404);
  });

  await t.test("non-submitted application returns 409", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma: { certificateApplication: { findUnique: async () => ({ ...submittedApplication, status: "APPROVED" }) } },
      extra,
    }));
    assert.equal((await postReview(route, { action: "REJECT", message: "Not eligible" })).status, 409);
  });

  await t.test("concurrent review loses the compare-and-set race", async () => {
    const prisma = {
      certificateApplication: {
        findUnique: async () => submittedApplication,
        updateMany: async () => ({ count: 0 }),
      },
      certificateApplicationEvent: { create: async () => ({ id: "event-1" }) },
      coreAuditLog: { create: async () => ({ id: "audit-1" }) },
      notification: { create: async () => ({ id: "notification-1" }) },
      $transaction: async (callback) => callback(prisma),
    };
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "admin-1", role: "ADMIN" }, prisma, extra }));
    const response = await postReview(route, { action: "REJECT", message: "Concurrent change" });
    assert.equal(response.status, 409);
    assert.equal(response.payload.error, "Application is no longer submitted.");
  });

  await t.test("successful request_information writes exactly one event, audit, and notification", async () => {
    const writes = { events: 0, audits: [], notifications: 0 };
    let casApplied = false;
    const updatedApplication = { ...submittedApplication, status: "NEEDS_INFORMATION" };
    const prisma = {
      certificateApplication: {
        findUnique: async () => (casApplied ? updatedApplication : submittedApplication),
        updateMany: async () => { casApplied = true; return { count: 1 }; },
      },
      certificateApplicationEvent: { create: async () => { writes.events += 1; return { id: "event-1" }; } },
      coreAuditLog: { create: async ({ data }) => { writes.audits.push(data); return { id: "audit-1" }; } },
      notification: { create: async () => { writes.notifications += 1; return { id: "notification-1" }; } },
      $transaction: async (callback) => callback(prisma),
    };
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "admin-1", role: "ADMIN" }, prisma, extra }));
    const response = await postReview(route, { action: "REQUEST_INFORMATION", message: "Please provide attendance proof." });
    assert.equal(response.status, 200);
    assert.equal(response.payload.application.status, "NEEDS_INFORMATION");
    assert.equal(writes.events, 1);
    assert.equal(writes.notifications, 1);
    assert.equal(writes.audits.length, 1);
    assert.equal(writes.audits[0].action, "certificate_application.request_information");
    assert.equal(writes.audits[0].subjectId, "app-1");
  });

  await t.test("audit write failure returns explicit 500 without side effects (CP-AUD-005)", async () => {
    let events = 0;
    let notifications = 0;
    const prisma = {
      certificateApplication: {
        findUnique: async () => submittedApplication,
        updateMany: async () => ({ count: 1 }),
      },
      certificateApplicationEvent: { create: async () => { events += 1; return { id: "event-1" }; } },
      coreAuditLog: { create: async () => { throw new Error("audit store unavailable"); } },
      notification: { create: async () => { notifications += 1; return { id: "notification-1" }; } },
      $transaction: async (callback) => {
        try {
          return await callback(prisma);
        } catch (error) {
          events = 0;
          notifications = 0;
          throw error;
        }
      },
    };
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "admin-1", role: "ADMIN" }, prisma, extra }));
    const response = await postReview(route, { action: "REJECT", message: "Not eligible" });
    assert.equal(response.status, 500);
    assert.match(response.payload.error, /No state was changed/);
    assert.equal(events, 0, "rolled-back transaction must not keep the event write");
    assert.equal(notifications, 0, "rolled-back transaction must not keep the notification write");
  });
});

test("certificate lifecycle routes fail explicitly when the audit write fails (CP-AUD-005)", async (t) => {
  const revokeSource = path.join(apiRoot, "admin/certificates/[id]/revoke/route.ts");
  const restoreSource = path.join(apiRoot, "admin/certificates/[id]/restore/route.ts");

  await t.test("revoke returns 500 and keeps state unchanged when audit write fails", async () => {
    let stateUpdate = null;
    const certificateIssue = {
      findUnique: async () => ({ id: "issue-1", status: "ISSUED" }),
      updateMany: async ({ data }) => { stateUpdate = data; return { count: 1 }; },
    };
    const coreAuditLog = { create: async () => { throw new Error("audit store unavailable"); } };
    const prisma = {
      certificateIssue,
      coreAuditLog,
      $transaction: async (callback) => callback({ certificateIssue, coreAuditLog }),
    };
    const route = loadRouteModule(revokeSource, baseMocks({ authUser: { id: "admin-1", role: "ADMIN" }, prisma }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/revoke", {
      method: "POST",
      body: JSON.stringify({ reason: "Issued in error" }),
    }), { params: { id: "issue-1" } });
    assert.equal(response.status, 500);
    assert.match(response.payload.error, /No state was changed/);
    assert.equal(stateUpdate.status, "REVOKED", "state write was attempted inside the same transaction");
  });

  await t.test("restore returns 500 when audit write fails", async () => {
    const certificateIssue = {
      findUnique: async () => ({ id: "issue-1", status: "REVOKED" }),
      updateMany: async () => ({ count: 1 }),
    };
    const coreAuditLog = { create: async () => { throw new Error("audit store unavailable"); } };
    const prisma = {
      certificateIssue,
      coreAuditLog,
      $transaction: async (callback) => callback({ certificateIssue, coreAuditLog }),
    };
    const route = loadRouteModule(restoreSource, baseMocks({ authUser: { id: "admin-1", role: "ADMIN" }, prisma }));
    const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/restore", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 500);
    assert.match(response.payload.error, /No state was changed/);
  });
});

test("certificate download route", async (t) => {
  const sourcePath = path.join(apiRoot, "certificates/[id]/download/route.ts");

  await t.test("unauthenticated redirects", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    await assert.rejects(async () => route.POST(new Request("https://passport.test/api/certificates/issue-1/download", { method: "POST" }), { params: { id: "issue-1" } }), /redirect/);
  });

  await t.test("owner succeeds", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u1", role: "ATTENDEE" },
      prisma: { certificateIssue: { findUnique: async () => makeIssue("u1") } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/certificates/issue-1/download", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.match(response.payload.download.url, /artifact\?disposition=attachment/);
  });

  await t.test("non-owner returns 403", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u2", role: "ATTENDEE" },
      prisma: { certificateIssue: { findUnique: async () => makeIssue("u1") } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/certificates/issue-1/download", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 403);
  });

  await t.test("admin succeeds for any owner", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma: { certificateIssue: { findUnique: async () => makeIssue("u1") } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/certificates/issue-1/download", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 200);
  });

  await t.test("non-downloadable status returns 409", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u1", role: "ATTENDEE" },
      prisma: { certificateIssue: { findUnique: async () => makeIssue("u1", { status: "PENDING_APPROVAL" }) } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/certificates/issue-1/download", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 409);
  });

  await t.test("database unavailable returns 503", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ authUser: { id: "u1", role: "ATTENDEE" }, prisma: null }));
    const response = await route.POST(new Request("https://passport.test/api/certificates/issue-1/download", { method: "POST" }), { params: { id: "issue-1" } });
    assert.equal(response.status, 503);
  });
});

test("certificate artifact route", async (t) => {
  const sourcePath = path.join(apiRoot, "certificates/[id]/artifact/route.ts");

  await t.test("owner download persists one count and preserves Unicode filename", async () => {
    const updates = [];
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u1", role: "ATTENDEE" },
      prisma: issuePrisma(makeIssue("u1", { generatedFileName: "课程证书-气候行动-王小明-CV-001.html" }), updates),
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/issue-1/artifact"), { params: { id: "issue-1" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
    assert.match(response.headers["content-disposition"], /attachment/);
    assert.match(response.headers["content-disposition"], /filename\*=UTF-8''/);
    assert.equal(decodeURIComponent(response.headers["content-disposition"].split("filename*=UTF-8''")[1]), "课程证书-气候行动-王小明-CV-001.html");
    assert.equal(response.headers["cache-control"], "private, no-store");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(JSON.stringify(updates.map((entry) => entry.data)), JSON.stringify([{ downloadCount: { increment: 1 } }]));
  });

  await t.test("inline disposition returns sandbox CSP without incrementing count", async () => {
    const updates = [];
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u1", role: "ATTENDEE" },
      prisma: issuePrisma(makeIssue("u1"), updates),
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/issue-1/artifact?disposition=inline"), { params: { id: "issue-1" } });
    assert.equal(response.status, 200);
    assert.match(response.headers["content-disposition"], /inline/);
    assert.ok(response.headers["content-security-policy"]);
    assert.equal(updates.length, 0);
  });

  await t.test("non-owner returns 403 without incrementing count", async () => {
    const updates = [];
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u2", role: "ATTENDEE" },
      prisma: issuePrisma(makeIssue("u1"), updates),
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/issue-1/artifact"), { params: { id: "issue-1" } });
    assert.equal(response.status, 403);
    assert.equal(updates.length, 0);
  });

  await t.test("admin succeeds", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "admin-1", role: "ADMIN" },
      prisma: issuePrisma(makeIssue("u1")),
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/issue-1/artifact"), { params: { id: "issue-1" } });
    assert.equal(response.status, 200);
  });

  await t.test("legacy artifact fallback persists state before counting download", async () => {
    const updates = [];
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u1", role: "ATTENDEE" },
      prisma: issuePrisma(makeIssue("u1", { artifactState: "NONE", generatedFileUrl: "data:text/html,legacy" }), updates),
      extra: {
        "@/lib/server/certificate-artifact-storage": {
          decodeLegacyCertificateArtifact: () => ({ bytes: Buffer.from("legacy"), contentType: "text/html; charset=utf-8", fileName: "cert.html" }),
          getCertificateArtifact: async () => Buffer.from("<html></html>"),
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/issue-1/artifact"), { params: { id: "issue-1" } });
    assert.equal(response.status, 200);
    assert.equal(response.body.length, 6);
    assert.equal(JSON.stringify(updates.map((entry) => entry.data)), JSON.stringify([
      { artifactState: "LEGACY_INLINE" },
      { downloadCount: { increment: 1 } },
    ]));
  });

  await t.test("missing artifact returns 404 without incrementing count", async () => {
    const updates = [];
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u1", role: "ATTENDEE" },
      prisma: issuePrisma(makeIssue("u1", { artifactState: "NONE", generatedFileUrl: null }), updates),
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/issue-1/artifact"), { params: { id: "issue-1" } });
    assert.equal(response.status, 404);
    assert.equal(updates.length, 0);
  });

  await t.test("count persistence failure fails closed", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u1", role: "ATTENDEE" },
      prisma: {
        certificateIssue: {
          findUnique: async () => makeIssue("u1"),
          update: async () => { throw new Error("database unavailable"); },
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/issue-1/artifact"), { params: { id: "issue-1" } });
    assert.equal(response.status, 503);
    assert.equal(response.payload.error, "Certificate download could not be recorded.");
  });
});

test("public certificate verify route", async (t) => {
  const sourcePath = path.join(apiRoot, "certificates/verify/[code]/route.ts");

  await t.test("rate-limit denied returns 429", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ rateLimit: denyRateLimit }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/verify/CV-123"), { params: { code: "CV-123" } });
    assert.equal(response.status, 429);
  });

  await t.test("preview request resolves preview", async () => {
    let calledPreview = false;
    const route = loadRouteModule(sourcePath, baseMocks({
      extra: {
        "@/lib/server/certificate-verification": {
          resolvePublicCertificateVerification: async (input) => {
            calledPreview = input.isPreviewRequest === true;
            return { httpStatus: 200, valid: false, result: "PREVIEW", verificationCode: input.code, accessLevel: "PUBLIC", message: "Preview" };
          },
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/verify/CV-PREVIEW"), { params: { code: "CV-PREVIEW" } });
    assert.equal(response.status, 200);
    assert.equal(calledPreview, true);
    assert.equal(response.payload.result, "PREVIEW");
  });

  await t.test("not found returns 404", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      extra: {
        "@/lib/server/certificate-verification": {
          resolvePublicCertificateVerification: async () => ({ httpStatus: 404, valid: false, result: "NOT_FOUND", verificationCode: "CV-123", accessLevel: "PUBLIC" }),
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/verify/CV-123"), { params: { code: "CV-123" } });
    assert.equal(response.status, 404);
    assert.equal(response.payload.result, "NOT_FOUND");
  });

  await t.test("public viewer gets minimum disclosure", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      extra: {
        "@/lib/server/certificate-verification": {
          resolvePublicCertificateVerification: async () => ({
            httpStatus: 200,
            valid: true,
            result: "VALID",
            verificationCode: "CV-123",
            accessLevel: "PUBLIC",
            certificate: {
              title: "Course",
              holderName: "Alice",
              maskedPassportId: "CP-****-0001",
              issuingOrganization: "Climate Passport",
              issuedAt: new Date().toISOString(),
              expiryDate: null,
              credentialType: "Course",
              certificateNumber: "CV-123",
              verifiedAt: new Date().toISOString(),
            },
          }),
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/verify/CV-123"), { params: { code: "CV-123" } });
    assert.equal(response.status, 200);
    assert.equal(response.payload.accessLevel, "PUBLIC");
    assert.equal(response.payload.certificate.holderEmail, undefined);
    assert.equal(response.payload.certificate.extended, undefined);
  });

  await t.test("holder sees extended fields", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "u1", role: "ATTENDEE" },
      extra: {
        "@/lib/server/certificate-verification": {
          resolvePublicCertificateVerification: async () => ({
            httpStatus: 200,
            valid: true,
            result: "VALID",
            verificationCode: "CV-123",
            accessLevel: "HOLDER",
            certificate: {
              title: "Course",
              holderName: "Alice",
              maskedPassportId: "CP-****-0001",
              issuingOrganization: "Climate Passport",
              issuedAt: new Date().toISOString(),
              expiryDate: null,
              credentialType: "Course",
              certificateNumber: "CV-123",
              verifiedAt: new Date().toISOString(),
              extended: { issueId: "issue-1", status: "ISSUED", holderEmail: "alice@example.com" },
            },
          }),
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/verify/CV-123"), { params: { code: "CV-123" } });
    assert.equal(response.status, 200);
    assert.equal(response.payload.accessLevel, "HOLDER");
    assert.equal(response.payload.certificate.extended.holderEmail, "alice@example.com");
  });

  await t.test("resource-authorized staff pass-through (lib grants STAFF only to holder or source-activity manager)", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authUser: { id: "em-1", role: "EVENT_MANAGER" },
      extra: {
        "@/lib/server/certificate-verification": {
          resolvePublicCertificateVerification: async () => ({
            httpStatus: 200,
            valid: true,
            result: "VALID",
            verificationCode: "CV-123",
            accessLevel: "STAFF",
            certificate: {
              title: "Course",
              holderName: "Alice",
              maskedPassportId: "CP-****-0001",
              issuingOrganization: "Climate Passport",
              issuedAt: new Date().toISOString(),
              expiryDate: null,
              credentialType: "Course",
              certificateNumber: "CV-123",
              verifiedAt: new Date().toISOString(),
              extended: { issueId: "issue-1", status: "ISSUED" },
            },
          }),
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/certificates/verify/CV-123"), { params: { code: "CV-123" } });
    assert.equal(response.status, 200);
    assert.equal(response.payload.accessLevel, "STAFF");
    assert.ok(response.payload.certificate.extended);
  });
});

test("parameterized certificate admin RBAC", async (t) => {
  const issueSource = path.join(apiRoot, "admin/certificates/issue/route.ts");
  const revokeSource = path.join(apiRoot, "admin/certificates/[id]/revoke/route.ts");
  const restoreSource = path.join(apiRoot, "admin/certificates/[id]/restore/route.ts");
  const regenerateSource = path.join(apiRoot, "admin/certificates/[id]/regenerate/route.ts");

  const issuePrisma = {
    $transaction: async (cb) => cb({
      certificateDefinition: { findFirst: async () => makeCertificateDefinition() },
      certificateIssue: { findFirst: async () => null, findUnique: async () => null },
      user: { findUnique: async () => ({ id: "u1" }) },
    }),
    certificateDefinition: { findFirst: async () => makeCertificateDefinition() },
    certificateIssue: { findFirst: async () => null, findUnique: async () => null, create: async ({ data }) => ({ id: "issue-1", verificationCode: data.verificationCode, generatedFileName: data.generatedFileName }) },
  };

  const lifecyclePrisma = {
    certificateIssue: {
      findUnique: async () => ({ id: "issue-1", status: "ISSUED" }),
      updateMany: async () => ({ count: 1 }),
    },
    coreAuditLog: { create: async () => ({ id: "audit-1" }) },
  };
  lifecyclePrisma.$transaction = async (callback) => callback(lifecyclePrisma);

  for (const role of ["ADMIN", "EVENT_MANAGER", "VERIFIER", "ATTENDEE"]) {
    await t.test(`${role}: issue route ${role === "ADMIN" ? "proceeds past guard" : "returns 403"}`, async () => {
      const route = loadRouteModule(issueSource, baseMocks({ authUser: { id: "u1", role }, prisma: issuePrisma }));
      const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com", templateId: "123e4567-e89b-12d3-a456-426614174000" }),
      }));
      if (role === "ADMIN") {
        assert.equal(response.status, 200);
        assert.equal(response.payload.ok, true);
      } else {
        assert.equal(response.status, 403);
      }
    });

    await t.test(`${role}: revoke route ${role === "ADMIN" ? "proceeds past guard" : "returns 403"}`, async () => {
      const route = loadRouteModule(revokeSource, baseMocks({ authUser: { id: "u1", role }, prisma: lifecyclePrisma }));
      const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/revoke", {
        method: "POST",
        body: JSON.stringify({ reason: "Reason" }),
      }), { params: { id: "issue-1" } });
      if (role === "ADMIN") {
        assert.notEqual(response.status, 403);
      } else {
        assert.equal(response.status, 403);
      }
    });

    await t.test(`${role}: restore route ${role === "ADMIN" ? "proceeds past guard" : "returns 403"}`, async () => {
      const route = loadRouteModule(restoreSource, baseMocks({ authUser: { id: "u1", role }, prisma: lifecyclePrisma }));
      const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/restore", { method: "POST" }), { params: { id: "issue-1" } });
      if (role === "ADMIN") {
        assert.notEqual(response.status, 403);
      } else {
        assert.equal(response.status, 403);
      }
    });

    await t.test(`${role}: regenerate route ${role === "ADMIN" ? "proceeds past guard" : "returns 403"}`, async () => {
      const route = loadRouteModule(regenerateSource, baseMocks({ authUser: { id: "u1", role }, prisma: lifecyclePrisma }));
      const response = await route.POST(new Request("https://passport.test/api/admin/certificates/issue-1/regenerate", { method: "POST" }), { params: { id: "issue-1" } });
      if (role === "ADMIN") {
        assert.notEqual(response.status, 403);
      } else {
        assert.equal(response.status, 403);
      }
    });
  }
});
