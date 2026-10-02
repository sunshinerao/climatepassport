const fs=require('node:fs'),path=require('node:path');
class DevMailPreSendError extends Error { constructor(code){super(code);this.name='DevMailPreSendError';this.code=code;this.outcome='not-attempted'} }
const recipient='sunshine.rao@gmail.com',sender='no-reply@climatepassport.org',endpoint='https://cpaas.zoho.com/v1.1/email';
function validEnv(env){return env.CP_DEV_GMAIL_ONLY==='1'&&env.MAIL_RECIPIENT_ALLOWLIST===recipient&&env.MAIL_PROVIDER==='zoho'&&env.MAIL_FROM===sender&&env.ZOHO_MAIL_ENDPOINT===endpoint}
function urlOf(input){return new URL(typeof input==='string'||input instanceof URL?input:input.url)}
function local(url){return ['localhost','127.0.0.1','[::1]','::1'].includes(url.hostname)}
const ROLLING_WINDOW_MS=24*60*60*1000;
function readReservations(ledgerPath,now){
 const rows=fs.existsSync(ledgerPath)?fs.readFileSync(ledgerPath,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)):[];
 if(rows.some(x=>x.reserved!==true||!Number.isFinite(Date.parse(x.at))||Date.parse(x.at)>now))throw Error('INVALID_LEDGER');return rows;
}
function rollingWindow(rows,maxSendsPer24h,now,minimumIntervalMs){
 const times=rows.map(x=>Date.parse(x.at));const active=times.filter(at=>at>now-ROLLING_WINDOW_MS).sort((a,b)=>a-b);
 if(active.length>=maxSendsPer24h)return {ready:false,reason:'WAITING_FOR_ROLLING_SEND_WINDOW',retryAt:active[active.length-maxSendsPer24h]+ROLLING_WINDOW_MS};
 const latest=times.length?Math.max(...times):0;
 if(times.length&&now-latest<minimumIntervalMs)return {ready:false,reason:'WAITING_FOR_LOW_FREQUENCY_WINDOW',retryAt:latest+minimumIntervalMs};return {ready:true,usedIn24h:active.length,limitPer24h:maxSendsPer24h};
}
function recordDeliveryHalt(ledgerPath,control){if(control)control.halted=true;fs.mkdirSync(path.dirname(ledgerPath),{recursive:true,mode:0o700});try{fs.writeFileSync(ledgerPath+'.halt',JSON.stringify({reason:'DELIVERY_REQUIRES_REVIEW',at:new Date().toISOString()})+'\n',{flag:'wx',mode:0o600})}catch(error){if(error.code!=='EEXIST')throw Error('DEV_MAIL_HALT_PERSIST_FAILED')}}
function readSendWindow(ledgerPath,maxSendsPer24h=10,now=Date.now(),minimumIntervalMs=60000,ignoreIssuanceLock=false){
 try{if(!Number.isInteger(maxSendsPer24h)||maxSendsPer24h<1||maxSendsPer24h>10||!Number.isFinite(now))return {ready:false,reason:'LEDGER_REQUIRES_REVIEW'};
 const rows=readReservations(ledgerPath,now);if(fs.existsSync(ledgerPath+'.halt'))return {ready:false,reason:'DELIVERY_REQUIRES_REVIEW',stopped:true};
 if(fs.existsSync(ledgerPath+'.lock')||(!ignoreIssuanceLock&&fs.existsSync(ledgerPath+'.issuance.lock')))return {ready:false,reason:'WAITING_FOR_SINGLE_SEND',retryAt:now+60000};return rollingWindow(rows,maxSendsPer24h,now,minimumIntervalMs);
 }catch{return {ready:false,reason:'LEDGER_REQUIRES_REVIEW',retryAt:now+60000}}}
function createMailFetchGuard(original,{env,ledgerPath,maxSendsPer24h=10,minimumIntervalMs=60000,clock=Date.now,control={halted:false}}){
 if(!validEnv(env)||!Number.isInteger(maxSendsPer24h)||maxSendsPer24h<1||maxSendsPer24h>10||!path.isAbsolute(ledgerPath))throw new DevMailPreSendError('DEV_MAIL_GUARD_CONFIG_INVALID');
 return async function(input,init){const url=urlOf(input);if(local(url))return original(input,init);
 if(!validEnv(env)||url.href!==endpoint||init?.method!=='POST'||init.redirect!=='error'||typeof init.body!=='string')throw new DevMailPreSendError('DEV_MAIL_GUARD_BLOCKED');
 let body;try{body=JSON.parse(init.body)}catch{throw new DevMailPreSendError('DEV_MAIL_GUARD_BLOCKED')}
 const allowedKeys=['from','to','subject','htmlbody','textbody','track_opens','track_clicks'];
 if(!body||Object.keys(body).some(k=>!allowedKeys.includes(k))||body.from?.address!==sender||!Array.isArray(body.to)||body.to.length!==1||body.to[0]?.email_address?.address!==recipient||body.track_opens!==false||body.track_clicks!==false)throw new DevMailPreSendError('DEV_MAIL_GUARD_BLOCKED');
 fs.mkdirSync(path.dirname(ledgerPath),{recursive:true,mode:0o700});
 // Synchronous exclusive lock coordinates reservations across app worker processes.
 const lock=ledgerPath+'.lock';let fd;try{fd=fs.openSync(lock,'wx',0o600)}catch{throw new DevMailPreSendError('DEV_MAIL_GUARD_BUSY')}
 try{const now=clock();let entries;try{entries=readReservations(ledgerPath,now)}catch{throw new DevMailPreSendError('DEV_MAIL_GUARD_LEDGER_INVALID')}
 if(control.halted||fs.existsSync(ledgerPath+'.halt'))throw new DevMailPreSendError('DEV_MAIL_GUARD_DELIVERY_REQUIRES_REVIEW');const gate=rollingWindow(entries,maxSendsPer24h,now,minimumIntervalMs);
 if(!gate.ready)throw new DevMailPreSendError(gate.reason==='WAITING_FOR_ROLLING_SEND_WINDOW'?'DEV_MAIL_GUARD_BUDGET_EXHAUSTED':'DEV_MAIL_GUARD_LOW_FREQUENCY_REQUIRED');
 fs.appendFileSync(ledgerPath,JSON.stringify({reserved:true,at:new Date(now).toISOString()})+'\n',{mode:0o600});fs.chmodSync(ledgerPath,0o600);
 // Hold the reservation lock through transport: one request at a time across processes.
 let response;try{response=await original(input,init)}catch(error){recordDeliveryHalt(ledgerPath,control);throw error}if(!response.ok)recordDeliveryHalt(ledgerPath,control);return response;
 }finally{fs.closeSync(fd);fs.unlinkSync(lock)}
 }
}
function createDevelopmentHooks(ledgerPath,maxSendsPer24h=10,control={halted:false}){
 let ownsBatch=false;
 return {
  readiness:()=>control.halted?{ready:false,reason:'DELIVERY_REQUIRES_REVIEW',stopped:true}:readSendWindow(ledgerPath,maxSendsPer24h,Date.now(),60000,ownsBatch),
  halt:()=>recordDeliveryHalt(ledgerPath,control),
  acquireBatch(){const lock=ledgerPath+'.issuance.lock';fs.mkdirSync(path.dirname(ledgerPath),{recursive:true,mode:0o700});let fd;try{fd=fs.openSync(lock,'wx',0o600)}catch{return null}ownsBatch=true;let released=false;return()=>{if(released)return;released=true;ownsBatch=false;fs.closeSync(fd);fs.unlinkSync(lock)}}
 };
}
function install(){if(!validEnv(process.env))throw new DevMailPreSendError('DEV_MAIL_GUARD_CONFIG_INVALID');const root=path.resolve(__dirname,'..');const ledgerPath=process.env.CP_DEV_MAIL_LEDGER_PATH||path.join(root,'.cp-dev-private','mail-ledger.jsonl'),maxSendsPer24h=Number(process.env.CP_DEV_MAIL_MAX_SENDS_PER_24H??10);const control={halted:false};globalThis.__cpDevelopmentAuthMail=createDevelopmentHooks(ledgerPath,maxSendsPer24h,control);globalThis.fetch=createMailFetchGuard(globalThis.fetch,{env:process.env,ledgerPath,maxSendsPer24h,control});
 for(const module of ['node:http','node:https'])for(const method of ['request','get']){const api=require(module),original=api[method];api[method]=function(input,...args){let url;try{url=typeof input==='string'||input instanceof URL?new URL(input):new URL('http://'+(input.hostname||input.host||'')+(input.path||'/'))}catch{throw new DevMailPreSendError('DEV_MAIL_GUARD_BLOCKED')}if(!local(url))throw new DevMailPreSendError('DEV_MAIL_GUARD_BLOCKED');return original.call(this,input,...args)}}
 const connect=require('node:net').Socket.prototype.connect;require('node:net').Socket.prototype.connect=function(...args){const a=args[0];const host=typeof a==='object'?a.host||a.hostname:typeof args[1]==='string'?args[1]:'localhost';if(host&&!['localhost','127.0.0.1','::1','cpaas.zoho.com'].includes(host))throw new DevMailPreSendError('DEV_MAIL_GUARD_BLOCKED');return connect.apply(this,args)};
}
module.exports={createMailFetchGuard,createDevelopmentHooks,validEnv,readSendWindow};if(process.env.CP_DEV_GMAIL_ONLY==='1')install();
