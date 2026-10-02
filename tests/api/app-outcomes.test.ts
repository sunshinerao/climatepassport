import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { Client as PgClient } from "pg";
import { NextRequest } from "next/server";
import { AppOutcomeEventSchema } from "@climate-passport/passport-contracts";
import { ingestAppOutcome, reconcileAppOutcome, listPrivateAppOutcomes, outcomeDigest, outcomeSubjectHash, purgeExpiredAppOutcomes } from "../../apps/passport-web/lib/server/app-outcomes";
import { POST } from "../../apps/passport-web/app/api/integrations/app-outcomes/route";
import { POST as RECONCILE } from "../../apps/passport-web/app/api/integrations/app-outcomes/reconcile/route";
import { withdrawConsent } from "../../apps/passport-web/lib/server/consents";
import { hashChannelMachineKeyBcrypt, generateChannelMachineKey } from "../../apps/passport-web/lib/server/channel-client-auth";

const u = new URL(process.env.DATABASE_URL!);
if (u.hostname !== "127.0.0.1" || u.port !== "55432" || u.pathname !== "/cp_app_outcome_test_20261001") throw Error("Only explicitly isolated synthetic outcome DB allowed");
const prisma = new PrismaClient();
const producerUrl = new URL(u); producerUrl.pathname="/cp_app_outcome_producer_test_20261001";
const producer = new PgClient({connectionString:producerUrl.href});
const issuer = "https://synthetic-outcome-idp.invalid";
const run = randomUUID();
const checks: string[] = [];
let origin = "";
const credentials = new Map<string,string>();
const createdClients: string[] = [];
const server = createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const request = new NextRequest(origin + req.url, { method: req.method, headers: { ...req.headers, "x-forwarded-for":"127.0.0.1" } as Record<string,string>, body: Buffer.concat(chunks) });
    const response = await (req.url === "/api/integrations/app-outcomes/reconcile" ? RECONCILE : POST)(request);
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end(); }
});
async function post(f: any, e: any, path = "/api/integrations/app-outcomes", headers: Record<string,string> = {}) {
  const r = await fetch(origin + path, { method: "POST", headers: { "content-type":"application/json", authorization: `Bearer ${credentials.get(f.client.id)}`, ...headers }, body: JSON.stringify(e) });
  return { status:r.status, body:await r.json() as any };
}
async function fixture(app: "gca"|"fs", kind: string) {
  const tenant = await prisma.tenant.create({ data: { key:`OUTCOME_${app}_${run}_${randomUUID()}`, name:"Synthetic isolated tenant" } });
  const programme = await prisma.programme.create({ data: { tenantId:tenant.id,key:`OUTCOME_${randomUUID()}`,name:"Synthetic isolated programme" } });
  const secret = generateChannelMachineKey();
  const client = await prisma.channelClient.create({ data: { key:`OUTCOME_${randomBytes(12).toString("hex").toUpperCase()}`, displayName:"Synthetic outcome machine",type:"MACHINE",programmeId:programme.id,allowedScopes:["channel:outcomes:write","channel:outcomes:reconcile"],allowedOrigins:[],allowedIps:["127.0.0.1"],machineKeyBcrypt:await hashChannelMachineKeyBcrypt(secret),machineKeyIssuedAt:new Date(),rateLimitLimit:500,rateLimitWindowMs:60000 } });
  createdClients.push(client.id);
  credentials.set(client.id,`${client.key}.${secret}`);
  const source = await prisma.appOutcomeSource.create({ data:{channelClientId:client.id,sourceApp:app,sourceAuthority:`synthetic:${app}:${run}`,identityIssuer:issuer,identityClientId:`synthetic:${app}:rp`,allowedKinds:[kind],isActive:true} });
  const user = await prisma.user.create({data:{email:`outcome-${randomUUID()}@example.invalid`,password:"!synthetic-no-login",name:"Synthetic outcome owner"}});
  const recordId = `record:${randomUUID()}`, subject=`pairwise:${randomUUID()}`;
  const binding = await prisma.appOutcomeBinding.create({data:{sourceId:source.id,userId:user.id,subjectHash:outcomeSubjectHash(issuer,source.identityClientId,subject),sourceRecordId:recordId,status:"ACTIVE",verifiedAt:new Date(),verificationRef:"synthetic-explicit-rp-record-ownership"}});
  const createdAt = new Date(Date.now()-60000);
  const consent = await prisma.consentRecord.create({data:{subjectUserId:user.id,grantorUserId:user.id,purpose:"private_archive",channel:app,objectType:"app_outcome",objectId:recordId,createdAt,validFrom:createdAt}});
  const e={schemaVersion:"app-outcome/1",eventId:`event:${randomUUID()}`,sourceApp:app,sourceAuthority:source.sourceAuthority,identity:{issuer,subject},sourceRecord:{id:recordId,version:1},operation:"upsert",occurredAt:new Date().toISOString(),consent:{receiptId:consent.id,version:consent.version,scope:"private_archive",grantedAt:consent.createdAt.toISOString()},data:{kind,status:"completed",evidenceRefs:[`evidence:${randomUUID()}`]}};
  return {tenant,client,source,user,binding,consent,e};
}
async function rejects(code:string, f:()=>Promise<unknown>) { await assert.rejects(f, (e:any)=>e.code===code); }
test("isolated PostgreSQL + HTTP authoritative outcome lifecycle", async t=>{
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve)); origin=`http://127.0.0.1:${(server.address() as any).port}`;
 globalThis.__climatePassportPrisma__=prisma;
 await producer.connect();
 try {
 const gca=await fixture("gca","course_completion"),fs=await fixture("fs","approved_private_evidence");
 await t.test("business completion and eligible outbox are atomic in a separate producer store",async()=>{
   // Independent producer database: CP consumer never gets its connection or reads it.
   await producer.query('CREATE TABLE IF NOT EXISTS business (id text PRIMARY KEY, status text NOT NULL)');
   await producer.query('ALTER TABLE business ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1');
   await producer.query('CREATE TABLE IF NOT EXISTS outbox (id text PRIMARY KEY, body jsonb NOT NULL, state text NOT NULL)');
   await producer.query('BEGIN');
   await producer.query("INSERT INTO business (id,status) VALUES ($1,'completed')",[run+"rollback"]);
   await producer.query('ROLLBACK');
   assert.equal((await producer.query('SELECT count(*)::int n FROM business WHERE id=$1',[run+"rollback"])).rows[0].n,0);
   await producer.query('BEGIN');
   await producer.query("INSERT INTO business (id,status) VALUES ($1,'completed')",[gca.e.sourceRecord.id]);
   await producer.query("INSERT INTO outbox VALUES ($1,$2::jsonb,'eligible_not_sent')",[gca.e.eventId,JSON.stringify(gca.e)]);
   await producer.query('COMMIT');
   checks.push("atomic_producer_outbox");
 });
 await t.test("GCA and FS HTTP apply persist private projections and exact receipts",async()=>{
   for(const f of [gca,fs]){const r=await post(f,f.e);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.applied,true);assert.equal(r.body.eventId,f.e.eventId);assert.equal(r.body.digest,outcomeDigest(f.e));assert.equal(r.body.sourceRecord.version,1);const view=await listPrivateAppOutcomes(prisma,f.user.id);assert.equal(view.length,1);assert.equal(view[0].visibility,"private");assert.equal(view[0].kind,f.e.data.kind);assert.equal(view[0].provenance,"SOURCE_REPORTED");assert.equal(await prisma.certificateIssue.count({where:{userId:f.user.id}}),0);}
   const r=await post(gca,gca.e,"/api/integrations/app-outcomes/reconcile");
   assert.equal(r.body.digest,outcomeDigest(gca.e));
   await producer.query("UPDATE outbox SET state = 'acknowledged' WHERE id=$1",[r.body.eventId]);
   assert.equal((await producer.query("SELECT state FROM outbox WHERE id=$1",[gca.e.eventId])).rows[0].state,"acknowledged");
   checks.push("gca_fs_persisted_private_http");
 });
 await t.test("lost acknowledgement reconciles same ID/digest; duplicate concurrency has one event",async()=>{
   const acknowledgements=await Promise.all(Array.from({length:8},()=>post(gca,gca.e)));assert.ok(acknowledgements.every(r=>r.status===200&&r.body.applied));assert.equal(await prisma.appOutcomeEvent.count({where:{sourceId:gca.source.id,eventId:gca.e.eventId}}),1);
   const r=await post(gca,gca.e,"/api/integrations/app-outcomes/reconcile");assert.equal(r.status,200);assert.equal(r.body.digest,outcomeDigest(gca.e));assert.ok(!("data" in r.body));checks.push("duplicate_concurrent_unknown_reconcile");
 });
 await t.test("unauthenticated, oversized and future envelopes fail closed",async()=>{
  assert.equal((await post(gca,gca.e,undefined,{authorization:"Bearer synthetic.invalid"})).status,401);
  assert.equal((await post(gca,{...gca.e,extra:"x".repeat(65536)})).status,413);
  assert.equal((await post(gca,{...gca.e,eventId:`future:${run}`,occurredAt:new Date(Date.now()+600000).toISOString()})).status,400);checks.push("body_time_auth_limits");
 });
 await t.test("same ID different content permanent409; version fork rejected",async()=>{
  assert.equal((await post(gca,{...gca.e,data:{...gca.e.data,evidenceRefs:["changed"]}})).status,409);
  assert.equal((await post(gca,{...gca.e,eventId:`fork:${run}`})).status,409);checks.push("immutable_digest_version_fork");
 });
 await t.test("all private/privileged fields, public URLs and FSA qualification refused",async()=>{
  for(const extra of [{email:"x@example.invalid"},{userId:gca.user.id},{isPublic:true},{role:"ADMIN"}])assert.equal((await post(gca,{...gca.e,...extra})).status,400);
  assert.equal((await post(gca,{...gca.e,data:{...gca.e.data,evidenceRefs:["https://example.invalid/private"]}})).status,400);
  assert.equal((await post(gca,{...gca.e,data:{...gca.e.data,kind:"FSA_QUALIFICATION"}})).status,400);checks.push("privacy_qualification_payload_denials");
 });
 await t.test("browser cookies/origin, login scope and cross-source/subject/record denied",async()=>{
  for(const headers of [{origin:"http://localhost"},{cookie:"cp_session=synthetic"}])assert.equal((await post(gca,gca.e,undefined,headers)).status,403);
  const prior=gca.client.allowedScopes;await prisma.channelClient.update({where:{id:gca.client.id},data:{allowedScopes:["openid","profile","email"]}});assert.equal((await post(gca,gca.e)).status,403);await prisma.channelClient.update({where:{id:gca.client.id},data:{allowedScopes:prior}});
  for(const e of [{...gca.e,sourceAuthority:fs.e.sourceAuthority},{...gca.e,identity:{...gca.e.identity,subject:fs.e.identity.subject}},{...gca.e,sourceRecord:{...gca.e.sourceRecord,id:fs.e.sourceRecord.id}}])assert.equal((await post(gca,e)).status,403);
  checks.push("machine_only_scoped_verified_binding");
 });
 await t.test("no retrospective consent, wrong receipt version or source kind",async()=>{
  const fresh=await fixture("gca","course_completion");
  assert.equal((await post(fresh,{...fresh.e,occurredAt:new Date(fresh.consent.createdAt.getTime()-1).toISOString()})).status,403);
  assert.equal((await post(fresh,{...fresh.e,consent:{...fresh.e.consent,version:2}})).status,403);
  assert.equal((await post(fresh,{...fresh.e,data:{...fresh.e.data,kind:"approved_private_evidence"}})).status,403);checks.push("live_consent_nonretroactive_kind");
 });
 const v2={...gca.e,eventId:`v2:${run}`,sourceRecord:{...gca.e.sourceRecord,version:2},operation:"correct",supersedesEventId:gca.e.eventId,data:{...gca.e.data,evidenceRefs:["evidence:corrected2"]}};
 const v3={...v2,eventId:`v3:${run}`,sourceRecord:{...gca.e.sourceRecord,version:3},supersedesEventId:v2.eventId,data:{...gca.e.data,evidenceRefs:["evidence:corrected3"]}};
 await t.test("gap202 is not applied; missing predecessor drains persisted pending v3",async()=>{
  for(const e of [v2,v3]){await producer.query("BEGIN");await producer.query("UPDATE business SET version=$2 WHERE id=$1",[e.sourceRecord.id,e.sourceRecord.version]);await producer.query("INSERT INTO outbox VALUES ($1,$2::jsonb,'eligible_not_sent')",[e.eventId,JSON.stringify(e)]);await producer.query("COMMIT");}
  const gap=await post(gca,v3);assert.equal(gap.status,202);assert.equal(gap.body.applied,false);assert.equal(gap.body.state,"gap_pending");assert.equal((await listPrivateAppOutcomes(prisma,gca.user.id))[0].sourceRecord.version,1);
  const head=await post(gca,v2);assert.equal(head.status,200);assert.equal(head.body.currentVersion,3);const r=await post(gca,v3,"/api/integrations/app-outcomes/reconcile");assert.equal(r.body.applied,true);assert.deepEqual((await listPrivateAppOutcomes(prisma,gca.user.id))[0].evidenceRefs,["evidence:corrected3"]);checks.push("persisted_gap_order_correction");
 });
 await t.test("wrong prior rolls back inbox/stream/audit; injected audit DB failure rolls back all",async()=>{
  const bad={...v3,eventId:`bad:${run}`,sourceRecord:{...gca.e.sourceRecord,version:4},supersedesEventId:fs.e.eventId};assert.equal((await post(gca,bad)).status,409);assert.equal(await prisma.appOutcomeEvent.count({where:{eventId:bad.eventId}}),0);
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION synthetic_reject_outcome_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'app_outcome.%' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER synthetic_outcome_audit_fault BEFORE INSERT ON core_audit_logs FOR EACH ROW EXECUTE FUNCTION synthetic_reject_outcome_audit()');
  const fault={...bad,eventId:`fault:${run}`,supersedesEventId:v3.eventId};assert.equal((await post(gca,fault)).status,503);await prisma.$executeRawUnsafe('DROP TRIGGER synthetic_outcome_audit_fault ON core_audit_logs');assert.equal(await prisma.appOutcomeEvent.count({where:{eventId:fault.eventId}}),0);assert.equal((await listPrivateAppOutcomes(prisma,gca.user.id))[0].sourceRecord.version,3);checks.push("prior_and_audit_atomic_rollback");
 });
 await t.test("invalid buffered prior permanently quarantines; blocked409 never loops as gap202",async()=>{
  const f=await fixture("gca","course_completion");assert.equal((await post(f,f.e)).status,200);
  const v2={...f.e,eventId:`blocked-v2:${run}`,operation:"correct",supersedesEventId:f.e.eventId,sourceRecord:{...f.e.sourceRecord,version:2}};
  const bad3={...v2,eventId:`blocked-v3:${run}`,supersedesEventId:"wrong:prior",sourceRecord:{...f.e.sourceRecord,version:3}};
  assert.equal((await post(f,bad3)).status,202);const apply2=await post(f,v2);assert.equal(apply2.status,200);assert.equal(apply2.body.terminalRevoked,true);
  for(const path of ["/api/integrations/app-outcomes","/api/integrations/app-outcomes/reconcile"]){const r=await post(f,bad3,path);assert.equal(r.status,409);assert.equal(r.body.applied,false);assert.equal(r.body.state,"blocked");assert.equal(r.body.digest,outcomeDigest(bad3));}
  const fixed={...bad3,eventId:`fixed-v3:${run}`,supersedesEventId:v2.eventId};const denied=await post(f,fixed);assert.equal(denied.status,409);assert.equal(denied.body.error.code,"OUTCOME_BLOCKED");
  const {consent,data,...envelope}=fixed;assert.equal((await post(f,{...envelope,operation:"revoke",eventId:`blocked-revoke:${run}`,sourceRecord:{...f.e.sourceRecord,version:4}})).status,409);
  assert.equal((await listPrivateAppOutcomes(prisma,f.user.id)).length,0);const row=await prisma.appOutcomeStream.findUniqueOrThrow({where:{bindingId:f.binding.id}});assert.deepEqual(row.evidenceRefs,[]);assert.equal(row.currentVersion,2);assert.equal(row.terminalRevoked,true);const withdrawal=await withdrawConsent(prisma,{consentId:f.consent.id,actorUserId:f.user.id});assert.ok(!("error" in withdrawal),JSON.stringify(withdrawal));assert.equal((await prisma.consentRecord.findUniqueOrThrow({where:{id:f.consent.id}})).status,"WITHDRAWN");checks.push("permanent_gap_quarantine_409_no_retry_no_display_withdrawal_unblocked");
 });
 await t.test("withdraw immediately hides and erases, minimal revoke allowed; no resurrection",async()=>{
  const withdrawn=await withdrawConsent(prisma,{consentId:gca.consent.id,actorUserId:gca.user.id});assert.ok(!("error" in withdrawn),JSON.stringify(withdrawn));assert.equal((await listPrivateAppOutcomes(prisma,gca.user.id)).length,0);
  const stream=await prisma.appOutcomeStream.findUniqueOrThrow({where:{bindingId:gca.binding.id}});assert.deepEqual(stream.evidenceRefs,[]);assert.equal(stream.kind,null);
  const payloads=await prisma.$queryRaw<Array<{n:bigint}>>`SELECT count(*)::bigint n FROM app_outcome_events WHERE "streamId"=${stream.id} AND "payloadJson" IS NOT NULL`;assert.equal(payloads[0].n,0n);
  const revoke={schemaVersion:gca.e.schemaVersion,eventId:`revoke:${run}`,sourceApp:gca.e.sourceApp,sourceAuthority:gca.e.sourceAuthority,identity:gca.e.identity,sourceRecord:{...gca.e.sourceRecord,version:4},operation:"revoke",occurredAt:new Date().toISOString(),supersedesEventId:v3.eventId};
  await producer.query("BEGIN");await producer.query("UPDATE business SET status='revoked',version=$2 WHERE id=$1",[revoke.sourceRecord.id,revoke.sourceRecord.version]);await producer.query("INSERT INTO outbox VALUES ($1,$2::jsonb,'eligible_not_sent')",[revoke.eventId,JSON.stringify(revoke)]);await producer.query("COMMIT");
  const r=await post(gca,revoke);assert.equal(r.status,200);assert.equal(r.body.applied,true);assert.equal(r.body.terminalRevoked,true);
  await producer.query("UPDATE outbox SET state='acknowledged' WHERE id=$1",[revoke.eventId]);
  assert.equal((await producer.query("SELECT status FROM business WHERE id=$1",[revoke.sourceRecord.id])).rows[0].status,"revoked");
  assert.equal((await post(gca,{...v2,eventId:`late:${run}`,sourceRecord:{...gca.e.sourceRecord,version:5},supersedesEventId:revoke.eventId})).status,403);
  assert.equal((await post(gca,{...revoke,data:gca.e.data})).status,400);assert.equal((await post(gca,revoke,"/api/integrations/app-outcomes/reconcile")).body.applied,true);checks.push("withdraw_erasure_minimum_revoke_terminal");
 });
 await t.test("retention purge deletes binding and history, late delivery rejected; account delete cascades",async()=>{
  await purgeExpiredAppOutcomes(prisma,new Date(Date.now()+31*86400000));assert.equal(await prisma.appOutcomeBinding.count({where:{id:gca.binding.id}}),0);assert.equal(await prisma.appOutcomeEvent.count({where:{sourceId:gca.source.id}}),0);assert.equal((await post(gca,gca.e)).status,403);
  await prisma.user.delete({where:{id:fs.user.id}});assert.equal(await prisma.appOutcomeBinding.count({where:{id:fs.binding.id}}),0);assert.equal(await prisma.appOutcomeEvent.count({where:{sourceId:fs.source.id}}),0);checks.push("retention_and_account_cascade");
 });
 await t.test("stream identity never grants another owner access",async()=>{assert.equal((await listPrivateAppOutcomes(prisma,randomUUID())).length,0);checks.push("owner_private_query_isolation");});
 } finally {await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await prisma.appOutcomeSource.updateMany({where:{channelClientId:{in:createdClients}},data:{isActive:false}});await prisma.channelClient.updateMany({where:{id:{in:createdClients}},data:{isActive:false,allowedScopes:[],machineKeyBcrypt:null,revokedAt:new Date()}});await prisma.$disconnect();await producer.end();credentials.clear();}
 const {writeFileSync}=await import("node:fs");if(process.env.CP_OUTCOME_TEST_EVIDENCE)writeFileSync(process.env.CP_OUTCOME_TEST_EVIDENCE,JSON.stringify({database:"cp_app_outcome_test_20261001",transport:"real loopback HTTP to actual CP route handlers",checks,originalDatabaseModified:false,realUserConsentCreated:false,realPersistentMachineCredentialCreated:false,syntheticCredentialsRevokedAndHashesErased:true,syntheticHashInIsolatedDb:true},null,2));
});
