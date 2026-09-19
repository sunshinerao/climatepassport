import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadRouteModule, createNextResponseMock } from "./_route-loader.mjs";

const apiRoot = path.resolve("apps/passport-web/app/api");

const allowRateLimit = { allowed: true, unavailable: false };
const denyRateLimit = { allowed: false, unavailable: false, retryAfter: 5_000 };
const unavailableRateLimit = { allowed: false, unavailable: true };

function rateLimitMock(result = allowRateLimit) {
  return {
    checkRateLimitAsync: async () => result,
    getRateLimitHeaders: (r) => (r?.retryAfter ? { "Retry-After": String(Math.ceil(r.retryAfter / 1000)) } : {}),
    getRateLimitSubjectReference: (email) => `subject-${email}`,
    getRequestRateLimitKey: (_request, prefix) => `${prefix}:key`,
  };
}

function authMock(overrides = {}) {
  return {
    getCurrentUser: async () => null,
    requireAuthenticatedUser: async () => {
      const err = new Error("redirect:/login");
      err.name = "NEXT_REDIRECT";
      throw err;
    },
    normalizeUserEmail: (value) => value.trim().toLowerCase(),
    hashUserPassword: async (pwd) => `hashed:${pwd}`,
    verifyUserPassword: async (_stored, _input) => false,
    createUserSession: async (_userId) => ({ sessionToken: "token", expires: new Date() }),
    destroyCurrentSession: async () => {},
    getDashboardPathForRole: (_locale, role) => (role === "ADMIN" || role === "EVENT_MANAGER" ? "/en/admin/events" : "/en/dashboard/climate-passport"),
    generateClimatePassportId: async () => "CP-NEW-000001",
    ...overrides,
  };
}

function authEmailMock(overrides = {}) {
  return {
    createEmailToken: async () => ({ token: "raw-token-hex", code: "123456", expiresAt: new Date() }),
    sendVerificationEmail: async () => {},
    sendResetPasswordEmail: async () => {},
    consumeEmailTokenByToken: async () => null,
    consumeEmailTokenByCode: async () => null,
    ...overrides,
  };
}

function prismaMock(client = {}) {
  return { getPrismaClient: () => client };
}

function redirectPathMock() {
  return {
    sanitizeLocalRedirectPath: (next, fallback) => (typeof next === "string" && next.startsWith("/") ? next : fallback),
  };
}

function baseMocks({ auth = {}, authEmail = {}, prisma = {}, rateLimit = allowRateLimit } = {}) {
  return {
    "@/lib/server/auth": authMock(auth),
    "@/lib/server/auth-email": authEmailMock(authEmail),
    "@/lib/server/prisma": prismaMock(prisma),
    "@/lib/server/rate-limit": rateLimitMock(rateLimit),
    "@/lib/redirect-path": redirectPathMock(),
  };
}

test("auth login route", async (t) => {
  const sourcePath = path.join(apiRoot, "auth/login/route.ts");

  await t.test("invalid payload returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const request = new Request("https://passport.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "" }),
    });
    const response = await route.POST(request);
    assert.equal(response.status, 400);
  });

  await t.test("rate-limit unavailable returns 503", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ rateLimit: unavailableRateLimit }));
    const response = await route.POST(new Request("https://passport.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "password" }),
    }));
    assert.equal(response.status, 503);
  });

  await t.test("rate-limit denied returns 429", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ rateLimit: denyRateLimit }));
    const response = await route.POST(new Request("https://passport.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "password" }),
    }));
    assert.equal(response.status, 429);
  });

  await t.test("missing or inactive user returns 401", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma: {
        user: {
          findUnique: async () => null,
        },
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "password" }),
    }));
    assert.equal(response.status, 401);
    assert.equal(response.payload.error, "Invalid email or password.");
  });

  await t.test("wrong password returns 401", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      auth: { verifyUserPassword: async () => false },
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", email: "a@b.com", emailVerified: new Date(), password: "hash", role: "ATTENDEE", status: "ACTIVE" }),
        },
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "wrong" }),
    }));
    assert.equal(response.status, 401);
  });

  await t.test("unverified active user sends email and returns 403 with redirect", async () => {
    let sent = false;
    const route = loadRouteModule(sourcePath, baseMocks({
      auth: { verifyUserPassword: async () => true },
      authEmail: { sendVerificationEmail: async () => { sent = true; } },
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", email: "a@b.com", emailVerified: null, password: "hash", role: "ATTENDEE", status: "ACTIVE" }),
        },
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "password", next: "/en/dashboard" }),
    }));
    assert.equal(response.status, 403);
    assert.equal(response.payload.requiresVerification, true);
    assert.match(response.payload.redirectTo, /\/en\/auth\/verify-email/);
    assert.equal(sent, true);
  });

  await t.test("email send failure for unverified user returns 502", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      auth: { verifyUserPassword: async () => true },
      authEmail: { sendVerificationEmail: async () => { throw new Error("resend down"); } },
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", email: "a@b.com", emailVerified: null, password: "hash", role: "ATTENDEE", status: "ACTIVE" }),
        },
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "password" }),
    }));
    assert.equal(response.status, 502);
  });

  await t.test("verified user creates session and returns redirect", async () => {
    let sessionUserId = null;
    const route = loadRouteModule(sourcePath, baseMocks({
      auth: {
        verifyUserPassword: async () => true,
        createUserSession: async (userId) => { sessionUserId = userId; return { sessionToken: "token", expires: new Date() }; },
      },
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", email: "a@b.com", emailVerified: new Date(), password: "hash", role: "ATTENDEE", status: "ACTIVE" }),
        },
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "password", next: "/en/certificates" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(response.payload.redirectTo, "/en/certificates");
    assert.equal(sessionUserId, "u1");
  });

  await t.test("database unavailable returns 503", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ prisma: null }));
    const response = await route.POST(new Request("https://passport.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "password" }),
    }));
    assert.equal(response.status, 503);
  });
});

test("auth register route", async (t) => {
  const sourcePath = path.join(apiRoot, "auth/register/route.ts");

  const validBody = {
    name: "Alice",
    email: "alice@example.com",
    password: "password123",
    phone: "1234567890",
    country: "CN",
    organizationName: "Org",
  };

  await t.test("invalid payload returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "alice@example.com" }),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("duplicate active account returns 409", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", status: "ACTIVE", role: "ATTENDEE", climatePassportId: "CP-1", summerSchoolApplications: [], notificationPreference: { id: "np1" } }),
        },
        $transaction: async (cb) => cb({}),
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBody),
    }));
    assert.equal(response.status, 409);
  });

  await t.test("new user creation succeeds and sends verification email", async () => {
    let created = null;
    let emailed = false;
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async ({ data }) => { created = data; return { id: "u-new", role: "ATTENDEE" }; },
      },
      $transaction: async (cb) => cb(prisma),
    };
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma,
      authEmail: { sendVerificationEmail: async () => { emailed = true; } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBody),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.match(response.payload.redirectTo, /\/en\/auth\/verify-email/);
    assert.equal(created.email, "alice@example.com");
    assert.equal(emailed, true);
  });

  await t.test("pending existing user is upgraded to active", async () => {
    let updated = null;
    const prisma = {
      user: {
        findUnique: async () => ({ id: "u-pending", status: "PENDING", role: null, climatePassportId: null, summerSchoolApplications: [], notificationPreference: null }),
        update: async ({ data }) => { updated = data; return { id: "u-pending", role: "ATTENDEE" }; },
      },
      summerSchoolApplication: { updateMany: async () => null },
      $transaction: async (cb) => cb(prisma),
    };
    const route = loadRouteModule(sourcePath, baseMocks({ prisma }));
    const response = await route.POST(new Request("https://passport.test/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBody),
    }));
    assert.equal(response.status, 200);
    assert.equal(updated.status, "ACTIVE");
  });

  await t.test("email send failure returns 502", async () => {
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async () => ({ id: "u-new", role: "ATTENDEE" }),
      },
      $transaction: async (cb) => cb(prisma),
    };
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma,
      authEmail: { sendVerificationEmail: async () => { throw new Error("down"); } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBody),
    }));
    assert.equal(response.status, 502);
  });

  await t.test("database unavailable returns 503", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ prisma: null }));
    const response = await route.POST(new Request("https://passport.test/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBody),
    }));
    assert.equal(response.status, 503);
  });
});

test("auth forgot-password route", async (t) => {
  const sourcePath = path.join(apiRoot, "auth/forgot-password/route.ts");

  await t.test("invalid payload returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "bad" }),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("obfuscated success even when email does not exist", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma: { user: { findUnique: async () => null } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "missing@example.com" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
  });

  await t.test("sends reset email only when active and verified", async () => {
    let emailed = false;
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", email: "a@b.com", status: "ACTIVE", emailVerified: new Date() }),
        },
      },
      authEmail: { sendResetPasswordEmail: async () => { emailed = true; } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(emailed, true);
  });

  await t.test("does not send for unverified user but still returns 200", async () => {
    let emailed = false;
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", email: "a@b.com", status: "ACTIVE", emailVerified: null }),
        },
      },
      authEmail: { sendResetPasswordEmail: async () => { emailed = true; } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(emailed, false);
  });

  await t.test("email send failure returns 502", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", email: "a@b.com", status: "ACTIVE", emailVerified: new Date() }),
        },
      },
      authEmail: { sendResetPasswordEmail: async () => { throw new Error("down"); } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com" }),
    }));
    assert.equal(response.status, 502);
  });
});

test("auth reset-password route", async (t) => {
  const sourcePath = path.join(apiRoot, "auth/reset-password/route.ts");

  await t.test("validation requires token or code", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "newpass123" }),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("invalid token returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", token: "tooshort", password: "newpass123" }),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("expired or unknown credential returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", token: "raw-token-hex-longer", password: "newpass123" }),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("email mismatch returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authEmail: {
        consumeEmailTokenByToken: async () => ({ userId: "u1", email: "other@example.com", user: { id: "u1", status: "ACTIVE" } }),
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", token: "raw-token-hex-longer", password: "newpass123" }),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("inactive user returns 403", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authEmail: {
        consumeEmailTokenByToken: async () => ({ userId: "u1", email: "a@b.com", user: { id: "u1", status: "SUSPENDED" } }),
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", token: "raw-token-hex-longer", password: "newpass123" }),
    }));
    assert.equal(response.status, 403);
  });

  await t.test("valid token updates password and returns 200", async () => {
    let updated = null;
    const prisma = {
      user: {
        update: async ({ data }) => { updated = data; return { id: "u1" }; },
      },
    };
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma,
      authEmail: {
        consumeEmailTokenByToken: async () => ({ userId: "u1", email: "a@b.com", user: { id: "u1", status: "ACTIVE" } }),
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", token: "raw-token-hex-longer", password: "newpass123" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(updated.password, "hashed:newpass123");
    assert.equal(updated.resetToken, null);
  });
});

test("auth verify-email request route", async (t) => {
  const sourcePath = path.join(apiRoot, "auth/verify-email/request/route.ts");

  await t.test("sends verification email for active unverified user", async () => {
    let emailed = false;
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", email: "a@b.com", status: "ACTIVE", emailVerified: null }),
        },
      },
      authEmail: { sendVerificationEmail: async () => { emailed = true; } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/verify-email/request", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(emailed, true);
  });

  await t.test("does not send for already verified user but still returns 200", async () => {
    let emailed = false;
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", email: "a@b.com", status: "ACTIVE", emailVerified: new Date() }),
        },
      },
      authEmail: { sendVerificationEmail: async () => { emailed = true; } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/verify-email/request", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(emailed, false);
  });

  await t.test("email send failure returns 502", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma: {
        user: {
          findUnique: async () => ({ id: "u1", email: "a@b.com", status: "ACTIVE", emailVerified: null }),
        },
      },
      authEmail: { sendVerificationEmail: async () => { throw new Error("down"); } },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/verify-email/request", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com" }),
    }));
    assert.equal(response.status, 502);
  });
});

test("auth verify-email confirm route", async (t) => {
  const sourcePath = path.join(apiRoot, "auth/verify-email/confirm/route.ts");

  await t.test("invalid payload returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/auth/verify-email/confirm", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("invalid or expired credential returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/auth/verify-email/confirm", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", code: "123456" }),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("email mismatch returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      authEmail: {
        consumeEmailTokenByCode: async () => ({ userId: "u1", email: "other@example.com" }),
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/verify-email/confirm", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", code: "123456" }),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("successful confirmation activates user and creates session", async () => {
    let updated = null;
    let sessionUserId = null;
    const prisma = {
      user: {
        update: async ({ data }) => { updated = data; return { id: "u1", role: "ATTENDEE" }; },
      },
    };
    const route = loadRouteModule(sourcePath, baseMocks({
      prisma,
      auth: {
        createUserSession: async (userId) => { sessionUserId = userId; return { sessionToken: "token", expires: new Date() }; },
      },
      authEmail: {
        consumeEmailTokenByCode: async () => ({ userId: "u1", email: "a@b.com" }),
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/auth/verify-email/confirm", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", code: "123456", next: "/en/dashboard" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(updated.emailVerified instanceof Date, true);
    assert.equal(updated.status, "ACTIVE");
    assert.equal(sessionUserId, "u1");
  });
});

test("auth logout route", async () => {
  const sourcePath = path.join(apiRoot, "auth/logout/route.ts");
  let destroyed = false;
  const route = loadRouteModule(sourcePath, {
    "@/lib/server/auth": authMock({ destroyCurrentSession: async () => { destroyed = true; } }),
  });
  const response = await route.POST();
  assert.equal(response.status, 200);
  assert.equal(response.payload.ok, true);
  assert.equal(destroyed, true);
});

test("auth session route", async (t) => {
  const sourcePath = path.join(apiRoot, "auth/session/route.ts");

  await t.test("returns authenticated false when anonymous", async () => {
    const route = loadRouteModule(sourcePath, {
      "@/lib/server/auth": authMock(),
    });
    const response = await route.GET();
    assert.equal(response.status, 200);
    assert.equal(response.payload.authenticated, false);
  });

  await t.test("returns authenticated user", async () => {
    const route = loadRouteModule(sourcePath, {
      "@/lib/server/auth": authMock({ getCurrentUser: async () => ({ id: "u1", role: "ATTENDEE" }) }),
    });
    const response = await route.GET();
    assert.equal(response.status, 200);
    assert.equal(response.payload.authenticated, true);
    assert.equal(response.payload.user.id, "u1");
  });
});
