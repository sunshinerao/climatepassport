/** Documentation-only preflight. Never resolves authority, identities or consent; never applies facts/rewards. */
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {GovernanceCommandSchema,GovernanceQualificationSchema}=require('../../../packages/passport-contracts/src/index.ts');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):x;
export const fixtureBodyDigest=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
export function inspectFixtureMessage(schema,message,context){
 const parsed=(schema==='qualification'?GovernanceQualificationSchema:GovernanceCommandSchema).safeParse(message);
 const result={offlineOnly:true,wireValid:parsed.success,contextConsistent:false,qualificationAccepted:false,rewardApplied:false,issue:null,participationKey:null,sourceStreamKey:null,replay:false};
 const reject=issue=>({...result,issue});if(!parsed.success)return reject('WIRE_SHAPE_INVALID');
 if(!context?.project?.id||!context.project.canonicalUnitRef||!context?.participation?.id||!context?.binding?.id||!context?.rule?.id||!context.source)return reject('FIXTURE_CONTEXT_INCOMPLETE');
 const c=context,p=c.project,entry=c.participation,b=c.binding,r=c.rule;
 if(!GovernanceCommandSchema.safeParse(c.source).success)return reject('FIXTURE_SOURCE_CONFIGURATION_INVALID');
 if(c.source.projectId!==p.id||entry.projectId!==p.id||r.projectId!==p.id)return reject('FIXTURE_PROJECT_RELATION_MISMATCH');
 result.participationKey=JSON.stringify([p.id,entry.userId]);result.sourceStreamKey=JSON.stringify([b.sourceId,b.sourceRecordId]);
 const e=parsed.data;
 if(schema!=='qualification'){
  if(e.action==='source'&&e.projectId!==p.id)return reject('PROJECT_REFERENCE_MISMATCH');
  if(e.action==='binding'&&(e.sourceId!==b.sourceId||e.userId!==entry.userId||e.sourceRecordId!==b.sourceRecordId))return reject('FIXTURE_BINDING_REFERENCE_MISMATCH');
  if(e.action==='binding'&&e.ruleVersionId!==entry.ruleVersionId)return reject('ENTRY_RULE_MISMATCH');
  return {...result,contextConsistent:true};
 }
 if(e.bindingId!==b.id||e.sourceRecord.id!==b.sourceRecordId)return reject('FIXTURE_BINDING_REFERENCE_MISMATCH');
 if(e.ruleVersionId!==entry.ruleVersionId||e.ruleVersionId!==r.id)return reject('ENTRY_RULE_MISMATCH');
 const seen=(c.seenEvents??[]).find(x=>x.eventId===e.eventId);
 if(seen){if(fixtureBodyDigest(seen)!==fixtureBodyDigest(e))return reject('IMMUTABLE_BODY_CONFLICT');return {...result,contextConsistent:true,replay:true};}
 if(b.terminalRevoked)return reject('FIXTURE_TERMINAL_RECORD');
 if(e.sourceRecord.version!==b.currentVersion+1)return reject('SOURCE_VERSION_MISMATCH');
 if((!b.currentVersion&&e.operation!=='upsert')||(b.currentVersion&&e.operation==='upsert'))return reject('SOURCE_OPERATION_CONTEXT');
 if(b.currentVersion&&e.supersedesEventId!==b.headEventId)return reject('SOURCE_HEAD_MISMATCH');
 if(e.operation!=='revoke'){
  if(!['PUBLISHED','RETIRED'].includes(r.status)||!['PUBLISHED','RETIRED'].includes(p.status))return reject('FIXTURE_RULE_NOT_PUBLISHED');
  const t=Date.parse(e.occurredAt);if(t<Date.parse(entry.createdAt))return reject('FACT_BEFORE_ADMISSION');
  if(t<Date.parse(r.publishedAt)||t<Date.parse(r.validFrom)||t>=Date.parse(r.validUntil))return reject('FACT_TIME_OUTSIDE_PINNED_WINDOW');
  if((c.source.sourceApp==='gca'&&(e.data.kind!=='learning_completion'||e.data.status!=='completed'))||(c.source.sourceApp==='fs'&&(e.data.kind!=='approved_private_evidence'||e.data.status!=='accepted')))return reject('SOURCE_FACT_KIND_MISMATCH');
 }
 return {...result,contextConsistent:true};
}
