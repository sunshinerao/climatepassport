import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {spawn} from 'node:child_process';import {randomUUID} from 'node:crypto';
import {startAutomaticAuthMailConsumer} from './dev-auth-mail-consumer.mjs';
export function validateDevelopmentMailEnvironment(env,port){
 if(env.NODE_ENV==='production'||env.CP_DEV_GMAIL_ONLY!=='1'||env.MAIL_RECIPIENT_ALLOWLIST!=='sunshine.rao@gmail.com'||env.MAIL_PROVIDER!=='zoho'||env.MAIL_FROM!=='no-reply@notice.climatepassport.org'||env.ZOHO_MAIL_ENDPOINT!=='https://cpaas.zoho.com/v1.1/email'||env.MAIL_TRANSPORT==='test-outbox')throw Error('DEV_MAIL_CONFIG_INVALID');
 if(!env.ZOHO_MAIL_TOKEN?.trim()||/\s/.test(env.ZOHO_MAIL_TOKEN)||!env.AUTH_EMAIL_CODE_SECRET||env.AUTH_EMAIL_CODE_SECRET.length<32||!env.AUTH_MAIL_WORKER_SECRET||env.AUTH_MAIL_WORKER_SECRET.length<32||env.AUTH_MAIL_WORKER_SECRET.length>512||/\s/.test(env.AUTH_MAIL_WORKER_SECRET)||!env.AUTH_EMAIL_CREDENTIAL_VERSION||env.AUTH_EMAIL_CREDENTIAL_VERSION==='legacy'||!/^[A-Za-z0-9_-]{1,64}$/.test(env.AUTH_EMAIL_CREDENTIAL_VERSION))throw Error('DEV_AUTH_CONFIG_INVALID');
 const budget=Number(env.CP_DEV_MAIL_MAX_SENDS_PER_24H??10);if(!Number.isInteger(budget)||budget<1||budget>10)throw Error('DEV_MAIL_BUDGET_INVALID');
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('DEV_PORT_INVALID');
 let a,b,origin;try{a=new URL(env.DATABASE_URL);b=new URL(env.DIRECT_URL);origin=new URL(env.AUTH_PUBLIC_ORIGIN)}catch{throw Error('DEV_TARGET_INVALID')}
 if(a.href!==b.href||!['postgres:','postgresql:'].includes(a.protocol)||!['localhost','127.0.0.1','[::1]'].includes(a.hostname)||origin.origin!==`http://127.0.0.1:${port}`||origin.href!==origin.origin+'/')throw Error('DEV_TARGET_INVALID');
 return true;
}
export function acquireDevelopmentConsumerOwnership(ledgerPath,runId){
 if(!path.isAbsolute(ledgerPath))throw Error('DEV_LEDGER_TARGET_INVALID');
 const ownershipPath=ledgerPath+'.consumer.lock';fs.mkdirSync(path.dirname(ledgerPath),{recursive:true,mode:0o700});
 let fd;try{fd=fs.openSync(ownershipPath,'wx',0o600);}catch{throw Error('DEV_CONSUMER_OWNERSHIP_REQUIRES_REVIEW')}
 try{fs.writeSync(fd,JSON.stringify({pid:process.pid,runId}));}catch{fs.closeSync(fd);fs.unlinkSync(ownershipPath);throw Error('DEV_CONSUMER_OWNERSHIP_REQUIRES_REVIEW')}
 let released=false;return()=>{if(released)return;released=true;fs.closeSync(fd);fs.unlinkSync(ownershipPath)};
}
export async function startDevelopmentServer(root,port,options={}){
 const require=createRequire(path.join(root,'package.json'));if(!options.environment)require('@next/env').loadEnvConfig(root,true,{info(){},error(){}});const runtimeEnvironment=options.environment||process.env;validateDevelopmentMailEnvironment(runtimeEnvironment,port);
 const {Pool}=require('pg');
 const runStartedAt=new Date().toISOString(),runId=randomUUID();
 const pool=new Pool({connectionString:runtimeEnvironment.DIRECT_URL,max:1,connectionTimeoutMillis:8000,idleTimeoutMillis:5000,options:'-c default_transaction_read_only=on -c statement_timeout=10000'});
 const ledgerPath=options.ledgerPath||path.join(root,'.cp-dev-private','mail-ledger.jsonl');if(!path.isAbsolute(ledgerPath))throw Error('DEV_LEDGER_TARGET_INVALID');
 const guard=path.join(root,'scripts','dev-gmail-network-guard.cjs');if(!fs.existsSync(guard))throw Error('DEV_MAIL_GUARD_MISSING');
 let releaseOwnership;try{releaseOwnership=acquireDevelopmentConsumerOwnership(ledgerPath,runId)}catch{await pool.end();throw Error('DEV_CONSUMER_OWNERSHIP_REQUIRES_REVIEW')}
 pool.on('error',()=>console.error('DEV_AUTH_MAIL_DATABASE_UNAVAILABLE'));
 // This runtime scope selects only requests created during this web process lifetime.
 const env={...runtimeEnvironment,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--require='+guard,CP_DEV_MAIL_RUN_STARTED_AT:runStartedAt,CP_DEV_MAIL_RUN_ID:runId,CP_DEV_MAIL_LEDGER_PATH:ledgerPath};delete env.RESEND_API_KEY;
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:path.join(root,'apps/passport-web'),env,stdio:['ignore','pipe','pipe']});child.stdout.resume();child.stderr.resume();
 const {readSendWindow}=require(guard);
 const consumer=startAutomaticAuthMailConsumer({
  nextReady:async()=>{const row=(await pool.query('SELECT EXISTS (SELECT 1 FROM public.auth_mail_outbox WHERE status=\'PENDING\' AND email=$1 AND "credentialVersion"=$2 AND "createdAt">=$3::timestamp AND "nextAttemptAt"<=timezone(\'UTC\',clock_timestamp()) AND attempts<3) AS ready',['sunshine.rao@gmail.com',env.AUTH_EMAIL_CREDENTIAL_VERSION,runStartedAt])).rows[0];return row.ready;},
  sendWindow:()=>readSendWindow(ledgerPath,Number(env.CP_DEV_MAIL_MAX_SENDS_PER_24H??10)),
  sendBatch:async(signal)=>{const response=await fetch(`http://127.0.0.1:${port}/api/internal/auth-mail-worker`,{method:'POST',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(30000)]),headers:{'content-type':'application/json','x-auth-mail-worker-secret':env.AUTH_MAIL_WORKER_SECRET},body:JSON.stringify({limit:1})});return response.ok;},
  onState:state=>console.log('DEV_AUTH_MAIL_'+state),
 });
 let closing=false;const close=()=>{if(closing)return;closing=true;consumer.stop();void consumer.done.finally(()=>pool.end());};
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{close();child.kill(signal)});
 child.on('error',()=>{close();void consumer.done.finally(releaseOwnership);console.error('DEV_SERVER_START_FAILED');process.exitCode=1});
 child.on('exit',code=>{close();void consumer.done.finally(releaseOwnership);console.log('DEV_SERVER_STOPPED');process.exitCode=code??1});
 console.log('DEV_LOOPBACK_SERVER_STARTING_GMAIL_ONLY_AUTOMATIC_SESSION_MAIL');return child;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const port=Number(process.argv[2]||3000);startDevelopmentServer(root,port).catch(()=>{console.error('DEV_READINESS_FAILED_NO_DETAILS');process.exitCode=1})}
