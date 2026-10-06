import test from 'node:test';import assert from 'node:assert/strict';
import {geminiTranslate,demoTranslate,translate} from '../extension/core/providers.js';
import {sanitizeSettings} from '../extension/core/settings.js';
const base={text:'hello',source:'en',target:'ja',key:'fake-key',model:'gemini-test'};
test('Gemini request keeps key out of URL, treats user input as user content, parses text',async()=>{
  let seen;const out=await geminiTranslate({...base,fetchImpl:async(url,options)=>{seen={url,options};return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'こんにちは'}]}}]})};}});
  assert.equal(out,'こんにちは');assert.ok(!seen.url.includes('fake-key'));assert.equal(seen.options.headers['x-goog-api-key'],'fake-key');assert.equal(JSON.parse(seen.options.body).contents[0].parts[0].text,'hello');
});
for(const [status,code]of [[401,'AUTH'],[403,'AUTH'],[429,'RATE_OR_QUOTA'],[404,'MODEL'],[503,'PROVIDER']])test(`HTTP ${status} is sanitized as ${code}`,async()=>{await assert.rejects(geminiTranslate({...base,fetchImpl:async()=>({ok:false,status})}),e=>e.code===code&&!e.message.includes('fake-key'));});
test('blocked and truncated provider output never becomes insertable text',async()=>{await assert.rejects(geminiTranslate({...base,fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'partial'}]}}]})})}),e=>e.code==='INCOMPLETE');});
test('missing key never performs fetch',async()=>{await assert.rejects(geminiTranslate({...base,key:'',fetchImpl:()=>assert.fail('must not fetch')}),e=>e.code==='AUTH');});
test('demo does not pretend arbitrary input is a translation',async()=>{await assert.rejects(demoTranslate({text:'unknown arbitrary text',target:'ja'}),e=>e.code==='DEMO_ONLY');});
test('demo supports both directions',async()=>{assert.equal(await demoTranslate({text:'今日も配信ありがとう！',target:'en'}),'Thanks for streaming today!');assert.equal(await demoTranslate({text:'Thanks for streaming today!',target:'ja'}),'今日も配信ありがとう！');});
test('settings drop unknown fields, keys and unsupported providers',()=>{const s=sanitizeSettings({gemini:'secret',translationProvider:'evil',model:'../../other',source:'en',target:'en'});assert.equal(s.gemini,undefined);assert.equal(s.translationProvider,'demo');assert.equal(s.target,'ja');assert.ok(s.model.startsWith('gemini-'));});
test('oversized request is refused before any provider call',async()=>{await assert.rejects(translate({text:'a'.repeat(4001),source:'en',target:'ja'},sanitizeSettings()),e=>e.code==='LENGTH');});
