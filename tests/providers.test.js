import test from 'node:test';import assert from 'node:assert/strict';
import {geminiTranslate,translate} from '../extension/core/providers.js';
import {sanitizeSettings} from '../extension/core/settings.js';
import {createSttProvider} from '../extension/core/stt.js';
const base={text:'hello',source:'en',target:'ja',key:'fake-key',model:'gemini-test'};
test('Gemini request keeps key out of URL, treats user input as user content, parses text',async()=>{
  let seen;const out=await geminiTranslate({...base,fetchImpl:async(url,options)=>{seen={url,options};return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'こんにちは'}]}}]})};}});
  assert.equal(out,'こんにちは');assert.ok(!seen.url.includes('fake-key'));assert.equal(seen.options.headers['x-goog-api-key'],'fake-key');assert.equal(JSON.parse(seen.options.body).contents[0].parts[0].text,'hello');
});
for(const [status,code]of [[401,'AUTH'],[403,'AUTH'],[429,'RATE_OR_QUOTA'],[404,'MODEL'],[503,'PROVIDER']])test(`HTTP ${status} is sanitized as ${code}`,async()=>{await assert.rejects(geminiTranslate({...base,fetchImpl:async()=>({ok:false,status})}),e=>e.code===code&&!e.message.includes('fake-key'));});
test('blocked and truncated provider output never becomes insertable text',async()=>{await assert.rejects(geminiTranslate({...base,fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'partial'}]}}]})})}),e=>e.code==='INCOMPLETE');});
test('missing key never performs fetch',async()=>{await assert.rejects(geminiTranslate({...base,key:'',fetchImpl:()=>assert.fail('must not fetch')}),e=>e.code==='AUTH');});

test('legacy demo settings migrate to real providers without changing saved language preferences',()=>{
  const settings=sanitizeSettings({sttProvider:'demo',translationProvider:'demo',source:'ja'});
  assert.equal(settings.sttProvider,'deepgram');assert.equal(settings.translationProvider,'gemini');
  assert.equal(settings.source,'ja');assert.equal(settings.target,'en');
});
test('retired demo adapters cannot return canned speech or translations',async()=>{
  assert.throws(()=>createSttProvider('demo',{}),/Unsupported STT/);
  await assert.rejects(translate({text:'Thanks for streaming today!',source:'en',target:'ja'},{translationProvider:'demo'}),e=>e.code==='PROVIDER');
});
test('settings drop unknown fields, keys and unsupported providers',()=>{const s=sanitizeSettings({gemini:'secret',translationProvider:'evil',model:'../../other',source:'en',target:'en'});assert.equal(s.gemini,undefined);assert.equal(s.translationProvider,'gemini');assert.equal(s.target,'ja');assert.ok(s.model.startsWith('gemini-'));});
test('oversized request is refused before any provider call',async()=>{await assert.rejects(translate({text:'a'.repeat(4001),source:'en',target:'ja'},sanitizeSettings()),e=>e.code==='LENGTH');});
