import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {AppOutcomeEventSchema,AppOutcomeReceiptSchema,APP_OUTCOME_KINDS}=require("@climate-passport/passport-contracts");
const base={schemaVersion:"app-outcome/1",eventId:"synthetic:contract",sourceApp:"gca",sourceAuthority:"synthetic:gca",identity:{issuer:"https://example.invalid",subject:"pairwise-synthetic"},sourceRecord:{id:"synthetic:record",version:1},operation:"upsert",occurredAt:"2026-10-01T12:00:00.000Z",consent:{receiptId:"synthetic:receipt",version:1,scope:"private_archive",grantedAt:"2026-10-01T11:00:00.000Z"},data:{kind:"course_completion",status:"completed",evidenceRefs:["synthetic:evidence"]}};
test("app-outcome/1 strict minimum upsert/correction/revoke fields",()=>{
 assert.ok(AppOutcomeEventSchema.safeParse(base).success);
 const correction={...base,operation:"correct",supersedesEventId:base.eventId,sourceRecord:{...base.sourceRecord,version:2}};assert.ok(AppOutcomeEventSchema.safeParse(correction).success);
 const {consent,data,...envelope}=correction;assert.ok(AppOutcomeEventSchema.safeParse({...envelope,operation:"revoke"}).success);
 for(const e of [{...base,supersedesEventId:"extra"},{...base,operation:"correct"},{...correction,operation:"revoke"}])assert.equal(AppOutcomeEventSchema.safeParse(e).success,false);
});
test("untrusted identity/private/public/credential fields cannot enter any object",()=>{
 for(const e of [{...base,email:"example@example.invalid"},{...base,identity:{...base.identity,userId:"spoofed"}},{...base,data:{...base.data,privateBody:"private"}},{...base,consent:{...base.consent,loginScope:"openid"}},{...base,data:{...base.data,isPublic:true}},{...base,password:"secret"}])assert.equal(AppOutcomeEventSchema.safeParse(e).success,false);
});
test("opaque evidence IDs, bounds and non-qualification kinds",()=>{
 for(const refs of [["https://example.invalid"],["same","same"],Array.from({length:11},(_,i)=>`ref:${i}`)])assert.equal(AppOutcomeEventSchema.safeParse({...base,data:{...base.data,evidenceRefs:refs}}).success,false);
 assert.equal(AppOutcomeEventSchema.safeParse({...base,data:{...base.data,kind:"FSA_QUALIFICATION"}}).success,false);assert.ok(APP_OUTCOME_KINDS.fs.includes("approved_private_evidence"));assert.ok(APP_OUTCOME_KINDS.gca.includes("course_completion"));
});
test("source versions are bounded positive PostgreSQL integers",()=>{
 for(const version of [0,-1,1.5,2147483648,Number.MAX_SAFE_INTEGER])assert.equal(AppOutcomeEventSchema.safeParse({...base,sourceRecord:{...base.sourceRecord,version}}).success,false);
});
test("receipts cannot omit digest/version binding or include private payload",()=>{
 const r={schemaVersion:"app-outcome/1",applied:true,state:"applied",eventId:base.eventId,digest:"a".repeat(64),sourceRecord:base.sourceRecord,stream:JSON.stringify([base.sourceApp,base.sourceAuthority,base.identity.issuer,base.identity.subject,base.sourceRecord.id]),remoteRecordRef:"00000000-0000-4000-8000-000000000001",currentVersion:1,terminalRevoked:false};assert.ok(AppOutcomeReceiptSchema.safeParse(r).success);
 assert.equal(AppOutcomeReceiptSchema.safeParse({...r,digest:""}).success,false);assert.equal(AppOutcomeReceiptSchema.safeParse({...r,data:base.data}).success,false);
});
