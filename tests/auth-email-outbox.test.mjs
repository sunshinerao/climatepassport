import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const source = fs.readFileSync('apps/passport-web/lib/server/auth-mail-outbox.ts','utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function matches(row,where) { return Object.entries(where).every(([key,value])=> {
  if(value && typeof value==='object' && !(value instanceof Date)) return Object.entries(value).every(([op,v])=>op==='lte'? row[key]<=v :op==='lt'?row[key]<v:op==='gt'?row[key]>v:op==='gte'?row[key]>=v:false);
  return row[key]===value;
}); }
function harness({user=null,sendError=null,credentialError=null,env={},readiness=()=>({ready:true})}={}) {
 const policy={};vm.runInNewContext(ts.transpileModule(fs.readFileSync("apps/passport-web/lib/server/mail-recipient-policy.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:policy,process:{env}});
 let batchHeld=false;let jobs=[],users=user?[{...user}]:[],sent=0,lookup=0,issued=0,revoked=0,version='test-epoch',lost=false,credentialState=null;
 const apply=(row,data)=>{for(const[k,v]of Object.entries(data))row[k]=v&&typeof v==='object'&&'increment'in v?row[k]+v.increment:v;};
 const prisma={authMailOutbox:{
  upsert:async({where,create})=>{let j=jobs.find(j=>j.dedupeKey===where.dedupeKey);if(!j){j={id:`job-${jobs.length}`,status:'PENDING',attempts:0,nextAttemptAt:new Date(),createdAt:new Date(),leaseId:null,deliveryStartedAt:null,...structuredClone(create)};jobs.push(j);}return{id:j.id};},
  findFirst:async({where})=>structuredClone(jobs.find(j=>matches(j,where))??null),
  updateMany:async({where,data})=>{let count=0;if(lost&&data.deliveryStartedAt){for(const j of jobs) j.status='UNKNOWN';return{count:0};}for(const j of jobs)if(matches(j,where)){apply(j,data);count++;}return{count};},
 },user:{findUnique:async({where})=>{lookup++;return users.find(u=>u.email===where.email)??null;},create:async({data})=>{const u={id:'new-user',...data};users.push(u);return u;}},authEmailToken:{findUnique:async()=>credentialState ?? {id:"credential-1",consumedAt:null,expiresAt:new Date(Date.now()+60000),credentialVersion:version},updateMany:async()=>{revoked++;return{count:1};}}};
 const exports={};const dependencies={
  './mail-recipient-policy':policy,
  '@/lib/server/prisma':{getPrismaClient:()=>prisma},
  '@/lib/server/auth-email-security':{getAuthCredentialVersion:()=>version},
  '@/lib/server/auth':{generateClimatePassportId:async()=> 'SYNTHET-1CDEMO'},
  '@/lib/server/auth-email':{
   createEmailToken:async()=>{issued++;if(credentialError)throw credentialError;return{credentialId:'credential-1',token:'fake-token',code:'123456',expiresAt:new Date(Date.now()+60000)};},
   sendVerificationEmail:async()=>{sent++;if(sendError)throw sendError;},sendResetPasswordEmail:async()=>{sent++;if(sendError)throw sendError;},
  }};
 vm.runInNewContext(compiled,{exports,require:n=>dependencies[n]??require(n),Date,process:{env},__cpDevelopmentAuthMail:{readiness,acquireBatch(){if(batchHeld)return null;batchHeld=true;return()=>{batchHeld=false}}}});
 return{api:exports,jobs:()=>jobs,users:()=>users,stats:()=>({sent,lookup,issued,revoked}),rotate:()=>{version='new-epoch';},lose:()=>{lost=true;},setCredential:value=>{credentialState=value;}};
}
const request={kind:'REGISTER',email:'Person@Example.invalid',locale:'en',profile:{name:'Synthetic Person',organizationName:'Synthetic Org'}};
const active={id:'existing',email:'person@example.invalid',status:'ACTIVE',emailVerified:new Date(),password:'existing-hash'};
test('public enqueue touches only durable queue, stores no password and deduplicates normalized address',async()=>{
 const h=harness();await h.api.enqueueAuthMailRequest(request);await h.api.enqueueAuthMailRequest({...request,email:request.email.toLowerCase()});
 assert.equal(h.jobs().length,1);assert.equal(h.stats().lookup,0);assert.equal(h.stats().issued,0);assert.equal(h.stats().sent,0);assert.equal(h.jobs()[0].payload.password,undefined);
});
test('reject password and arbitrary payload keys rather than persist them',async()=>{
 const h=harness();for(const value of [{...request,password:'secret'},{...request,profile:{...request.profile,passwordHash:'secret'}},{...request,profile:{...request.profile,nested:{password:'secret'}}}])await assert.rejects(()=>h.api.enqueueAuthMailRequest(value));assert.equal(h.jobs().length,0);
});
test('worker creates unusable password placeholder and delivers only after durable claim',async()=>{
 const h=harness();await h.api.enqueueAuthMailRequest(request);assert.equal(h.users().length,0);await h.api.processAuthMailBatch();
 assert.equal(h.users()[0].password,'');assert.equal(h.users()[0].emailVerified,null);assert.equal(h.users()[0].status,'ACTIVE');assert.equal(h.jobs()[0].status,'SENT');assert.equal(h.jobs()[0].credentialId,'credential-1');assert.equal(h.stats().sent,1);
});
test('account states enqueue identically; worker skips absent reset and suspended/verified register',async()=>{
 for(const [kind,user]of [['RESET',null],['REGISTER',active],['VERIFY',{...active,status:'SUSPENDED'}],['REGISTER',{...active,status:'PENDING'}]]){
  const h=harness({user});await h.api.enqueueAuthMailRequest({...request,kind,...(kind==='REGISTER'?{}:{profile:undefined})});assert.equal(h.stats().lookup,0);await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,'SKIPPED');assert.equal(h.stats().sent,0);
 }
});
test('reset dispatches only verified active account and never changes password',async()=>{
 const h=harness({user:active});await h.api.enqueueAuthMailRequest({kind:'RESET',email:active.email,locale:'en'});await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,'SENT');assert.equal(h.users()[0].password,'existing-hash');
});
test('concurrent workers claim once under atomic status CAS',async()=>{
 const h=harness();await h.api.enqueueAuthMailRequest(request);await Promise.all([h.api.processAuthMailBatch(),h.api.processAuthMailBatch()]);assert.equal(h.stats().sent,1);
});
test('expired processing lease becomes UNKNOWN and is never resent',async()=>{
 const h=harness();await h.api.enqueueAuthMailRequest(request);Object.assign(h.jobs()[0],{status:'PROCESSING',leaseExpiresAt:new Date(0)});await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,'UNKNOWN');assert.equal(h.stats().sent,0);
});
test('lost lease at final fence does not send and revokes freshly minted credential',async()=>{
 const h=harness();await h.api.enqueueAuthMailRequest(request);h.lose();await h.api.processAuthMailBatch();assert.equal(h.stats().sent,0);assert.equal(h.stats().revoked,1);
});
for(const outcome of ['unknown','rejected'])test(`${outcome} transport outcome never automatically retries`,async()=>{
 const h=harness({sendError:Object.assign(new Error('unsafe provider details'),{outcome})});await h.api.enqueueAuthMailRequest(request);await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,outcome==='unknown'?'UNKNOWN':'FAILED');assert.equal(h.stats().revoked,1);await h.api.processAuthMailBatch();assert.equal(h.stats().sent,1);assert.ok(!JSON.stringify(h.jobs()).includes('unsafe provider'));
});
test('known pre-send failure retry bounded at three attempts',async()=>{
 const h=harness({credentialError:new Error('configuration not ready')});await h.api.enqueueAuthMailRequest(request);
 for(let n=0;n<3;n++){h.jobs()[0].nextAttemptAt=new Date(0);await h.api.processAuthMailBatch();}assert.equal(h.jobs()[0].status,'FAILED');assert.equal(h.jobs()[0].attempts,3);assert.equal(h.stats().sent,0);
});
test('mailer confirmed not-attempted outcome may retry but never unbounded',async()=>{
 const h=harness({sendError:Object.assign(new Error('config'),{outcome:'not-attempted'})});await h.api.enqueueAuthMailRequest(request);await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,'PENDING');assert.equal(h.jobs()[0].deliveryStartedAt,null);assert.equal(h.stats().revoked,1);
});
test('credential rotation skips queued work before account lookup or sending',async()=>{
 const h=harness();await h.api.enqueueAuthMailRequest(request);h.rotate();await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,'SKIPPED');assert.equal(h.stats().lookup,0);assert.equal(h.stats().sent,0);
});
test('batch limits validated',async()=>{const h=harness();for(const n of [0,21,1.5])await assert.rejects(()=>h.api.processAuthMailBatch(n));});
test('actual registration optional undefined fields are omitted from durable JSON',async()=>{
 const h=harness();await h.api.enqueueAuthMailRequest({...request,profile:{name:'Synthetic Person',phone:'000',country:'Synthetic',organizationName:'Synthetic Org',salutation:undefined,title:undefined}});
 assert.equal(h.jobs().length,1);assert.equal(Object.hasOwn(h.jobs()[0].payload.profile,'salutation'),false);assert.equal(Object.hasOwn(h.jobs()[0].payload.profile,'title'),false);
});
test('new credential epoch gets fresh same-window job while old job is skipped',async()=>{
 const h=harness();await h.api.enqueueAuthMailRequest(request);h.rotate();await h.api.enqueueAuthMailRequest(request);assert.equal(h.jobs().length,2);await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,'SKIPPED');assert.equal(h.jobs()[1].status,'SENT');assert.equal(h.stats().sent,1);
});
test('old queued request expires without account lookup or newly issued mail',async()=>{
 const h=harness();await h.api.enqueueAuthMailRequest(request);h.jobs()[0].createdAt=new Date(Date.now()-31*60000);await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,'SKIPPED');assert.equal(h.jobs()[0].failureCode,'REQUEST_EXPIRED');assert.equal(h.stats().lookup,0);assert.equal(h.stats().issued,0);assert.equal(h.stats().sent,0);
});
for(const invalid of ['consumed','expired','version'])test(`recheck ${invalid} credential after awaited fence prevents transport`,async()=>{
 const h=harness();await h.api.enqueueAuthMailRequest(request);h.setCredential({id:'credential-1',consumedAt:invalid==='consumed'?new Date():null,expiresAt:invalid==='expired'?new Date(0):new Date(Date.now()+60000),credentialVersion:invalid==='version'?'old-epoch':'test-epoch'});await h.api.processAuthMailBatch();assert.equal(h.stats().sent,0);assert.equal(h.stats().revoked,1);assert.equal(h.jobs()[0].status,'SKIPPED');
});

test('recipient policy prevents unauthorized durable queue creation and skips old jobs without issuance or send',async()=>{
 const env={MAIL_RECIPIENT_ALLOWLIST:'sunshine.rao@gmail.com',CP_DEV_GMAIL_ONLY:'1',CP_DEV_MAIL_RUN_STARTED_AT:new Date(Date.now()-1000).toISOString(),CP_DEV_MAIL_RUN_ID:'synthetic-run-id-0001'};const h=harness({env});
 await assert.rejects(()=>h.api.enqueueAuthMailRequest(request),/AUTH_OUTBOX_RECIPIENT_NOT_ALLOWED/);assert.equal(h.jobs().length,0);assert.deepEqual(h.stats(),{sent:0,lookup:0,issued:0,revoked:0});
 const admitted={...request,email:'sunshine.rao@gmail.com'};await h.api.enqueueAuthMailRequest(admitted);assert.equal(h.jobs().length,1);h.jobs()[0].email='other@example.invalid';await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,'SKIPPED');assert.equal(h.jobs()[0].failureCode,'RECIPIENT_NOT_ALLOWED');assert.deepEqual(h.stats(),{sent:0,lookup:0,issued:0,revoked:0});
 const missing=harness({env:{CP_DEV_GMAIL_ONLY:'1'}});await assert.rejects(()=>missing.api.enqueueAuthMailRequest(admitted));assert.equal(missing.jobs().length,0);
});

test('automatic development run excludes historical pending and expired processing, while fresh duplicate requests dedupe',async()=>{
 const env={CP_DEV_GMAIL_ONLY:'1',MAIL_RECIPIENT_ALLOWLIST:'sunshine.rao@gmail.com',CP_DEV_MAIL_RUN_STARTED_AT:new Date(Date.now()-1000).toISOString(),CP_DEV_MAIL_RUN_ID:'synthetic-run-id-0001'};const h=harness({env});const input={...request,email:'sunshine.rao@gmail.com'};
 await h.api.enqueueAuthMailRequest(input);h.jobs()[0].createdAt=new Date(0);await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,'PENDING');assert.equal(h.stats().sent,0);
 h.jobs()[0].status='PROCESSING';h.jobs()[0].leaseExpiresAt=new Date(0);await h.api.processAuthMailBatch();assert.equal(h.jobs()[0].status,'PROCESSING');
 env.CP_DEV_MAIL_RUN_ID='synthetic-run-id-0002';await h.api.enqueueAuthMailRequest(input);await h.api.enqueueAuthMailRequest(input);assert.equal(h.jobs().length,2);await h.api.processAuthMailBatch(1);assert.equal(h.jobs()[1].status,'SENT');assert.equal(h.stats().sent,1);assert.equal(h.jobs()[0].status,'PROCESSING');
});

const developmentEnv=()=>({CP_DEV_GMAIL_ONLY:'1',MAIL_RECIPIENT_ALLOWLIST:'sunshine.rao@gmail.com',CP_DEV_MAIL_RUN_STARTED_AT:new Date(Date.now()-1000).toISOString(),CP_DEV_MAIL_RUN_ID:'synthetic-window-run-20261001'});
test('rolling wait leaves job and existing challenges untouched before claim',async()=>{
 const h=harness({env:developmentEnv(),readiness:()=>({ready:false,retryAt:Date.now()+86400000})});await h.api.enqueueAuthMailRequest({...request,email:'sunshine.rao@gmail.com'});const before=structuredClone(h.jobs());await h.api.processAuthMailBatch();assert.deepEqual(h.jobs(),before);assert.deepEqual(h.stats(),{sent:0,lookup:0,issued:0,revoked:0});
});
test('window becoming unavailable after claim defers without credential issuance/revocation or attempt penalty',async()=>{
 let reads=0;const retryAt=Date.now()+60000;const h=harness({env:developmentEnv(),readiness:()=>++reads===1?{ready:true}:{ready:false,retryAt}});await h.api.enqueueAuthMailRequest({...request,email:'sunshine.rao@gmail.com'});await h.api.processAuthMailBatch(1);assert.equal(h.jobs()[0].status,'PENDING');assert.equal(h.jobs()[0].attempts,0);assert.equal(h.jobs()[0].nextAttemptAt.getTime(),retryAt);assert.deepEqual(h.stats(),{sent:0,lookup:0,issued:0,revoked:0});
});

test('parallel authorized development workers serialize issuance through transport, preserving the single valid challenge',async()=>{
 const h=harness({env:developmentEnv()});await h.api.enqueueAuthMailRequest({...request,email:'sunshine.rao@gmail.com'});await Promise.all([h.api.processAuthMailBatch(1),h.api.processAuthMailBatch(1)]);assert.equal(h.stats().issued,1);assert.equal(h.stats().sent,1);assert.equal(h.stats().revoked,0);assert.equal(h.jobs()[0].status,'SENT');
});
