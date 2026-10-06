import test from 'node:test';import assert from 'node:assert/strict';
import {Composer} from '../extension/core/composer.js';
const turn=()=>new Promise(r=>setTimeout(r,0));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function controlled(){const calls=[];const c=new Composer({debounce:100000,translate:request=>{const d=deferred();calls.push({...d,request});return d.promise;}});return {c,calls};}
test('READY is reached only after the corresponding back translation',async()=>{
  const {c,calls}=controlled();c.input('first');const task=c.run();assert.equal(c.state.phase,'TRANSLATING');assert.equal(c.canInsert('mtl'),false);
  calls[0].resolve('translated');await turn();assert.equal(c.state.phase,'BACK_TRANSLATING');assert.equal(c.canInsert('mtl'),false);assert.equal(calls[1].request.text,'translated');
  calls[1].resolve('returned');await task;assert.equal(c.state.phase,'READY');assert.equal(c.canInsert('mtl'),true);c.dispose();
});
test('late responses never replace a newer original',async()=>{
  const {c,calls}=controlled();c.input('old');const task=c.run();c.input('new');assert.equal(calls[0].request.signal.aborted,true);calls[0].resolve('old result');await task;
  assert.equal(c.state.original,'new');assert.equal(c.state.mtl,'');assert.equal(c.state.phase,'STALE');assert.equal(calls.length,1);c.dispose();
});
test('old back translation is ignored after a direction change',async()=>{
  const {c,calls}=controlled();c.input('first');const task=c.run();calls[0].resolve('translation');await turn();c.configure({source:'en'});calls[1].resolve('obsolete');await task;assert.equal(c.state.back,'');assert.equal(c.canInsert('mtl'),false);assert.equal(c.state.target,'ja');c.dispose();
});
test('IME composition does not issue requests until composition ends',async()=>{
  let n=0;const c=new Composer({debounce:1,translate:async()=>{n++;return 'text';}});c.compositionStart();c.input('に');await new Promise(r=>setTimeout(r,15));await c.run();assert.equal(n,0);c.compositionEnd('日本語');await new Promise(r=>setTimeout(r,15));assert.equal(n,2);c.dispose();
});
test('manual MTL editing regenerates only re-MTL',async()=>{
  const {c,calls}=controlled();c.input('original');const task=c.run();calls[0].resolve('translation');await turn();calls[1].resolve('back');await task;
  c.editMtl('my edit');assert.equal(c.canInsert('mtl'),false);const back=c.run(true);assert.equal(calls[2].request.text,'my edit');calls[2].resolve('my edit back');await back;assert.equal(c.state.mtl,'my edit');assert.equal(c.state.back,'my edit back');c.dispose();
});
test('stale MTL cannot be manually promoted to current',async()=>{
  const {c}=controlled();c.input('new');c.editMtl('old translation');assert.equal(c.state.mtl,'');assert.equal(c.canInsert('mtl'),false);c.dispose();
});
test('error retains original and retries the failed back-translation stage',async()=>{
  const {c,calls}=controlled();c.input('original');const task=c.run();calls[0].resolve('translation');await turn();calls[1].reject(new Error('quota'));await task;assert.equal(c.state.original,'original');assert.equal(c.state.phase,'ERROR');assert.equal(c.canInsert('original'),true);assert.equal(c.canInsert('mtl'),false);
  const retry=c.retry();assert.equal(calls[2].request.text,'translation');calls[2].resolve('back');await retry;assert.equal(c.state.phase,'READY');c.dispose();
});
test('empty input cancels requests and clears all derived text',async()=>{
  const {c,calls}=controlled();c.input('original');const task=c.run();c.input('');calls[0].resolve('late');await task;assert.equal(c.state.phase,'EMPTY');assert.equal(c.state.mtl,'');assert.equal(c.canInsert('original'),false);c.dispose();
});
test('disposal prevents updates and more requests',async()=>{
  const {c,calls}=controlled();c.input('original');const task=c.run();c.dispose();calls[0].resolve('late');await task;await c.run();assert.equal(calls.length,1);assert.equal(c.state.mtl,'');
});
