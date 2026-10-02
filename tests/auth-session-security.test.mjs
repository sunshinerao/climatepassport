import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
function harness(){
 let state={user:{id:'u1',role:'ATTENDEE',status:'ACTIVE',emailVerified:new Date(),password:'old-hash'},sessions:[{sessionToken:'source',userId:'u1',expires:new Date(Date.now()+60000)}],bridges:[]};
 let cookie='source',writes=[],chain=Promise.resolve(),hook=null,failCreate=false,locks=0;
 const tx={
  $queryRaw:async()=>{locks++;if(hook){const fn=hook;hook=null;fn(state);}},
  user:{findUnique:async({where})=>where.id===state.user.id?structuredClone(state.user):null},
  session:{
   findUnique:async({where})=>{const s=state.sessions.find(s=>s.sessionToken===where.sessionToken);return s?structuredClone({...s,user:state.user}):null;},
   create:async({data})=>{if(failCreate)throw Error('write failed');state.sessions.push(data);return data;},
   delete:async({where})=>{state.sessions=state.sessions.filter(s=>s.sessionToken!==where.sessionToken);},
  },
  channelSessionBridge:{
   findUnique:async({where})=>{const b=state.bridges.find(b=>b.tokenHash===where.tokenHash);return b?structuredClone({...b,user:state.user}):null;},
   create:async({data})=>{const b={...data,id:`bridge-${state.bridges.length}`,consumedAt:null};state.bridges.push(b);return b;},
   updateMany:async({where,data})=>{const b=state.bridges.find(b=>b.id===where.id&&b.consumedAt===null&&b.expiresAt>where.expiresAt.gt);if(!b)return{count:0};Object.assign(b,data);return{count:1};},
  },
 };
 const prisma={...tx,$transaction:async fn=>{const prev=chain;let release;chain=new Promise(r=>release=r);await prev;const before=structuredClone(state);try{return await fn(tx);}catch(e){state=before;throw e;}finally{release();}}};
 const deps={
  '@/lib/server/prisma':{getPrismaClient:()=>prisma},
  '@/lib/server/audit':{writeCoreAuditLog:async()=>{}},
  '@climate-passport/passport-core':{allocateClimatePassportId:()=> 'unused',sanitizeChannelBridgeTargetPath:p=>p?.startsWith('/en/')?p:null},
  'next/headers':{cookies:()=>({get:()=>cookie?{value:cookie}:undefined,set:(...args)=>writes.push(args),delete:()=>{cookie=null;}})},
  'next/navigation':{redirect:()=>{throw Error('redirect');}},
 };
 const src=fs.readFileSync('apps/passport-web/lib/server/auth.ts','utf8');
 const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(compiled,{exports,require:n=>deps[n]??require(n),process:{env:{NODE_ENV:'test'}},Buffer,Date});
 return{api:exports,state:()=>state,writes:()=>writes,onLock:fn=>{hook=fn;},noCookie:()=>{cookie=null;},failSession:()=>{failCreate=true;},locks:()=>locks};
}
test('fresh password session requires account lock and sets secure-scope cookie',async()=>{const h=harness();await h.api.createUserSession('u1','old-hash');assert.equal(h.locks(),1);assert.equal(h.state().sessions.length,2);assert.equal(h.writes().length,1);assert.equal(h.writes()[0][2].httpOnly,true);assert.equal(h.writes()[0][2].sameSite,'lax');});
test('password reset between password check and lock prevents new session',async()=>{const h=harness();h.onLock(s=>{s.user.password='reset-hash';s.sessions=[];});await assert.rejects(()=>h.api.createUserSession('u1','old-hash'),/SESSION_AUTH_CHANGED/);assert.equal(h.writes().length,0);});
for(const reason of ['PENDING','SUSPENDED','unverified'])test(`session and bridge reject ${reason}`,async()=>{const h=harness();if(reason==='unverified')h.state().user.emailVerified=null;else h.state().user.status=reason;await assert.rejects(()=>h.api.createUserSession('u1','old-hash'),/SESSION_AUTH_CHANGED/);await assert.rejects(()=>h.api.issueChannelBridgeToken({userId:'u1'}),/SESSION_AUTH_CHANGED/);assert.equal(h.state().bridges.length,0);assert.equal(h.writes().length,0);});
test('stale source cookie cannot issue bridge after reset removes session',async()=>{const h=harness();h.onLock(s=>{s.sessions=[];});await assert.rejects(()=>h.api.issueChannelBridgeToken({userId:'u1'}),/SESSION_AUTH_CHANGED/);assert.equal(h.state().bridges.length,0);});
test('bridge source must exist, be live, and belong to requesting user',async()=>{for(const kind of ['no-cookie','expired','other-user']){const h=harness();if(kind==='no-cookie')h.noCookie();if(kind==='expired')h.state().sessions[0].expires=new Date(0);if(kind==='other-user')h.state().sessions[0].userId='other';await assert.rejects(()=>h.api.issueChannelBridgeToken({userId:'u1'}),/SESSION_AUTH_CHANGED/);assert.equal(h.state().bridges.length,0);}});
test('concurrent exchange produces one session in serialized transaction mock',async()=>{const h=harness();const issued=await h.api.issueChannelBridgeToken({userId:'u1',targetPath:'/en/dashboard'});const results=await Promise.all([h.api.exchangeChannelBridgeToken(issued.token),h.api.exchangeChannelBridgeToken(issued.token)]);assert.equal(results.filter(Boolean).length,1);assert.equal(h.state().sessions.length,2);assert.equal(h.writes().length,1);assert.ok(h.state().bridges[0].consumedAt);});
test('reset invalidation between lookup and exchange lock rejects bridge',async()=>{const h=harness();const issued=await h.api.issueChannelBridgeToken({userId:'u1'});h.onLock(s=>{s.bridges[0].consumedAt=new Date();s.sessions=[];});assert.equal(await h.api.exchangeChannelBridgeToken(issued.token),null);assert.equal(h.writes().length,0);});
test('failed session persistence rolls bridge consumption back and sets no cookie',async()=>{const h=harness();const issued=await h.api.issueChannelBridgeToken({userId:'u1'});h.failSession();await assert.rejects(()=>h.api.exchangeChannelBridgeToken(issued.token),/write failed/);assert.equal(h.state().bridges[0].consumedAt,null);assert.equal(h.writes().length,0);});
test('expired and subsequently suspended/unverified bridges cannot create sessions',async()=>{for(const kind of ['expired','SUSPENDED','unverified']){const h=harness();const issued=await h.api.issueChannelBridgeToken({userId:'u1'});if(kind==='expired')h.state().bridges[0].expiresAt=new Date(0);else if(kind==='unverified')h.state().user.emailVerified=null;else h.state().user.status=kind;assert.equal(await h.api.exchangeChannelBridgeToken(issued.token),null);assert.equal(h.writes().length,0);}});
test('password guard rejects UTF-8 truncation and never accepts legacy plaintext',async()=>{const h=harness();await assert.rejects(()=>h.api.hashUserPassword('界'.repeat(25)),/PASSWORD_TOO_LONG/);assert.equal(await h.api.verifyUserPassword('$2b$not-a-real-hash','界'.repeat(25)),false);assert.equal(await h.api.verifyUserPassword('plaintext','plaintext'),false);});

test('dummy bcrypt path cannot authenticate even with its public dummy input; real hashes still verify',async()=>{
 const h=harness();assert.equal(await h.api.verifyUserPassword('', 'public-dummy-never-a-login-credential'),false);
 assert.equal(await h.api.verifyUserPassword('$2b$malformed', 'public-dummy-never-a-login-credential'),false);
 const hash=await h.api.hashUserPassword('synthetic-owner-password');
 assert.equal(await h.api.verifyUserPassword(hash,'synthetic-owner-password'),true);
 assert.equal(await h.api.verifyUserPassword(hash,'wrong'),false);
});
