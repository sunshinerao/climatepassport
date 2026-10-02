import assert from 'node:assert/strict';import test from 'node:test';
import {startAutomaticAuthMailConsumer} from '../scripts/dev-auth-mail-consumer.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('automatic consumer delivers a newly eligible request once without manual invocation',async()=>{
 let eligible=true,calls=0;const actor=startAutomaticAuthMailConsumer({intervalMs:2,nextReady:async()=>eligible,sendWindow:()=>({ready:true}),sendBatch:async()=>{calls++;eligible=false;return true}});await wait(25);actor.stop();await actor.done;assert.equal(calls,1);
});
test('cooldown and exhausted budget do not call worker or mutate credentials',async()=>{
 let calls=0;const states=[];const actor=startAutomaticAuthMailConsumer({intervalMs:2,nextReady:async()=>true,sendWindow:()=>({ready:false,reason:'WAITING_FOR_ROLLING_SEND_WINDOW'}),sendBatch:async()=>{calls++;return true},onState:s=>states.push(s)});await wait(20);actor.stop();await actor.done;assert.equal(calls,0);assert.equal(states.filter(s=>s==='WAITING_FOR_ROLLING_SEND_WINDOW').length,1);
});
test('stop aborts an in-flight request and never starts another worker invocation',async()=>{
 let calls=0;const actor=startAutomaticAuthMailConsumer({intervalMs:2,nextReady:async()=>true,sendWindow:()=>({ready:true}),sendBatch:async signal=>{calls++;await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));return false}});await wait(10);actor.stop();await actor.done;await wait(10);assert.equal(calls,1);
});
test('uncertain request is not repeated when its durable job is no longer pending',async()=>{
 let eligible=true,calls=0;const actor=startAutomaticAuthMailConsumer({intervalMs:2,nextReady:async()=>eligible,sendWindow:()=>({ready:true}),sendBatch:async()=>{calls++;eligible=false;throw Error('synthetic request timeout')}});await wait(25);actor.stop();await actor.done;assert.equal(calls,1);
});

test('rolling wait uses a wake-up delay rather than polling the worker and supports cancellation',async()=>{
 let checks=0,calls=0;const actor=startAutomaticAuthMailConsumer({intervalMs:1,nextReady:async()=>{checks++;return true},sendWindow:()=>({ready:false,reason:'WAITING_FOR_ROLLING_SEND_WINDOW',retryAt:Date.now()+86400000}),sendBatch:async()=>{calls++;return true}});await wait(30);actor.stop();await actor.done;assert.equal(checks,1);assert.equal(calls,0);
});
test('persisted provider halt stops the consumer with no further eligibility checks or HTTP calls',async()=>{
 let checks=0,calls=0;const states=[];const actor=startAutomaticAuthMailConsumer({intervalMs:1,nextReady:async()=>{checks++;return true},sendWindow:()=>({ready:false,reason:'DELIVERY_REQUIRES_REVIEW',stopped:true}),sendBatch:async()=>{calls++;return true},onState:s=>states.push(s)});await actor.done;assert.equal(checks,1);assert.equal(calls,0);assert.ok(states.includes('DELIVERY_REQUIRES_REVIEW'));
});
