import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
import {validateDevelopmentMailEnvironment as validate,acquireDevelopmentConsumerOwnership} from '../scripts/start-dev-gmail-only.mjs';
const require=createRequire(import.meta.url);const {createMailFetchGuard}=require('../scripts/dev-gmail-network-guard.cjs');
const env={CP_DEV_GMAIL_ONLY:'1',MAIL_RECIPIENT_ALLOWLIST:'sunshine.rao@gmail.com',MAIL_PROVIDER:'zoho',MAIL_FROM:'no-reply@climatepassport.org',ZOHO_MAIL_ENDPOINT:'https://cpaas.zoho.com/v1.1/email',ZOHO_MAIL_TOKEN:'synthetic-token',AUTH_EMAIL_CODE_SECRET:'x'.repeat(32),AUTH_MAIL_WORKER_SECRET:'y'.repeat(32),AUTH_EMAIL_CREDENTIAL_VERSION:'synthetic-version',AUTH_PUBLIC_ORIGIN:'http://127.0.0.1:3000',DATABASE_URL:'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic',DIRECT_URL:'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic'};
const body={from:{address:env.MAIL_FROM},to:[{email_address:{address:'sunshine.rao@gmail.com'}}],subject:'Synthetic',htmlbody:'Synthetic',textbody:'Synthetic',track_opens:false,track_clicks:false};
const init=b=>({method:'POST',redirect:'error',body:JSON.stringify(b)});
test('launcher fails closed for missing allowlist/provider/sender/endpoint/secret and mismatched development target',()=>{
 assert.equal(validate(env,3000),true);
 for(const key of Object.keys(env)){const copy={...env};delete copy[key];assert.throws(()=>validate(copy,3000),undefined,key)}
 for(const change of [{MAIL_RECIPIENT_ALLOWLIST:'other@example.invalid'},{MAIL_PROVIDER:'resend'},{MAIL_FROM:'other@example.invalid'},{ZOHO_MAIL_ENDPOINT:'https://cpaas.zoho.com/not-email'},{DIRECT_URL:'postgresql://synthetic:synthetic@127.0.0.1:1/other'},{AUTH_PUBLIC_ORIGIN:'https://example.invalid'},{NODE_ENV:'production'},{AUTH_EMAIL_CREDENTIAL_VERSION:'legacy'},{MAIL_TRANSPORT:'test-outbox'}])assert.throws(()=>validate({...env,...change},3000));
});
test('runtime fetch guard rejects other recipients and endpoints before any fetch or budget write',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-guard-test-'));const ledger=path.join(dir,'ledger');let calls=0;try{
 const fetch=createMailFetchGuard(async()=>{calls++;return {ok:true}},{env:{...env},ledgerPath:ledger,maxSendsPer24h:2,minimumIntervalMs:0});
 for(const bad of [{...body,to:[{email_address:{address:'other@example.invalid'}}]},{...body,to:[body.to[0],body.to[0]]},{...body,cc:'other@example.invalid'},{...body,from:{address:'other@example.invalid'}},{...body,track_opens:true}])await assert.rejects(()=>fetch(env.ZOHO_MAIL_ENDPOINT,init(bad)),/DEV_MAIL_GUARD_BLOCKED/);
 for(const url of ['https://api.resend.com/emails','https://cpaas.zoho.com/v1.1/email?x=1','https://other.example.invalid/'])await assert.rejects(()=>fetch(url,init(body)),/DEV_MAIL_GUARD_BLOCKED/);
 assert.equal(calls,0);assert.equal(fs.existsSync(ledger),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('accepted reservations survive restart and enforce the same rolling quota',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-guard-test-'));const ledger=path.join(dir,'ledger');let calls=0;
 try{const fetch=createMailFetchGuard(async()=>{calls++;return {ok:true}},{env:{...env},ledgerPath:ledger,maxSendsPer24h:2,minimumIntervalMs:0});await fetch(env.ZOHO_MAIL_ENDPOINT,init(body));
 const restarted=createMailFetchGuard(async()=>{calls++;return {ok:true}},{env:{...env},ledgerPath:ledger,maxSendsPer24h:2,minimumIntervalMs:0});await restarted(env.ZOHO_MAIL_ENDPOINT,init(body));await assert.rejects(()=>restarted(env.ZOHO_MAIL_ENDPOINT,init(body)),/BUDGET_EXHAUSTED/);assert.equal(calls,2);assert.equal(fs.statSync(ledger).mode&0o777,0o600);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('runtime guard serializes requests and enforces low frequency without extra fetches',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-guard-test-'));const ledger=path.join(dir,'ledger');let calls=0,release;
 try{const fetch=createMailFetchGuard(async()=>{calls++;await new Promise(resolve=>{release=resolve});return {ok:true}},{env:{...env},ledgerPath:ledger});
 const first=fetch(env.ZOHO_MAIL_ENDPOINT,init(body));await assert.rejects(()=>fetch(env.ZOHO_MAIL_ENDPOINT,init(body)),/GUARD_BUSY/);assert.equal(calls,1);release();await first;
 await assert.rejects(()=>fetch(env.ZOHO_MAIL_ENDPOINT,init(body)),/LOW_FREQUENCY_REQUIRED/);assert.equal(calls,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('malformed ledger timestamps fail closed at both preflight and final transport fence',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-guard-test-'));const ledger=path.join(dir,'ledger');let calls=0;
 try{const {readSendWindow}=require('../scripts/dev-gmail-network-guard.cjs');
 const fetch=createMailFetchGuard(async()=>{calls++;return {ok:true}},{env:{...env},ledgerPath:ledger});
 for(const invalid of ['{"reserved":true,"at":"invalid"}\n','{invalid}\n','{"reserved":false,"at":"2026-01-01T00:00:00Z"}\n']){fs.writeFileSync(ledger,invalid);assert.equal(readSendWindow(ledger).ready,false);await assert.rejects(()=>fetch(env.ZOHO_MAIL_ENDPOINT,init(body)),/LEDGER_INVALID/);assert.equal(fs.readFileSync(ledger,'utf8'),invalid);assert.equal(fs.existsSync(ledger+'.lock'),false)}
 assert.equal(calls,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('launcher ownership is exclusive and old crash locks require review',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-owner-test-'));const ledger=path.join(dir,'ledger');
 try{const release=acquireDevelopmentConsumerOwnership(ledger,'synthetic-first');assert.throws(()=>acquireDevelopmentConsumerOwnership(ledger,'synthetic-second'),/OWNERSHIP_REQUIRES_REVIEW/);release();release();const next=acquireDevelopmentConsumerOwnership(ledger,'synthetic-next');next();fs.writeFileSync(ledger+'.consumer.lock','synthetic stale lock');assert.throws(()=>acquireDevelopmentConsumerOwnership(ledger,'synthetic-next'),/OWNERSHIP_REQUIRES_REVIEW/);assert.equal(fs.readFileSync(ledger+'.consumer.lock','utf8'),'synthetic stale lock')}finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('rolling 24h boundary releases capacity without deleting history, including uncertain reservations',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-rolling-'));const ledger=path.join(dir,'ledger');let calls=0;const {readSendWindow}=require('../scripts/dev-gmail-network-guard.cjs');
 let now=Date.parse('2026-10-02T12:00:00Z');const window=86400000;
 try{assert.equal(validate({...env,CP_DEV_MAIL_MAX_SENDS_PER_24H:'10',CP_DEV_MAIL_MAX_SENDS:'6'},3000),true);assert.throws(()=>validate({...env,CP_DEV_MAIL_MAX_SENDS_PER_24H:'11'},3000),/BUDGET_INVALID/);
 const original=Array.from({length:10},(_,n)=>JSON.stringify({reserved:true,at:new Date(now-window+1+n*60000).toISOString(),...(n===0?{outcome:'UNKNOWN'}:{})})+'\n').join('');fs.writeFileSync(ledger,original);
 let gate=readSendWindow(ledger,10,now);assert.equal(gate.ready,false);assert.equal(gate.reason,'WAITING_FOR_ROLLING_SEND_WINDOW');assert.equal(gate.retryAt,now+1);
 const fetch=createMailFetchGuard(async()=>{calls++;return {ok:true}},{env:{...env},ledgerPath:ledger,clock:()=>now});await assert.rejects(()=>fetch(env.ZOHO_MAIL_ENDPOINT,init(body)),/BUDGET_EXHAUSTED/);assert.equal(calls,0);
 now++;assert.equal(readSendWindow(ledger,10,now).ready,true);await fetch(env.ZOHO_MAIL_ENDPOINT,init(body));assert.equal(calls,1);assert.ok(fs.readFileSync(ledger,'utf8').startsWith(original));assert.equal(fs.readFileSync(ledger,'utf8').trim().split('\n').length,11);
 assert.equal(readSendWindow(ledger,10,now).ready,false);now+=window;assert.equal(readSendWindow(ledger,10,now).ready,true);assert.ok(fs.readFileSync(ledger,'utf8').startsWith(original));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('all seven inherited reservations remain counted and allow three conservative daily slots',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-seven-'));const ledger=path.join(dir,'ledger');const {readSendWindow}=require('../scripts/dev-gmail-network-guard.cjs');const now=Date.parse('2026-10-02T12:00:00Z');
 try{const original=Array.from({length:7},(_,n)=>JSON.stringify({reserved:true,at:new Date(now-3600000-n*60000).toISOString()})+'\n').join('');fs.writeFileSync(ledger,original);const gate=readSendWindow(ledger,10,now);assert.equal(gate.ready,true);assert.equal(gate.usedIn24h,7);assert.equal(fs.readFileSync(ledger,'utf8'),original)}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('provider 429, rejection and uncertain transport persist a halt across restarts without resending',async()=>{
 for(const status of [429,401,500,'uncertain']){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-halt-'));const ledger=path.join(dir,'ledger');let calls=0;const {readSendWindow}=require('../scripts/dev-gmail-network-guard.cjs');
 try{const fetch=createMailFetchGuard(async()=>{calls++;if(status==='uncertain')throw Error('synthetic uncertainty');return {ok:false,status}},{env:{...env},ledgerPath:ledger,minimumIntervalMs:0});if(status==='uncertain')await assert.rejects(()=>fetch(env.ZOHO_MAIL_ENDPOINT,init(body)));else await fetch(env.ZOHO_MAIL_ENDPOINT,init(body));
 const before=fs.readFileSync(ledger,'utf8');assert.equal(readSendWindow(ledger).reason,'DELIVERY_REQUIRES_REVIEW');const restarted=createMailFetchGuard(async()=>{calls++;return {ok:true}},{env:{...env},ledgerPath:ledger,minimumIntervalMs:0});await assert.rejects(()=>restarted(env.ZOHO_MAIL_ENDPOINT,init(body)),/DELIVERY_REQUIRES_REVIEW/);assert.equal(calls,1);assert.equal(fs.readFileSync(ledger,'utf8'),before);assert.equal(fs.statSync(ledger+'.halt').mode&0o777,0o600);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}}
});
test('future timestamps fail closed instead of buying extra rolling capacity',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-future-'));const ledger=path.join(dir,'ledger');const now=Date.parse('2026-10-01T12:00:00Z');try{fs.writeFileSync(ledger,JSON.stringify({reserved:true,at:new Date(now+1).toISOString()})+'\n');assert.equal(require('../scripts/dev-gmail-network-guard.cjs').readSendWindow(ledger,10,now).reason,'LEDGER_REQUIRES_REVIEW')}finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('cross-process issuance lock covers challenge creation through transport and survives as a review boundary after a crash',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-issuance-'));const ledger=path.join(dir,'ledger');const {createDevelopmentHooks,readSendWindow}=require('../scripts/dev-gmail-network-guard.cjs');
 try{const first=createDevelopmentHooks(ledger),second=createDevelopmentHooks(ledger);const release=first.acquireBatch();assert.equal(typeof release,'function');assert.equal(first.readiness().ready,true);assert.equal(second.readiness().ready,false);assert.equal(second.acquireBatch(),null);release();release();assert.equal(second.readiness().ready,true);const next=second.acquireBatch();assert.equal(typeof next,'function');next();fs.writeFileSync(ledger+'.issuance.lock','synthetic stale');assert.equal(readSendWindow(ledger).ready,false);assert.equal(first.acquireBatch(),null);assert.equal(fs.readFileSync(ledger+'.issuance.lock','utf8'),'synthetic stale')}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('in-memory halt fails closed if persistent halt metadata cannot be written',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-dev-halt-memory-'));const ledger=path.join(dir,'ledger');const {createDevelopmentHooks}=require('../scripts/dev-gmail-network-guard.cjs');const hooks=createDevelopmentHooks(ledger);const originalWrite=fs.writeFileSync;
 try{fs.writeFileSync=(file,...rest)=>{if(file===ledger+'.halt')throw Object.assign(Error('synthetic disk failure'),{code:'EIO'});return originalWrite(file,...rest)};assert.throws(()=>hooks.halt(),/HALT_PERSIST_FAILED/);assert.equal(hooks.readiness().ready,false);assert.equal(hooks.readiness().stopped,true)}finally{fs.writeFileSync=originalWrite;fs.rmSync(dir,{recursive:true,force:true})}
});
