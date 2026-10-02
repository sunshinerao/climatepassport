import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const env = { AUTH_EMAIL_CREDENTIAL_VERSION: 'test-v1', AUTH_EMAIL_CODE_SECRET: 'test-only-not-a-production-secret-000000000', AUTH_PUBLIC_ORIGIN: 'https://passport.example.invalid', NODE_ENV: 'test' };
function load(file, deps = {}, environment = env) {
  const source = fs.readFileSync(`apps/passport-web/lib/server/${file}.ts`, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; vm.runInNewContext(compiled, { exports, require: name => deps[name] ?? require(name), process: { env: environment }, Buffer, URL, Date }); return exports;
}
const security = load('auth-email-security');
function matches(row, where) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('gt' in expected && !(actual > expected.gt)) return false;
      if ('lt' in expected && !(actual < expected.lt)) return false;
      if ('not' in expected && actual === expected.not) return false;
      return true;
    }
    return actual === expected;
  });
}
function harness({ purpose = 'VERIFY_EMAIL', verified = false, status = 'ACTIVE', failures = 0, securityEnvironment = {...env} } = {}) {
  const raw = 'a'.repeat(64), email = 'user@example.invalid';
  let state = { user: { id: 'user-1', email, role: 'ATTENDEE', status, emailVerified: verified ? new Date() : null, password: 'old-hash', resetToken: 'legacy' }, tokens: [], sessions: [{ userId: 'user-1' }], bridges: [{ userId: 'user-1', consumedAt: null }] };
  const record = { credentialVersion: 'test-v1', id: 'token-1', userId: 'user-1', email, purpose, tokenHash: security.hashEmailToken(raw), codeHash: null, expiresAt: new Date(Date.now()+60000), consumedAt: null, attempts: 0, createdAt: new Date() };
  record.codeHash = security.hashEmailCode('123456', record); state.tokens.push(record);
  let chain = Promise.resolve(), calls = 0, failUser = false, lockHook = null, mailed = null;
  const tx = {
    $queryRaw: async () => { if (lockHook) { lockHook(state); lockHook = null; } },
    user: {
      findUnique: async ({where}) => state.user?.id === where.id ? structuredClone(state.user) : null,
      updateMany: async ({where,data}) => { if(failUser) throw new Error('simulated storage failure'); if(!matches(state.user,where)) return {count:0}; Object.assign(state.user,data); return {count:1}; },
    },
    authEmailToken: {
      findUnique: async ({where}) => structuredClone(state.tokens.find(t => matches(t,where)) ?? null),
      findFirst: async ({where,orderBy}) => { const rows = state.tokens.filter(t=>matches(t,where)); const key = Object.keys(orderBy)[0]; rows.sort((a,b)=>b[key]-a[key]); return structuredClone(rows[0] ?? null); },
      updateMany: async ({where,data}) => { let count=0; for(const t of state.tokens) if(matches(t,where)) { for(const [key,v] of Object.entries(data)) t[key] = v && typeof v === 'object' && 'increment' in v ? t[key]+v.increment : v; count++; } return {count}; },
      create: async ({data}) => { const row={...data,id:`token-${state.tokens.length+1}`,createdAt:new Date(),consumedAt:null}; state.tokens.push(row); return row; },
    },
    session: {deleteMany: async ({where}) => { state.sessions=state.sessions.filter(s=>!matches(s,where)); }},
    channelSessionBridge: {updateMany: async ({where,data}) => { for(const b of state.bridges) if(matches(b,where)) Object.assign(b,data); }},
  };
  const prisma = { $transaction: async (fn, opts) => {
    assert.equal(opts.isolationLevel,'Serializable'); calls++;
    if(failures-- > 0) throw Object.assign(new Error('serialization failure'),{code:'P2034'});
    const previous=chain; let release; chain=new Promise(r=>release=r); await previous;
    const before=structuredClone(state);
    try { return await fn(tx); } catch(e) { state=before; throw e; } finally { release(); }
  }};
  const api=load('auth-email', { '@/lib/server/auth-email-security':load('auth-email-security', {}, securityEnvironment), '@/lib/server/prisma':{getPrismaClient:()=>prisma}, '@/lib/server/mailer':{sendTransactionalMail: async mail=>{mailed=mail;}} });
  return { api, raw, email, read:()=>state, calls:()=>calls, failUser:()=>{failUser=true;}, onLock: fn=>{lockHook=fn;}, mail:()=>mailed };
}
test('HMAC is context-bound and needs explicit configured server pepper',()=>{
  const context={userId:'u',email:'e',purpose:'VERIFY_EMAIL',tokenHash:'t'};
  assert.notEqual(security.hashEmailCode('123456',context),security.hashEmailCode('123456',{...context,userId:'v'}));
  assert.equal(security.matchesEmailCode('123456',security.hashEmailCode('123456',context)),false);
  assert.throws(()=>load('auth-email-security',{},{}).hashEmailCode('123456',context),/AUTH_EMAIL_CODE_SECRET/);
});
test('configured public origin rejects request-derived URL, unsafe path, credentials and production HTTP',()=>{
  for(const origin of ['https://host.invalid/path','https://name:pass@host.invalid','https://host.invalid/?q=x','http://host.invalid','javascript:alert(1)']) assert.throws(()=>load('auth-email-security',{}, {...env,AUTH_PUBLIC_ORIGIN:origin}).getAuthPublicOrigin());
  assert.throws(()=>load('auth-email-security',{}, {...env,NODE_ENV:'production',AUTH_PUBLIC_ORIGIN:'http://localhost'}).getAuthPublicOrigin());
});
test('verify consumes credential and verifies ACTIVE self-account exactly once',async()=>{
  const h=harness(); const result=await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',token:h.raw,email:h.email}); assert.equal(result.userId,'user-1'); assert.ok(h.read().user.emailVerified); assert.ok(h.read().tokens[0].consumedAt);
  assert.equal(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',token:h.raw}),null);
});
test('concurrent duplicate completions produce one success under serialized mock transaction',async()=>{
  const h=harness(); const results=await Promise.all([1,2].map(()=>h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',token:h.raw}))); assert.equal(results.filter(Boolean).length,1);
});
for(const reason of ['expired','purpose','email','changed-email','suspended','pending','already-verified']) test(`reject ${reason} without consuming`,async()=>{
  const h=harness(); const options={purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',token:h.raw};
  if(reason==='expired') h.read().tokens[0].expiresAt=new Date(0);
  if(reason==='purpose') options.purpose='RESET_PASSWORD',options.passwordHash='new';
  if(reason==='email') options.email='other@example.invalid';
  if(reason==='changed-email') h.read().user.email='changed@example.invalid';
  if(reason==='suspended') h.read().user.status='SUSPENDED';
  if(reason==='pending') h.read().user.status='PENDING';
  if(reason==='already-verified') h.read().user.emailVerified=new Date();
  assert.equal(await h.api.completeAuthEmailAction(options),null); assert.equal(h.read().tokens[0].consumedAt,null);
});
test('status rechecked after lock and no suspended account activation',async()=>{
  const h=harness(); h.onLock(state=>{state.user.status='SUSPENDED';}); assert.equal(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',token:h.raw}),null); assert.equal(h.read().tokens[0].consumedAt,null);
});
test('wrong codes atomically increment to five and block correct code and token',async()=>{
  const h=harness(); await Promise.all(Array.from({length:8},()=>h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',email:h.email,code:'000000'})));
  assert.equal(h.read().tokens[0].attempts,5); assert.equal(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',email:h.email,code:'123456'}),null); assert.equal(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',token:h.raw}),null);
});
test('wrong email code attempt cannot increment another account budget',async()=>{
  const h=harness(); assert.equal(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',email:'unknown@example.invalid',code:'000000'}),null); assert.equal(h.read().tokens[0].attempts,0);
});
test('correct HMAC code completes action; plaintext legacy code never accepted',async()=>{
  const h=harness(); assert.ok(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',email:h.email,code:'123456'}));
  const legacy=harness(); legacy.read().tokens[0].codeHash='123456'; assert.equal(await legacy.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',email:legacy.email,code:'123456'}),null);
});
test('reset mutates password and revokes sessions, bridge and all sibling tokens atomically',async()=>{
  const h=harness({purpose:'RESET_PASSWORD',verified:true}); h.read().tokens.push({...h.read().tokens[0],id:'sibling',tokenHash:'sibling',purpose:'VERIFY_EMAIL'});
  assert.ok(await h.api.completeAuthEmailAction({purpose:'RESET_PASSWORD',email:h.email,token:h.raw,passwordHash:'new-hash'}));
  assert.equal(h.read().user.password,'new-hash'); assert.equal(h.read().user.resetToken,null); assert.equal(h.read().sessions.length,0); assert.ok(h.read().bridges[0].consumedAt); assert.ok(h.read().tokens.every(t=>t.consumedAt));
});
test('failed user mutation rolls back token consumption and session revocation',async()=>{
  const h=harness({purpose:'RESET_PASSWORD',verified:true}); h.failUser(); await assert.rejects(()=>h.api.completeAuthEmailAction({purpose:'RESET_PASSWORD',token:h.raw,passwordHash:'new'}));
  assert.equal(h.read().tokens[0].consumedAt,null); assert.equal(h.read().user.password,'old-hash'); assert.equal(h.read().sessions.length,1);
});
test('serialization conflicts retry whole transaction, bounded to three attempts',async()=>{
  const h=harness({failures:2}); assert.ok(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',token:h.raw})); assert.equal(h.calls(),3);
  const failing=harness({failures:3}); await assert.rejects(()=>failing.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',token:failing.raw})); assert.equal(failing.calls(),3);
});
test('resend persists HMAC only, invalidates old token and carries account attempt budget',async()=>{
  const h=harness(); h.read().tokens[0].attempts=4;
  const result=await h.api.createEmailToken({userId:'user-1',email:h.email,purpose:'VERIFY_EMAIL'});
  assert.match(result.code,/^\d{6}$/); const row=h.read().tokens.at(-1); assert.equal(row.attempts,4); assert.equal(row.code,undefined); assert.notEqual(row.codeHash,result.code); assert.ok(h.read().tokens[0].consumedAt);
});
test('exhausted budget prevents resend; reset never claims pending accounts',async()=>{
  const h=harness(); h.read().tokens[0].attempts=5; await assert.rejects(()=>h.api.createEmailToken({userId:'user-1',email:h.email,purpose:'VERIFY_EMAIL'}));
  const p=harness({purpose:'RESET_PASSWORD',status:'PENDING'}); assert.equal(await p.api.completeAuthEmailAction({purpose:'RESET_PASSWORD',token:p.raw,passwordHash:'new'}),null);
});
test('email link uses trusted configured origin even if hostile origin supplied',async()=>{
  const h=harness(); await h.api.sendVerificationEmail({locale:'en',email:h.email,token:h.raw,code:'123456',origin:'https://attacker.invalid'});
  assert.ok(h.mail().text.includes('https://passport.example.invalid/en/auth/verify-email')); assert.ok(!h.mail().text.includes('attacker'));
});

test('secret rotation invalidates old codes, leaves high-entropy link valid, and preserves attempt accounting', async()=>{
  const securityEnvironment={...env}; const h=harness({securityEnvironment});
  securityEnvironment.AUTH_EMAIL_CODE_SECRET='rotated-test-only-pepper-00000000000000000000';
  assert.equal(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',email:h.email,code:'123456'}),null);
  assert.equal(h.read().tokens[0].attempts,1);
  assert.ok(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',token:h.raw}));
});
test('missing code secret fails closed without changing token or guessing budget',async()=>{
  const securityEnvironment={...env}; const h=harness({securityEnvironment}); delete securityEnvironment.AUTH_EMAIL_CODE_SECRET;
  await assert.rejects(()=>h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',passwordHash:'mailbox-owner-new-hash',email:h.email,code:'123456'}),/AUTH_EMAIL_CODE_SECRET/);
  assert.equal(h.read().tokens[0].attempts,0); assert.equal(h.read().tokens[0].consumedAt,null);
  await assert.rejects(()=>h.api.createEmailToken({userId:'user-1',email:h.email,purpose:'VERIFY_EMAIL'}),/AUTH_EMAIL_CODE_SECRET/);
  assert.equal(h.read().tokens.length,1);
});

test('verification replaces untrusted preregistration password and revokes old sessions/bridges',async()=>{
  const h=harness();h.read().user.password='attacker-preregistered-hash';
  assert.equal(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',token:h.raw}),null);
  assert.equal(h.read().user.emailVerified,null);
  assert.ok(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',token:h.raw,passwordHash:'owner-chosen-hash'}));
  assert.equal(h.read().user.password,'owner-chosen-hash');assert.equal(h.read().sessions.length,0);
  assert.ok(h.read().bridges.every(b=>b.consumedAt));
});
test('verification password update failure rolls back email verification and token consumption',async()=>{
  const h=harness();h.failUser();await assert.rejects(()=>h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',token:h.raw,passwordHash:'owner-chosen-hash'}));
  assert.equal(h.read().tokens[0].consumedAt,null);assert.equal(h.read().user.emailVerified,null);assert.equal(h.read().user.password,'old-hash');
});

test('explicit credential version rotation rejects both old code and link without spending attempts',async()=>{
  const securityEnvironment={...env};const h=harness({securityEnvironment});
  securityEnvironment.AUTH_EMAIL_CREDENTIAL_VERSION='test-v2';
  securityEnvironment.AUTH_EMAIL_CODE_SECRET='rotated-test-only-pepper-00000000000000000000';
  assert.equal(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',email:h.email,code:'123456',passwordHash:'new'}),null);
  assert.equal(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',token:h.raw,passwordHash:'new'}),null);
  assert.equal(h.read().tokens[0].attempts,0);assert.equal(h.read().tokens[0].consumedAt,null);
  h.read().tokens[0].attempts=5; // A deliberately revoked epoch cannot lock out the new epoch.
  const fresh=await h.api.createEmailToken({purpose:'VERIFY_EMAIL',email:h.email,userId:'user-1'});
  assert.equal(h.read().tokens.at(-1).credentialVersion,'test-v2');
  assert.ok(await h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',token:fresh.token,passwordHash:'new'}));
});
test('missing or legacy revocation version fails closed',async()=>{
  for(const version of [undefined,'legacy','bad version']){
    const securityEnvironment={...env,AUTH_EMAIL_CREDENTIAL_VERSION:version};const h=harness({securityEnvironment});
    await assert.rejects(()=>h.api.completeAuthEmailAction({purpose:'VERIFY_EMAIL',token:h.raw,passwordHash:'new'}),/AUTH_EMAIL_CREDENTIAL_VERSION/);
    assert.equal(h.read().tokens[0].consumedAt,null);
  }
});
