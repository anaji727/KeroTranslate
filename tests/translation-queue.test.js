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
test('request interval defaults to one second and accepts only supported choices',()=>{
  assert.equal(sanitizeSettings().translationInterval,1000);assert.equal(sanitizeSettings({translationInterval:'12000'}).translationInterval,12000);assert.equal(sanitizeSettings({translationInterval:-1}).translationInterval,1000);
});

test('live interval changes reschedule waiting work without interrupting an active request',async()=>{
  const h=harness(),order=[];let finish;
  const first=h.queue.schedule({provider:'gemini',intervalMs:4000,run:()=>{order.push('first');return new Promise(r=>finish=r);}});await flush();
  const next=h.queue.schedule({provider:'gemini',intervalMs:4000,run:()=>order.push('next')});
  await h.tick(500);h.queue.updateInterval(1000);await h.tick(500);assert.deepEqual(order,['first']);
  finish();await first;await next;assert.deepEqual(order,['first','next']);
  const third=h.queue.schedule({provider:'gemini',intervalMs:1000,run:()=>order.push('third')});
  h.queue.updateInterval(6000);await h.tick(5999);assert.equal(order.length,2);await h.tick(1);await third;assert.equal(order.length,3);
});
test('changing the request interval never bypasses a provider cooldown',async()=>{
  const h=harness();
  await assert.rejects(h.queue.schedule({provider:'gemini',run:()=>{throw Object.assign(new Error('limit'),{code:'RATE_OR_QUOTA',retryAfterMs:5000});}}));await flush();
  h.queue.updateInterval(500);await h.tick(1000);
  await assert.rejects(h.queue.schedule({provider:'gemini',run:()=>assert.fail('cooldown bypassed')}),/4s/);
});

test('a comment transaction retains its lane for paced back-translation before queued captions',async()=>{
  const h=harness(),order=[];let finish;
  const batch=h.queue.schedule({provider:'gemini',intervalMs:1000,priority:1,run:async({nextRequest})=>{order.push('comment');await new Promise(r=>finish=r);await nextRequest();order.push('back');return 'done';}});await flush();
  const caption=h.queue.schedule({provider:'gemini',intervalMs:1000,run:()=>order.push('caption')});finish();await flush();await h.tick(999);assert.deepEqual(order,['comment']);await h.tick(1);assert.equal(await batch,'done');assert.deepEqual(order,['comment','back']);await h.tick(1000);await caption;assert.deepEqual(order,['comment','back','caption']);
});
test('cancelling a batch while waiting for back-translation releases the lane',async()=>{
  const h=harness(),controller=new AbortController();let backCalls=0;
  const batch=h.queue.schedule({provider:'gemini',signal:controller.signal,intervalMs:1000,run:async({nextRequest})=>{await nextRequest();backCalls++;}});await flush();const rejected=assert.rejects(batch,e=>e.name==='AbortError');controller.abort();await rejected;await flush();
  const next=h.queue.schedule({provider:'gemini',intervalMs:1000,run:()=>42});await h.tick(1000);assert.equal(await next,42);assert.equal(backCalls,0);
});
test('a failed job and overflow rejection do not poison later queued work',async()=>{
  const h=harness();let fail;const failed=h.queue.schedule({provider:'gemini',intervalMs:0,run:()=>new Promise((_r,reject)=>fail=reject)});await flush();
  const waiting=Array.from({length:50},(_,i)=>h.queue.schedule({provider:'gemini',intervalMs:0,run:()=>i}));
  await assert.rejects(h.queue.schedule({provider:'gemini',run:()=>assert.fail('overflow sent')}),e=>e.code==='BUSY');
  const rejected=assert.rejects(failed,/network/);fail(new Error('network'));await rejected;assert.deepEqual(await Promise.all(waiting),Array.from({length:50},(_,i)=>i));assert.equal(await h.queue.schedule({provider:'gemini',intervalMs:0,run:()=>99}),99);
});
test('default timers never invoke native browser timer functions with the queue as receiver',async t=>{
  const realSet=setTimeout,realClear=clearTimeout;
  t.mock.method(globalThis,'setTimeout',function(fn,ms){assert.equal(this,globalThis);return realSet(fn,ms);});
  t.mock.method(globalThis,'clearTimeout',function(id){assert.equal(this,globalThis);return realClear(id);});
  const queue=new TranslationQueue();assert.equal(await queue.schedule({provider:'gemini',intervalMs:10,run:()=>1}),1);assert.equal(await queue.schedule({provider:'gemini',intervalMs:10,run:()=>2}),2);
});


test('explicit native timers retain the global receiver during back-translation waits',async()=>{
  const queue=new TranslationQueue({setTimer:function(fn,ms){assert.equal(this,globalThis);return setTimeout(fn,ms);},clearTimer:function(id){assert.equal(this,globalThis);clearTimeout(id);}});
  const result=await queue.schedule({provider:'gemini',intervalMs:10,run:async({nextRequest})=>{await nextRequest();return 'back translated';}});
  assert.equal(result,'back translated');
});
test('a timer failure during a repeated back-translation wait rejects and releases the lane',async()=>{
  let time=0,callback,calls=0;const queue=new TranslationQueue({now:()=>time,setTimer:fn=>{if(++calls===2)throw new TypeError('Illegal invocation');callback=fn;return calls;},clearTimer(){}});
  const batch=queue.schedule({provider:'gemini',intervalMs:1000,run:async({nextRequest})=>{await nextRequest();return 'must not finish';}});
  const rejected=assert.rejects(batch,/Illegal invocation/);await flush();time=500;assert.doesNotThrow(()=>callback());await rejected;await flush();
  time=1000;assert.equal(await queue.schedule({provider:'gemini',intervalMs:0,run:()=>42}),42);
});
test('a timer failure while dispatching queued work rejects without an unhandled timer exception',async()=>{
  let time=0,callback,calls=0;const queue=new TranslationQueue({now:()=>time,setTimer:fn=>{if(++calls===2)throw new TypeError('Illegal invocation');callback=fn;return calls;},clearTimer(){}});
  await queue.schedule({provider:'gemini',intervalMs:1000,run:()=>1});await flush();
  const pending=queue.schedule({provider:'gemini',intervalMs:1000,run:()=>2});const rejected=assert.rejects(pending,/Illegal invocation/);
  time=500;assert.doesNotThrow(()=>callback());await rejected;time=1000;assert.equal(await queue.schedule({provider:'gemini',intervalMs:0,run:()=>3}),3);
});
