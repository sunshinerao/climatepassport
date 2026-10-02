import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(prisma){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/passport-web/lib/server/auth-rate-limit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>n.includes('/prisma')?{getPrismaClient:()=>prisma}:require(n),Date});return exports.checkAuthRateLimit;}
const opts={limit:6,windowMs:600000};
test('parallel requests use atomic persistent increments and normalized shared address',async()=>{const rows=new Map();const check=load({authRequestLimit:{upsert:async({where,create})=>{assert.equal(where.key.includes('@'),false);const count=(rows.get(where.key)||0)+1;rows.set(where.key,count);assert.ok(create.windowStart instanceof Date);return {count};}}});const results=await Promise.all(Array.from({length:20},(_,i)=>check(i%2?' User@Example.invalid ':'user@example.invalid','auth-email-send',opts)));assert.equal(results.filter(r=>r.allowed).length,6);assert.equal(rows.size,1);await check('user@example.invalid','auth-login',opts);assert.equal(rows.size,2);});
test('missing database and backend failures fail closed with sanitized errors',async()=>{await assert.rejects(load(null)('u','s',opts),/AUTH_RATE_LIMIT_UNAVAILABLE/);await assert.rejects(load({authRequestLimit:{upsert:async()=>{throw Error('secret');}}})('u','s',opts),/^Error: AUTH_RATE_LIMIT_UNAVAILABLE$/);});
test('first insert unique collision gets one bounded retry',async()=>{let n=0;const check=load({authRequestLimit:{upsert:async()=>{if(++n===1)throw {code:'P2002'};return {count:2};}}});assert.equal((await check('u','s',opts)).remaining,4);assert.equal(n,2);});
test('invalid quotas rejected before database call',async()=>{await assert.rejects(load(null)('u','s',{limit:0,windowMs:1}),/INVALID_AUTH_RATE_LIMIT/);});
