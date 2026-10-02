import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
const compiled=ts.transpileModule(fs.readFileSync('apps/passport-web/components/auth-email-forms.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function submitForm(name,code,token){
 const states=name==='VerifyEmailForm'?['person@example.test',token,code,'owner-new-password','','',false,false]:['person@example.test',token,code,'new-password','','',false];
 const calls=[],redirects=[];const sandbox={exports:{},module:{exports:{}},require:name=>{
  if(name==='react')return {useState:()=>[states.shift(),()=>{}]};
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='next/link')return {default:'a'};throw Error('Unexpected module '+name);
 },fetch:async(url,options)=>{calls.push({url,payload:JSON.parse(options.body)});return {ok:true,json:async()=>({ok:true})};},window:{location:{assign:value=>redirects.push(value)}}};
 sandbox.module.exports=sandbox.exports;vm.runInNewContext(compiled,sandbox);
 const form=sandbox.exports[name]({locale:'en'});assert.equal(form.type,'form');await form.props.onSubmit({preventDefault(){}});return {calls,redirects};
}
for(const form of ['VerifyEmailForm','ResetPasswordForm']){
 test(`${form}: explicitly entered code replaces prefilled URL token`,async()=>{const {calls}=await submitForm(form,' 123456 ','url-token-value');assert.equal(calls.length,1);assert.equal(calls[0].payload.code,'123456');assert.equal(Object.hasOwn(calls[0].payload,'token'),false);});
 test(`${form}: empty code retains only trimmed link token`,async()=>{const {calls}=await submitForm(form,'  ',' url-token-value ');assert.equal(calls[0].payload.token,'url-token-value');assert.equal(Object.hasOwn(calls[0].payload,'code'),false);});
 test(`${form}: invalid entered code is not silently replaced by valid token`,async()=>{const {calls}=await submitForm(form,'bad-code','url-token-value');assert.equal(calls[0].payload.code,'bad-code');assert.equal(Object.hasOwn(calls[0].payload,'token'),false);});
}
test('verification fallback redirects to login without assuming session',async()=>{const {redirects}=await submitForm('VerifyEmailForm','','url-token-value');assert.deepEqual(redirects,['/en/auth/login']);});

test('verification submits owner-chosen password with ownership credential',async()=>{const {calls}=await submitForm('VerifyEmailForm','123456','url-token-value');assert.equal(calls[0].payload.password,'owner-new-password');assert.equal(calls[0].payload.code,'123456');assert.equal(Object.hasOwn(calls[0].payload,'token'),false);});
