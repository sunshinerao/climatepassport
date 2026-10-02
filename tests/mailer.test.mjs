import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
const source=fs.readFileSync('apps/passport-web/lib/server/mailer.ts','utf8');
const policy={};vm.runInNewContext(ts.transpileModule(fs.readFileSync("apps/passport-web/lib/server/mail-recipient-policy.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:policy,process:{env:{}}});
const exports={};const developmentHaltState={calls:0};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n==="./mail-recipient-policy")return policy;throw Error("unexpected module")},URL,AbortController,setTimeout,clearTimeout,__cpDevelopmentAuthMail:{halt(){developmentHaltState.calls++;}},process:{env:{}},fetch(){throw Error('LIVE FETCH FORBIDDEN');}});
const {sendTransactionalMail:send}=exports;
const mail={to:'test@example.invalid',subject:'Synthetic verification',html:'<p>Synthetic only</p>',text:'Synthetic only'};
const zoho={MAIL_PROVIDER:'zoho',MAIL_FROM:'Climate Passport <no-reply@example.invalid>',ZOHO_MAIL_ENDPOINT:'https://cpaas.zoho.com/v1.1/email',ZOHO_MAIL_TOKEN:'synthetic-test-token'};
const resend={MAIL_PROVIDER:'resend',MAIL_FROM:'no-reply@example.invalid',RESEND_API_KEY:'synthetic-resend-token'};
const accepted={data:[{code:'EM_104',message:'OK'}],message:'OK',request_id:'req-synthetic-1'};
const reply=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const rejectCode=(promise,code)=>assert.rejects(promise,e=>e.code===code&&e.message===code&&!String(e.stack).includes('synthetic-test-token'));

test('Zoho sends exact documented wire shape and accepts request ID, not delivery/SMTP ID',async()=>{
 let calls=0;const receipt=await send(mail,{env:zoho,fetch:async(url,init)=>{calls++;assert.equal(url,zoho.ZOHO_MAIL_ENDPOINT);assert.equal(init.headers.Authorization,'Zoho-enczapikey synthetic-test-token');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');const body=JSON.parse(init.body);assert.deepEqual(body.from,{address:'no-reply@example.invalid',name:'Climate Passport'});assert.deepEqual(body.to,[{email_address:{address:mail.to}}]);assert.equal(body.htmlbody,mail.html);assert.equal(body.textbody,mail.text);assert.equal(body.track_clicks,false);return reply(accepted)}});
 assert.equal(calls,1);assert.equal(receipt.status,'accepted');assert.equal(receipt.providerRequestId,'req-synthetic-1');assert.equal(receipt.providerMessageId,undefined);assert.equal(receipt.delivered,undefined);
});
test('Resend config selects only Resend and validates provider message ID',async()=>{
 const receipt=await send(mail,{env:resend,fetch:async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(init.headers.Authorization,'Bearer synthetic-resend-token');assert.deepEqual(JSON.parse(init.body).to,[mail.to]);return reply({id:'synthetic-message-1'})}});
 assert.equal(receipt.providerMessageId,'synthetic-message-1');assert.equal(receipt.providerRequestId,undefined);
});
test('legacy unset MAIL_PROVIDER defaults to Resend but requires explicit sender',async()=>{
 const env={...resend};delete env.MAIL_PROVIDER;assert.equal((await send(mail,{env,fetch:async()=>reply({id:'m-1'})})).provider,'resend');delete env.MAIL_FROM;await rejectCode(send(mail,{env}),'MAIL_CONFIG_INVALID');
});
test('invalid/missing configuration never contacts any provider',async()=>{
 for(const env of [{...zoho,MAIL_PROVIDER:'smtp'},{...zoho,MAIL_FROM:''},{...zoho,MAIL_FROM:'unsafe\r\nBcc:x@example.invalid'},{...zoho,ZOHO_MAIL_TOKEN:''},{...zoho,ZOHO_MAIL_ENDPOINT:undefined},{...zoho,ZOHO_MAIL_ENDPOINT:'https://attacker.example/v1.1/email'},{...zoho,ZOHO_MAIL_ENDPOINT:'https://cpaas.zoho.com.attacker.example/v1.1/email'},{...zoho,ZOHO_MAIL_ENDPOINT:'http://cpaas.zoho.com/v1.1/email'},{...zoho,ZOHO_MAIL_ENDPOINT:'https://user:secret@cpaas.zoho.com/v1.1/email'},{...zoho,ZOHO_MAIL_ENDPOINT:'https://cpaas.zoho.com/v1.1/email?token=secret'},{...zoho,ZOHO_MAIL_ENDPOINT:'https://cpaas.zoho.com/v1.1/email#secret'},{...zoho,ZOHO_MAIL_ENDPOINT:'https://cpaas.zoho.com/other'}])await rejectCode(send(mail,{env,fetch:()=>assert.fail('must not send')}),'MAIL_CONFIG_INVALID');
});
test('invalid recipient/subject/content rejected before send',async()=>{
 for(const option of [{...mail,to:'a@example.invalid,b@example.invalid'},{...mail,subject:'x\r\nInjected'},{...mail,html:''},{...mail,text:''}])await rejectCode(send(option,{env:zoho,fetch:()=>assert.fail('must not send')}),'MAIL_PAYLOAD_INVALID');
});
test('expired/revoked token HTTP401 and rejection HTTP429 do not fallback',async()=>{
 for(const status of [401,403,429,500]){let calls=0;await rejectCode(send(mail,{env:{...zoho,RESEND_API_KEY:'available-but-not-used'},fetch:async()=>{calls++;return reply({message:'synthetic-test-token'},status)}}),'MAIL_HTTP_REJECTED');assert.equal(calls,1)}
});
test('HTTP200 provider error is failure even with apparent IDs',async()=>{
 for(const body of [{...accepted,message:'error'},{...accepted,error:{secret:'synthetic-test-token'}},{...accepted,data:[{code:'EM_999',message:'Invalid token'}]},{...accepted,data:[{code:'EM_104',message:'error'}]}])await rejectCode(send(mail,{env:zoho,fetch:async()=>reply(body)}),'MAIL_PROVIDER_REJECTED');
 await rejectCode(send(mail,{env:resend,fetch:async()=>reply({id:'looks-valid',error:{message:'rejected'}})}),'MAIL_PROVIDER_REJECTED');
});
test('malformed/empty/partial success responses are never accepted',async()=>{
 for(const body of [null,[],{}, {...accepted,data:[]},{...accepted,data:[accepted.data[0],{code:'bad'}]},{...accepted,request_id:undefined},{...accepted,request_id:'bad\nheader'}])await rejectCode(send(mail,{env:zoho,fetch:async()=>reply(body)}),'MAIL_RESPONSE_INVALID');
 await rejectCode(send(mail,{env:resend,fetch:async()=>reply({})}),'MAIL_RESPONSE_INVALID');
 await rejectCode(send(mail,{env:zoho,fetch:async()=>({ok:true,json:async()=>{throw Error('body secret')}})}),'MAIL_RESPONSE_INVALID');
});
test('network errors expose fixed safe code without original secret-bearing cause',async()=>{
 await assert.rejects(send(mail,{env:zoho,fetch:async()=>{throw Error('synthetic-test-token https://private.invalid')}}),e=>e.code==='MAIL_TRANSPORT_FAILED'&&e.cause===undefined&&!String(e.stack).includes('synthetic-test-token'));
});
test('timeout aborts hung transport, does not retry/fallback, ignores late acceptance',async()=>{
 let calls=0,signal,finish;const result=send(mail,{env:zoho,timeoutMs:10,fetch:async(_url,init)=>{calls++;signal=init.signal;return new Promise(resolve=>{finish=resolve})}});
 await rejectCode(result,'MAIL_TIMEOUT');assert.equal(calls,1);assert.equal(signal.aborted,true);finish(reply(accepted));await Promise.resolve();assert.equal(calls,1);
});
test('timeout also covers response body, not just headers',async()=>{
 await rejectCode(send(mail,{env:zoho,timeoutMs:10,fetch:async()=>({ok:true,json:()=>new Promise(()=>{})})}),'MAIL_TIMEOUT');
});
test('abort-aware transport remains classified timeout',async()=>{
 await rejectCode(send(mail,{env:zoho,timeoutMs:10,fetch:async(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted'))))}),'MAIL_TIMEOUT');
});

test('worker outcome classification never retries ambiguous transport acceptance',async()=>{
 for(const [status,outcome] of [[400,'rejected'],[401,'rejected'],[429,'rejected'],[408,'unknown'],[500,'unknown'],[502,'unknown']])await assert.rejects(send(mail,{env:zoho,fetch:async()=>reply({},status)}),e=>e.outcome===outcome);
 await assert.rejects(send(mail,{env:{...zoho,MAIL_FROM:''}}),e=>e.outcome==='not-attempted');
 await assert.rejects(send(mail,{env:zoho,fetch:async()=>reply({...accepted,message:'error'})}),e=>e.outcome==='unknown');
 await assert.rejects(send(mail,{env:zoho,fetch:async()=>reply({data:[{code:'EM_999',message:'denied'}]})}),e=>e.outcome==='rejected');
 await assert.rejects(send(mail,{env:zoho,fetch:async()=>reply({...accepted,data:[{code:'EM_104',message:'malformed'}]})}),e=>e.outcome==='unknown');
 await assert.rejects(send(mail,{env:zoho,timeoutMs:10,fetch:async()=>new Promise(()=>{})}),e=>e.outcome==='unknown');
});

// A numeric 201, apparent ID, wrong nesting or approximate success code is not
// acceptance; the last real attempt is instrumented before compatibility changes.
test('Zoho 201 still requires exact official acknowledgement shape',async()=>{
 assert.equal((await send(mail,{env:zoho,fetch:async()=>reply(accepted,201)})).status,'accepted');
 for(const body of [{...accepted,data:[{code:'EM104',message:'OK'}]},{...accepted,error_code:'EM_999'},{...accepted,data:[{...accepted.data[0],error_code:'EM_999'}]}])await rejectCode(send(mail,{env:zoho,fetch:async()=>reply(body,201)}),'MAIL_PROVIDER_REJECTED');
 for(const body of [{request_id:'synthetic'}, {code:'EM_104',message:'OK',request_id:'synthetic'}, {...accepted,request_id:undefined}])await rejectCode(send(mail,{env:zoho,fetch:async()=>reply(body,201)}),'MAIL_RESPONSE_INVALID');
 assert.equal((await send(mail,{env:zoho,fetch:async()=>reply({...accepted,data:[{code:'EM_104',message:'Email request received'}]},201)})).status,'accepted');
});

// Captured only enum/structure/message-equality booleans from real request #2,
// never provider raw body or a secret. Existing UNKNOWN challenges stay revoked.
test('observed Zoho 201 acknowledgement accepts only explicit success and rejects mixtures',async()=>{
 const body={message:'OK',data:[{code:'EM_104',message:'Email request received',additional_info:[]}],request_id:'synthetic-observed-201',object:'email'};
 assert.equal((await send(mail,{env:zoho,fetch:async()=>reply(body,201)})).providerRequestId,'synthetic-observed-201');
 for(const bad of [{...body,message:'error'}, {...body,error_code:'EM_999'}, {...body,data:[{...body.data[0],error_code:'EM_999'}]}, {...body,data:[{...body.data[0],message:{toString:()=> 'Email request received'}}]}, {...body,data:[{...body.data[0],message:'unexpected'}]}])await rejectCode(send(mail,{env:zoho,fetch:async()=>reply(bad,201)}),'MAIL_PROVIDER_REJECTED');
 for(const bad of [{...body,request_id:undefined}, {...body,message:undefined}, {...body,data:[body.data[0],{code:'EM_999'}]}])await rejectCode(send(mail,{env:zoho,fetch:async()=>reply(bad,201)}),'MAIL_RESPONSE_INVALID');
});

test('configured recipient restriction blocks provider fetch and test-outbox persistence before side effects',async()=>{
 let calls=0;const env={...zoho,MAIL_RECIPIENT_ALLOWLIST:'sunshine.rao@gmail.com',CP_DEV_GMAIL_ONLY:'1'};
 for(const to of ['other@example.invalid','sunshine.rao+test@gmail.com','sunshine.rao@gmail.com,other@example.invalid'])await rejectCode(send({...mail,to},{env,fetch:async()=>{calls++;return reply(accepted)}}),'MAIL_RECIPIENT_NOT_ALLOWED');
 for(const allowlist of ['', ' ', 'bad', 'sunshine.rao@gmail.com,'])await rejectCode(send({...mail,to:'sunshine.rao@gmail.com'},{env:{...env,MAIL_RECIPIENT_ALLOWLIST:allowlist},fetch:async()=>{calls++;return reply(accepted)}}),'MAIL_RECIPIENT_NOT_ALLOWED');
 await rejectCode(send(mail,{env:{CP_TEST_ENV_ID:'climate-passport-isolated-test',MAIL_TRANSPORT:'test-outbox',MAIL_TEST_OUTBOX_PATH:'/must-not-write',MAIL_RECIPIENT_ALLOWLIST:'sunshine.rao@gmail.com'},fetch:async()=>{calls++}}),'MAIL_RECIPIENT_NOT_ALLOWED');
 await rejectCode(send({...mail,to:'sunshine.rao@gmail.com'},{env:{...zoho,CP_DEV_GMAIL_ONLY:'1'},fetch:async()=>{calls++}}),'MAIL_RECIPIENT_NOT_ALLOWED');
 assert.equal(calls,0);
 assert.equal((await send({...mail,to:'sunshine.rao@gmail.com'},{env,fetch:async()=>{calls++;return reply(accepted)}})).status,'accepted');assert.equal(calls,1);
});

test('development provider denial, uncertain acknowledgement and body timeout request a persistent stop; pre-send waits do not',async()=>{
 const env={...zoho,CP_DEV_GMAIL_ONLY:'1',MAIL_RECIPIENT_ALLOWLIST:'sunshine.rao@gmail.com'};const option={...mail,to:'sunshine.rao@gmail.com'};
 for(const transport of [async()=>reply({},429),async()=>reply({data:[{code:'EM_999',message:'denied'}]}),async()=>({ok:true,json:()=>new Promise(()=>{})})]){const before=developmentHaltState.calls;await assert.rejects(send(option,{env,timeoutMs:10,fetch:transport}));assert.equal(developmentHaltState.calls,before+1)}
 const before=developmentHaltState.calls;await send(option,{env,fetch:async()=>reply(accepted)});assert.equal(developmentHaltState.calls,before);
 await assert.rejects(send(option,{env,fetch:async()=>{throw Object.assign(Error('synthetic window wait'),{name:'DevMailPreSendError',code:'DEV_MAIL_GUARD_BUDGET_EXHAUSTED',outcome:'not-attempted'})}}),e=>e.outcome==='not-attempted');assert.equal(developmentHaltState.calls,before);
});
