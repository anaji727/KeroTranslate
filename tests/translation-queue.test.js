import test from 'node:test';import assert from 'node:assert/strict';
import {TranslationQueue} from '../extension/core/translation-queue.js';
import {checkProviderResponse} from '../extension/core/providers.js';
import {sanitizeSettings} from '../extension/core/settings.js';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function harness(){let now=0,id=0;const timers=new Map();const queue=new TranslationQueue({now:()=>now,setTimer:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimer:id=>timers.delete(id)});return {queue,async tick(ms){now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn();}await flush();}};}
test('captions and both comment stages share one lane, paced and prioritized at dispatch',async()=>{
  const h=harness(),order=[];let finish;
  const run=(name,priority=0)=>h.queue.schedule({provider:'gemini',intervalMs:4000,priority,run:()=>{order.push(name);return name==='caption-1'?new Promise(r=>finish=r):name;}});
  const first=run('caption-1');await flush();const caption=run('caption-2'),comment=run('comment',1);await flush();assert.deepEqual(order,['caption-1']);
  finish('first');await first;await flush();await h.tick(3999);assert.equal(order.length,1);await h.tick(1);await comment;
  const back=run('re-MTL',1);await h.tick(4000);await back;await h.tick(4000);await caption;
  assert.deepEqual(order,['caption-1','comment','re-MTL','caption-2']);
});
test('different providers can run independently',async()=>{
  const h=harness();let finish;const a=h.queue.schedule({provider:'gemini',run:()=>new Promise(r=>finish=r)});
  assert.equal(await h.queue.schedule({provider:'deepl',run:()=>42}),42);finish(1);await a;
});
test('cancelling a queued job prevents sending; aborting an active job does not release the lane early',async()=>{
  const h=harness(),a=new AbortController(),b=new AbortController();let finish,nextCalls=0;
  const first=h.queue.schedule({provider:'gemini',signal:a.signal,intervalMs:0,run:()=>new Promise(r=>finish=r)});await flush();
  const waiting=h.queue.schedule({provider:'gemini',signal:b.signal,intervalMs:0,run:()=>assert.fail('cancelled request sent')});const rejected=assert.rejects(waiting,e=>e.name==='AbortError');b.abort();await rejected;
  a.abort();const next=h.queue.schedule({provider:'gemini',intervalMs:0,run:()=>++nextCalls});await flush();assert.equal(nextCalls,0);
  finish('ignored by caller');await first;await next;assert.equal(nextCalls,1);
});
test('429 pauses the entire provider lane and never automatically retries the failed request',async()=>{
  const h=harness();let fail,calls=0;
  const first=h.queue.schedule({provider:'gemini',intervalMs:0,run:()=>{calls++;return new Promise((_r,reject)=>fail=reject);}});await flush();
  const second=h.queue.schedule({provider:'gemini',intervalMs:0,run:()=>calls++});const checks=[assert.rejects(first,e=>e.code==='RATE_OR_QUOTA'),assert.rejects(second,e=>e.code==='RATE_OR_QUOTA')];
  fail(Object.assign(new Error('limit'),{code:'RATE_OR_QUOTA',retryAfterMs:5000}));await Promise.all(checks);await flush();
  await assert.rejects(h.queue.schedule({provider:'gemini',run:()=>calls++}),/5s/);assert.equal(calls,1);
  await h.tick(5000);await h.queue.schedule({provider:'gemini',run:()=>++calls});assert.equal(calls,2);
});
test('retry-after seconds/date are honored, absent headers use 30 seconds',()=>{
  const get=value=>{try{checkProviderResponse({ok:false,status:429,headers:{get:()=>value}});}catch(e){return e;}};
  assert.equal(get('12').retryAfterMs,12000);assert.equal(get(null).retryAfterMs,30000);
  const dated=get(new Date(Date.now()+60000).toUTCString()).retryAfterMs;assert.ok(dated>=59000&&dated<=60000);
  assert.equal(get('malformed').retryAfterMs,30000);
});
test('request interval defaults conservatively and accepts only supported choices',()=>{
  assert.equal(sanitizeSettings().translationInterval,4000);assert.equal(sanitizeSettings({translationInterval:'12000'}).translationInterval,12000);assert.equal(sanitizeSettings({translationInterval:-1}).translationInterval,4000);
});
