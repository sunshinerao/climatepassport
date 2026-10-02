import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const normalize=value=>value.trim().toLowerCase();
const clean=value=>JSON.parse(JSON.stringify(value));
function harness(route,{user=null,providerFailure=false,tokenFailure=false,completeResult={userId:'user-1',email:'person@example.test',role:'ATTENDEE'},durableAllowed=true,durableFailure=false,sessionFailure=false,passwordMatches=true,createFailure=false,sharedRegistration=null,enqueueFailure=false,enqueueWait=null}={}) {
 const calls={created:[],updated:[],sent:[],tokens:[],completed:[],sessions:[],quotas:[],logs:[],hashes:[],passwordChecks:[],enqueued:[],lookups:[]};
 const prisma={user:{findUnique:async()=>{calls.lookups.push(true);return sharedRegistration?.current??user;},create:async input=>{calls.created.push(clean(input));if(sharedRegistration){if(sharedRegistration.current)throw Object.assign(Error('unique constraint'),{code:'P2002'});sharedRegistration.current={id:'new-user',...clean(input.data)};}if(createFailure)throw Error('private DB detail');return {id:'new-user'};},update:async input=>{calls.updated.push(clean(input));throw Error('Unexpected route update');}}};
 const mocks={
  'next/server':{NextResponse:{json:(payload,init)=>({status:init?.status??200,payload:clean(payload)})}},
  '@/lib/site-content':{locales:['en','zh']},
  '@/lib/server/prisma':{getPrismaClient:()=>prisma},
  '@/lib/redirect-path':{sanitizeLocalRedirectPath:(value,fallback)=>value?.startsWith('/')&&!value.startsWith('//')?value:fallback},
  '@/lib/server/auth':{normalizeUserEmail:normalize,generateClimatePassportId:async()=> '1234567-89ABCD',hashUserPassword:async value=>{calls.hashes.push(value);return 'hashed-password';},verifyUserPassword:async(...args)=>{calls.passwordChecks.push(args);return passwordMatches;},createUserSession:async(...args)=>{calls.sessions.push(args);if(sessionFailure)throw Error('status/password changed');},getDashboardPathForRole:locale=>`/${locale}/dashboard/climate-passport`},
  '@/lib/server/auth-email':{createEmailToken:async input=>{calls.tokens.push(clean(input));if(tokenFailure)throw Error('secret-token database error person@example.test');return {token:'synthetic-secret-token',code:'123456'};},sendVerificationEmail:async input=>send(input),sendResetPasswordEmail:async input=>send(input),completeAuthEmailAction:async input=>{calls.completed.push(clean(input));return completeResult;}},
  '@/lib/server/auth-mail-outbox':{enqueueAuthMailRequest:async input=>{calls.enqueued.push(clean(input));if(enqueueWait)await enqueueWait;if(enqueueFailure)throw Error('private queue error person@example.test secret-token');}},
  '@/lib/server/rate-limit':{checkAuthRateLimit:async(...args)=>{calls.quotas.push(clean(args));if(durableFailure)throw Error('database-secret');return {allowed:durableAllowed};},checkRateLimitAsync:async()=>({allowed:true,unavailable:false}),getRequestRateLimitKey:()=> 'synthetic-ip'},
 };
 async function send(input){calls.sent.push(clean(input));if(providerFailure)throw Error('SMTP secret-token person@example.test password=private');}
 const source=fs.readFileSync(path.resolve('apps/passport-web/app/api/auth',route,'route.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 mocks['@/lib/server/auth-rate-limit']=mocks['@/lib/server/rate-limit'];
 const sandbox={exports:{},module:{exports:{}},require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),URL,URLSearchParams,Request,Response,Date,Buffer,console:{error:(...args)=>calls.logs.push(args)},encodeURIComponent};
 sandbox.module.exports=sandbox.exports;vm.runInNewContext(compiled,sandbox);
 return {calls,post:(body,raw=false)=>sandbox.exports.POST(new Request('https://attacker-origin.example/api/auth/'+route,{method:'POST',headers:{'content-type':'application/json'},body:raw?body:JSON.stringify(body)}))};
}
const registration={locale:'en',name:'Synthetic Person',email:'Person@example.test',password:'strong-test-password',phone:'synthetic-phone',country:'Synthetic',organizationName:'Synthetic Org'};
const active={id:'u1',email:'person@example.test',status:'ACTIVE',emailVerified:new Date(),password:'stored-hash',role:'ATTENDEE'};
for(const route of ['register','forgot-password','verify-email/request']) {
 test(`${route}: missing, active, PENDING and suspended have identical public response`,async()=>{
  const responses=[],enqueued=[];
  for(const user of [null,active,{...active,status:'PENDING',emailVerified:null},{...active,status:'SUSPENDED'},{...active,status:'INACTIVE'},{...active,emailVerified:null}]) {
   const h=harness(route,{user});responses.push(await h.post(route==='register'?registration:{email:registration.email}));enqueued.push(h.calls.enqueued);assert.equal(h.calls.lookups.length,0);
  }
  for(const response of responses)assert.deepEqual(response,responses[0]);for(const queued of enqueued)assert.deepEqual(queued,enqueued[0]);assert.equal(responses[0].status,200);
 });
 test(`${route}: account-independent enqueue never calls provider, token or password code`,async()=>{
  const h=harness(route,{user:active,providerFailure:true,tokenFailure:true});const body=route==='register'?registration:{email:registration.email};
  assert.equal((await h.post(body)).status,200);assert.equal(h.calls.enqueued.length,1);assert.equal(h.calls.lookups.length,0);assert.equal(h.calls.created.length,0);assert.equal(h.calls.hashes.length,0);assert.equal(h.calls.tokens.length,0);assert.equal(h.calls.sent.length,0);assert.equal(h.calls.logs.length,0);
  assert.equal(h.calls.enqueued[0].kind,({'register':'REGISTER','forgot-password':'RESET','verify-email/request':'VERIFY'})[route]);assert.equal(h.calls.enqueued[0].email,'person@example.test');
 });
 test(`${route}: enqueue failure is 503 without false persistence acknowledgment`,async()=>{
  for(const user of [null,active,{...active,status:'SUSPENDED'}]){const h=harness(route,{user,enqueueFailure:true});const r=await h.post(route==='register'?registration:{email:registration.email});
  assert.equal(r.status,503);assert.equal(r.payload.ok,undefined);assert.equal(h.calls.logs.length,1);assert.match(h.calls.logs[0][0],/ENQUEUE_UNAVAILABLE/);assert.doesNotMatch(JSON.stringify(h.calls.logs),/person@example|secret-token|private queue/);}
 });
 test(`${route}: durable quota is normalized and shared across issuance endpoints`,async()=>{
  const h=harness(route,{durableAllowed:false});const r=await h.post(route==='register'?registration:{email:registration.email});
  assert.equal(r.status,429);assert.equal(h.calls.quotas[0][0],'person@example.test');assert.equal(h.calls.quotas[0][1],'auth-email-send');assert.equal(h.calls.sent.length,0);assert.equal(h.calls.enqueued.length,0);
 });
}
test('register cannot overwrite existing PENDING identity password, profile or role',async()=>{
 const h=harness('register',{user:{...active,status:'PENDING'}});const r=await h.post(registration);
 assert.equal(r.status,200);assert.equal(h.calls.created.length,0);assert.equal(h.calls.updated.length,0);assert.equal(h.calls.hashes.length,0);assert.equal(h.calls.tokens.length,0);
});
test('registration queue stores profile only, never password or hash',async()=>{
 const h=harness('register');await h.post({...registration,next:'/en/dashboard',passwordHash:'injected-secret'});assert.equal(h.calls.enqueued.length,1);
 const request=h.calls.enqueued[0];assert.deepEqual(Object.keys(request).sort(),['email','kind','locale','profile']);assert.deepEqual(request.profile,{name:registration.name,phone:registration.phone,country:registration.country,organizationName:registration.organizationName});
 assert.doesNotMatch(JSON.stringify(request),/password|strong-test-password|injected-secret|dashboard/);assert.equal(h.calls.hashes.length,0);assert.equal(h.calls.created.length,0);assert.equal(h.calls.sessions.length,0);
});
test('acknowledgment waits for durable enqueue completion',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});const h=harness('register',{enqueueWait:gate});let completed=false;const result=h.post(registration).then(value=>{completed=true;return value;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.enqueued.length,1);assert.equal(completed,false);release();assert.equal((await result).status,200);
});
for(const route of ['register','login','forgot-password','reset-password','verify-email/request','verify-email/confirm']) {
 test(`${route}: malformed JSON is a 400 and never runs auth mutation`,async()=>{const h=harness(route);assert.equal((await h.post('{bad',true)).status,400);assert.equal(h.calls.completed.length,0);assert.equal(h.calls.created.length,0);assert.equal(h.calls.sessions.length,0);assert.equal(h.calls.enqueued.length,0);});
 test(`${route}: failed durable limiter is fail-closed`,async()=>{
 const h=harness(route,{durableFailure:true});const body=route==='register'?registration:route==='login'?{email:registration.email,password:'pw'}:route==='reset-password'?{email:registration.email,password:'new-password',code:'123456'}:route==='verify-email/confirm'?{email:registration.email,code:'123456',password:'owner-password'}:{email:registration.email};
 assert.equal((await h.post(body)).status,503);assert.equal(h.calls.completed.length,0);assert.equal(h.calls.sent.length,0);assert.doesNotMatch(JSON.stringify(h.calls.logs),/database-secret/);
 });
}
test('reset delegates exact purpose/email/password hash atomically, not raw password or route DB write',async()=>{
 const h=harness('reset-password');assert.equal((await h.post({email:registration.email,password:'new-password',code:'123456'})).status,200);
 assert.deepEqual(h.calls.completed,[{purpose:'RESET_PASSWORD',email:'person@example.test',code:'123456',passwordHash:'hashed-password'}]);assert.equal(h.calls.updated.length,0);
});
for(const route of ['reset-password','verify-email/confirm']) {
 test(`${route}: wrong-purpose/replay/expired result uses one generic invalid credential response`,async()=>{
  const h=harness(route,{completeResult:null});const body={email:registration.email,token:'synthetic-token-long-enough',password:'new-password'};
  const r=await h.post(body);assert.equal(r.status,400);assert.match(r.payload.error,/Invalid or expired/);assert.equal(h.calls.updated.length,0);assert.equal(h.calls.sessions.length,0);
 });
 test(`${route}: ambiguous token plus code rejected before consumption`,async()=>{const h=harness(route);const r=await h.post({email:registration.email,token:'synthetic-token-long-enough',code:'123456',password:'new-password'});assert.equal(r.status,400);assert.equal(h.calls.completed.length,0);});
}
test('verification passes supplied email to atomic guard, never auto-logs in',async()=>{
 const h=harness('verify-email/confirm');const r=await h.post({email:registration.email,token:'synthetic-token-long-enough',next:'https://attacker.example',password:'owner-password'});
 assert.equal(r.status,200);assert.equal(h.calls.completed[0].purpose,'VERIFY_EMAIL');assert.equal(h.calls.completed[0].passwordHash,'hashed-password');assert.deepEqual(h.calls.hashes,['owner-password']);assert.equal(h.calls.completed[0].email,'person@example.test');assert.match(r.payload.redirectTo,/^\/en\/auth\/login\?/);assert.doesNotMatch(r.payload.redirectTo,/attacker/);assert.equal(h.calls.sessions.length,0);assert.equal(h.calls.updated.length,0);
});
test('login blocks unverified and partner PENDING users without sending email or sessions',async()=>{
 for(const user of [{...active,emailVerified:null},{...active,status:'PENDING'},{...active,status:'SUSPENDED'}]){const h=harness('login',{user});const r=await h.post({email:registration.email,password:'pw'});assert.ok([401,403].includes(r.status));assert.equal(h.calls.sessions.length,0);assert.equal(h.calls.sent.length,0);}
});
test('login passes expected password hash to guarded session creation',async()=>{const h=harness('login',{user:active});assert.equal((await h.post({email:registration.email,password:'pw'})).status,200);assert.deepEqual(h.calls.sessions,[['u1','stored-hash']]);});
test('login rejects concurrent status/password change during session creation',async()=>{const h=harness('login',{user:active,sessionFailure:true});assert.equal((await h.post({email:registration.email,password:'pw'})).status,401);});

for(const route of ['register','reset-password','login','verify-email/confirm'])test(`${route}: multibyte password above bcrypt byte limit rejected`,async()=>{const h=harness(route);const body=route==='register'?{...registration,password:'界'.repeat(25)}:{email:registration.email,password:'界'.repeat(25),code:'123456'};assert.equal((await h.post(body)).status,400);assert.equal(h.calls.hashes.length,0);assert.equal(h.calls.sessions.length,0);});

test('verification requires owner-chosen password before consuming credential',async()=>{const h=harness('verify-email/confirm');const r=await h.post({email:registration.email,token:'synthetic-token-long-enough'});assert.equal(r.status,400);assert.equal(h.calls.completed.length,0);assert.equal(h.calls.hashes.length,0);});

test('concurrent registrations enqueue equivalent profile with no password/account work',async()=>{
 const a=harness('register'),b=harness('register');const results=await Promise.all([a.post(registration),b.post({...registration,email:registration.email.toLowerCase(),password:'other-request-password'})]);
 assert.deepEqual(results[0],results[1]);assert.equal(results[0].status,200);assert.deepEqual(a.calls.enqueued,b.calls.enqueued);assert.equal(a.calls.lookups.length+b.calls.lookups.length,0);assert.equal(a.calls.created.length+b.calls.created.length,0);assert.equal(a.calls.hashes.length+b.calls.hashes.length,0);
});

test('missing and ineligible login paths still perform one password check and keep generic failure',async()=>{
 for(const user of [null,{...active,status:'SUSPENDED'},active]){
  const h=harness('login',{user,passwordMatches:false});const result=await h.post({email:registration.email,password:'incorrect'});
  assert.equal(result.status,401);assert.deepEqual(result.payload,{error:'Invalid email or password.'});
  assert.equal(h.calls.passwordChecks.length,1);assert.equal(h.calls.sessions.length,0);
 }
});
