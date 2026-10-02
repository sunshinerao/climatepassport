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
    completeAuthEmailAction: async () => null,
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

function baseMocks({ auth = {}, authEmail = {}, prisma = {}, rateLimit = allowRateLimit, durable = allowRateLimit, enqueue = async () => {} } = {}) {
  return {
    "@/lib/server/auth-rate-limit": { checkAuthRateLimit: async () => { if (durable.unavailable) throw Error("quota unavailable"); return durable; } },
    "@/lib/server/auth-mail-outbox": { enqueueAuthMailRequest: enqueue },
    "@/lib/server/auth": authMock(auth),
    "@/lib/server/auth-email": authEmailMock(authEmail),
    "@/lib/server/prisma": prismaMock(prisma),
    "@/lib/server/rate-limit": rateLimitMock(rateLimit),
    "@/lib/redirect-path": redirectPathMock(),
  };
}

const clean = value => JSON.parse(JSON.stringify(value));
const active = { id: "u1", email: "alice@example.invalid", status: "ACTIVE", emailVerified: new Date(), password: "stored-hash", role: "ATTENDEE" };
const registration = { name: "Alice", email: "Alice@example.invalid", password: "password123", phone: "1234567890", country: "CN", organizationName: "Synthetic Org" };
function post(route, body, options = {}) {
  const api = loadRouteModule(path.join(apiRoot, "auth", route, "route.ts"), baseMocks(options));
  return api.POST(new Request(`https://passport.test/api/auth/${route}`, { method: "POST", body: JSON.stringify(body) }));
}
const loginBody = { email: active.email, password: "password123" };
test("auth login route", async t => {
  await t.test("invalid payload returns 400", async () => assert.equal((await post("login", {email:"bad"})).status,400));
  for (const [name, options, status] of [
    ["IP limiter unavailable",{rateLimit:unavailableRateLimit},503],
    ["durable limiter unavailable",{durable:unavailableRateLimit},503],
    ["IP limiter denied",{rateLimit:denyRateLimit},429],
    ["durable limiter denied",{durable:denyRateLimit},429],
  ]) await t.test(name,async()=>assert.equal((await post("login",loginBody,options)).status,status));
  for (const user of [null,{...active,status:"PENDING"},{...active,status:"SUSPENDED"}]) await t.test(`missing or inactive ${user?.status ?? "missing"} is generic 401`,async()=>{
    let checks=0;
    const r=await post("login",loginBody,{prisma:{user:{findUnique:async()=>user}},auth:{verifyUserPassword:async()=>{checks++;return true;},createUserSession:async()=>assert.fail("no session")}});
    assert.equal(r.status,401);assert.equal(r.payload.error,"Invalid email or password.");assert.equal(checks,1);
  });
  await t.test("wrong password returns 401",async()=>assert.equal((await post("login",loginBody,{prisma:{user:{findUnique:async()=>active}}})).status,401));
  await t.test("unverified login redirects without sending or session",async()=>{
    const r=await post("login",loginBody,{prisma:{user:{findUnique:async()=>({...active,emailVerified:null})}},auth:{verifyUserPassword:async()=>true,createUserSession:async()=>assert.fail("no session")},authEmail:{sendVerificationEmail:async()=>assert.fail("no provider")}});
    assert.equal(r.status,403);assert.equal(r.payload.requiresVerification,true);assert.match(r.payload.redirectTo,/auth\/verify-email/);
  });
  await t.test("session race rejects login",async()=>assert.equal((await post("login",loginBody,{prisma:{user:{findUnique:async()=>active}},auth:{verifyUserPassword:async()=>true,createUserSession:async()=>{throw Error("changed");}}})).status,401));
  await t.test("verified login passes expected hash to session guard",async()=>{
    let args;const r=await post("login",{...loginBody,next:"/en/certificates"},{prisma:{user:{findUnique:async()=>active}},auth:{verifyUserPassword:async()=>true,createUserSession:async(...a)=>{args=a;}}});
    assert.equal(r.status,200);assert.equal(r.payload.redirectTo,"/en/certificates");assert.deepEqual(args,["u1","stored-hash"]);
  });
  await t.test("database unavailable returns 503",async()=>assert.equal((await post("login",loginBody,{prisma:null})).status,503));
});
for (const route of ["register","forgot-password","verify-email/request"]) test(`auth ${route} route`,async t=>{
  const body=route==="register"?registration:{email:registration.email};
  await t.test("invalid payload is 400",async()=>assert.equal((await post(route,{email:"bad"})).status,400));
  const responses=[];
  for (const state of ["missing","ACTIVE","PENDING","SUSPENDED","verified","unverified"]) await t.test(`${state} account queues identical instructions without account reads or mutations`,async()=>{
    const queued=[];const forbidden=async()=>assert.fail("route must not inspect or mutate account");
    const r=await post(route,body,{prisma:{user:{findUnique:forbidden,create:forbidden,update:forbidden},$transaction:forbidden},auth:{hashUserPassword:forbidden,createUserSession:forbidden},authEmail:{createEmailToken:forbidden,sendVerificationEmail:forbidden,sendResetPasswordEmail:forbidden},enqueue:async request=>queued.push(clean(request))});
    assert.equal(r.status,200);assert.equal(r.payload.ok,true);responses.push(clean(r.payload));assert.deepEqual(clean(r.payload),responses[0]);
    assert.equal(queued.length,1);assert.equal(queued[0].email,"alice@example.invalid");assert.equal(queued[0].kind,({register:"REGISTER","forgot-password":"RESET","verify-email/request":"VERIFY"})[route]);
    assert.doesNotMatch(JSON.stringify(queued),/password123|passwordHash/);
    if(route==="register")assert.deepEqual(queued[0].profile,{name:"Alice",phone:"1234567890",country:"CN",organizationName:"Synthetic Org"});
  });
  await t.test("provider unavailability cannot affect enqueue response",async()=>assert.equal((await post(route,body,{authEmail:{sendVerificationEmail:async()=>{throw Error("provider down");},sendResetPasswordEmail:async()=>{throw Error("provider down");}}})).status,200));
  await t.test("enqueue failure returns 503 without acknowledgment",async()=>{const r=await post(route,body,{enqueue:async()=>{throw Error("queue down");}});assert.equal(r.status,503);assert.equal(r.payload.ok,undefined);});
  await t.test("durable quota denied before enqueue",async()=>assert.equal((await post(route,body,{durable:denyRateLimit,enqueue:async()=>assert.fail("no enqueue")})).status,429));
  await t.test("IP unavailable fails closed",async()=>assert.equal((await post(route,body,{rateLimit:unavailableRateLimit,enqueue:async()=>assert.fail("no enqueue")})).status,503));
});
for (const route of ["reset-password","verify-email/confirm"]) test(`auth ${route} route`,async t=>{
  const body={email:"Alice@example.invalid",code:"123456",password:"newpass123"};
  const purpose=route==="reset-password"?"RESET_PASSWORD":"VERIFY_EMAIL";
  for(const [name,input] of [["missing credential",{email:body.email,password:body.password}],["short token",{...body,code:undefined,token:"short"}],["ambiguous credential",{...body,token:"synthetic-token-long-enough"}],["missing chosen password",{email:body.email,code:body.code}]]) await t.test(name,async()=>assert.equal((await post(route,input,{authEmail:{completeAuthEmailAction:async()=>assert.fail("no mutation")}})).status,400));
  for(const reason of ["expired","unknown","email mismatch","inactive","replayed"]) await t.test(`${reason} atomic guard rejects with generic 400`,async()=>{
    let input;const r=await post(route,body,{authEmail:{completeAuthEmailAction:async a=>{input=clean(a);return null;}}});assert.equal(r.status,400);assert.match(r.payload.error,/Invalid or expired/);assert.equal(input.email,"alice@example.invalid");assert.equal(input.purpose,purpose);
  });
  await t.test("success delegates exact hashed mutation and never performs route writes or autosession",async()=>{
    let input;const forbidden=async()=>assert.fail("atomic guard owns mutation; login owns session");
    const r=await post(route,{...body,next:"/en/dashboard"},{prisma:{user:{update:forbidden},session:{deleteMany:forbidden}},auth:{createUserSession:forbidden},authEmail:{completeAuthEmailAction:async a=>{input=clean(a);return {userId:"u1",email:"alice@example.invalid"};}}});
    assert.equal(r.status,200);assert.equal(r.payload.ok,true);assert.deepEqual(input,{purpose,email:"alice@example.invalid",code:"123456",passwordHash:"hashed:newpass123"});
    if(route==="verify-email/confirm")assert.match(r.payload.redirectTo,/^\/en\/auth\/login\?/);
  });
  await t.test("atomic transaction failure is 503",async()=>assert.equal((await post(route,body,{authEmail:{completeAuthEmailAction:async()=>{throw Error("rollback");}}})).status,503));
  await t.test("denied quota performs no mutation",async()=>assert.equal((await post(route,body,{durable:denyRateLimit,authEmail:{completeAuthEmailAction:async()=>assert.fail("no mutation")}})).status,429));
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
