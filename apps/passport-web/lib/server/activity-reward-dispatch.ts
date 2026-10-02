import {randomUUID} from 'node:crypto';
import {Prisma,type PrismaClient} from '@prisma/client';
import {matchesLegacyRewardCondition,type QualificationFacts} from './governance-conditions';
type Tx=Prisma.TransactionClient;
export async function enqueueActivityRewardDispatch(tx:Tx,input:{activityId:string;userId:string;trigger:string}){
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`legacy-reward-enqueue:${input.activityId}:${input.userId}`},0))`;
 const rules=await tx.activityRewardRule.findMany({where:{activityId:input.activityId,trigger:input.trigger as never}});
 const ids:string[]=[];
 for(const rule of rules){const d=await tx.activityRewardDispatch.upsert({where:{ruleId_userId:{ruleId:rule.id,userId:input.userId}},create:{activityId:input.activityId,ruleId:rule.id,userId:input.userId,trigger:input.trigger,rewardType:rule.rewardType,rewardValueJson:rule.rewardValueJson??Prisma.JsonNull,conditionJson:rule.conditionJson??Prisma.DbNull,factsJson:{kind:'activity_participation',status:input.trigger,verificationLevel:'source_verified',evidenceRefs:[input.activityId]}},update:{}});ids.push(d.id);}
 return ids;
}
/** Atomic, serialized dispatch. Failures remain persisted, never only a console log. */
export async function processActivityRewardDispatch(prisma:PrismaClient,id:string,now=new Date()){
 try{return await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`legacy-activity-reward:${id}`},0))`;
  const d=await tx.activityRewardDispatch.findUniqueOrThrow({where:{id}});
  if(['SUCCEEDED','INELIGIBLE','BLOCKED'].includes(d.state))return {id,state:d.state};
  if(d.nextAttemptAt>now)return {id,state:d.state};
  const facts=d.factsJson as QualificationFacts;let matches;
  try{matches=matchesLegacyRewardCondition(d.conditionJson,facts);}catch{await tx.activityRewardDispatch.update({where:{id},data:{state:'BLOCKED',failureCode:'UNSUPPORTED_CONDITION'}});return{id,state:'BLOCKED'};}
  if(!matches){await tx.activityRewardDispatch.update({where:{id},data:{state:'INELIGIBLE'}});return{id,state:'INELIGIBLE'};}
  const value=d.rewardValueJson as Record<string,unknown>;
  const u=await tx.user.findUnique({where:{id:d.userId},select:{status:true,anonymizedAt:true}});if(!u||u.status!=='ACTIVE'||u.anonymizedAt)throw Error('USER_UNAVAILABLE');
  if(d.rewardType==='POINTS'){
   if(typeof value.points!=='number'||!Number.isSafeInteger(value.points)||value.points<=0||value.points>1000000||Object.keys(value).some(k=>k!=='points')){await tx.activityRewardDispatch.update({where:{id},data:{state:'BLOCKED',failureCode:'INVALID_REWARD'}});return{id,state:'BLOCKED'};}
   const previous=await tx.pointTransaction.findFirst({where:{userId:d.userId,type:'ACTIVITY_REWARD',description:{startsWith:`[reward:${d.ruleId}:${d.userId}] `}},select:{id:true}});
   if(!previous){await tx.user.update({where:{id:d.userId},data:{points:{increment:value.points}}});await tx.pointTransaction.create({data:{userId:d.userId,points:value.points,type:'ACTIVITY_REWARD',description:'Activity reward dispatch '+d.id}});}
  }else if(d.rewardType==='BADGE'){
   if(typeof value.badgeDefinitionId!=='string'||Object.keys(value).some(k=>k!=='badgeDefinitionId')||!await tx.badgeDefinition.findFirst({where:{id:value.badgeDefinitionId,isActive:true},select:{id:true}})){await tx.activityRewardDispatch.update({where:{id},data:{state:'BLOCKED',failureCode:'INVALID_BADGE'}});return{id,state:'BLOCKED'};}
   const previous=await tx.badgeAward.findFirst({where:{userId:d.userId,badgeDefinitionId:value.badgeDefinitionId,evidenceSnapshotJson:{path:['rewardRuleId'],equals:d.ruleId}},select:{id:true}});
   if(!previous){const award=await tx.badgeAward.create({data:{userId:d.userId,badgeDefinitionId:value.badgeDefinitionId,verificationToken:randomUUID(),evidenceSnapshotJson:{rewardDispatchId:d.id,rewardRuleId:d.ruleId,activityId:d.activityId}}});await tx.activityParticipation.updateMany({where:{activityId:d.activityId,userId:d.userId},data:{badgeAwardIds:{push:award.id}}});}
  }else if(d.rewardType==='PASSPORT_ENTRY'){
   const previous=await tx.passportMilestone.findFirst({where:{userId:d.userId,activityId:d.activityId,sourceType:'ACTIVITY_REWARD',sourceId:d.ruleId},select:{id:true}});if(!previous){const a=await tx.activity.findUniqueOrThrow({where:{id:d.activityId},select:{title:true,titleEn:true}});await tx.passportMilestone.create({data:{userId:d.userId,activityId:d.activityId,title:a.title,titleEn:a.titleEn,sourceType:'ACTIVITY_REWARD',sourceId:d.id}});}
  }else{await tx.activityRewardDispatch.update({where:{id},data:{state:'BLOCKED',failureCode:'UNSUPPORTED_REWARD'}});return{id,state:'BLOCKED'};}
  await tx.activityRewardDispatch.update({where:{id},data:{state:'SUCCEEDED',attempts:{increment:1},failureCode:null}});return{id,state:'SUCCEEDED'};
 });}catch{
  const d=await prisma.activityRewardDispatch.findUnique({where:{id},select:{state:true,attempts:true}});if(d&&['PENDING','RETRY'].includes(d.state))await prisma.activityRewardDispatch.updateMany({where:{id,state:{in:['PENDING','RETRY']},attempts:d.attempts},data:{state:d.attempts>=7?'BLOCKED':'RETRY',attempts:{increment:1},nextAttemptAt:new Date(now.getTime()+Math.min(60000*2**d.attempts,3600000)),failureCode:'TRANSACTION_FAILED'}});return{id,state:'RETRY'};
 }
}
