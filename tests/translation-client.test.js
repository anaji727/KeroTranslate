import test from 'node:test';import assert from 'node:assert/strict';import {queuedTranslate} from '../extension/core/translation-client.js';
test('offscreen submits caption text to worker and returns usage; no direct HTTP',async()=>{
  const sent=[];globalThis.chrome={runtime:{async sendMessage(m){sent.push(m);return {ok:true,text:'translated',usage:{promptTokenCount:4}};}}};let usage;
  assert.equal(await queuedTranslate({sessionId:'capture',text:'original',target:'en',signal:new AbortController().signal},u=>usage=u),'translated');
  assert.equal(sent[0].type,'CAPTION_TRANSLATE');assert.equal(sent[0].id,'capture');assert.equal(sent[0].request.text,'original');assert.equal(usage.promptTokenCount,4);delete globalThis.chrome;
});
test('offscreen cancellation cancels the queued worker request and ignores a late result',async()=>{
  const sent=[];let finish;globalThis.chrome={runtime:{async sendMessage(m){sent.push(m);return m.type==='CAPTION_TRANSLATE'?new Promise(r=>finish=r):{ok:true};}}};
  const controller=new AbortController();const pending=queuedTranslate({sessionId:'capture',text:'original',target:'en',signal:controller.signal});const rejected=assert.rejects(pending,e=>e.name==='AbortError');
  controller.abort();finish({ok:true,text:'late'});await rejected;assert.equal(sent[1].type,'CAPTION_CANCEL');assert.equal(sent[1].requestId,sent[0].requestId);delete globalThis.chrome;
});
