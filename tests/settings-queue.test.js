import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {initializeKeyStorage} from '../extension/core/key-storage.js';
import {sanitizeSettings} from '../extension/core/settings.js';
import {TranslationQueue} from '../extension/core/translation-queue.js';
import {ProviderError} from '../extension/core/providers.js';
const source=(await readFile(new URL('../extension/background.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
const flush=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
async function harness(interval){
  let time=0,id=0,listener,limit=false;const timers=new Map(),starts=[];
  const data={local:{settings:{translationProvider:'gemini',translationInterval:interval},keys:{gemini:'test-key'}},session:{}};
  const area=name=>({async setAccessLevel(){},async get(key){return {[key]:data[name][key]};},async set(value){Object.assign(data[name],value);},async remove(key){delete data[name][key];}});
  const context={Promise,Map,AbortController,DOMException,console,initializeKeyStorage,sanitizeSettings,
    TranslationQueue:class extends TranslationQueue{constructor(){super({now:()=>time,setTimer:(fn,ms)=>{const key=++id;timers.set(key,{fn,at:time+ms});return key;},clearTimer:key=>timers.delete(key)});}},
    translate:async()=>{starts.push(time);if(limit){const error=new ProviderError('RATE_OR_QUOTA','limited');error.retryAfterMs=30000;throw error;}return 'translated';},
    chrome:{storage:{local:area('local'),session:area('session')},runtime:{id:'test',getURL:path=>`chrome-extension://test/${path}`,onMessage:{addListener(fn){listener=fn;}},async sendMessage(){return {ok:true};}},tabs:{async query(){return [];},onRemoved:{addListener(){}},onUpdated:{addListener(){}}},action:{async setBadgeText(){}}}};
  vm.runInNewContext(source,context);
  const page={id:'test',url:'https://www.youtube.com/live_chat?v=test',tab:{id:42},frameId:2};
  const message=(value,sender=page)=>new Promise(resolve=>listener(value,sender,resolve));
  return {starts,data,setLimit:value=>{limit=value;},
    translate:()=>message({type:'TRANSLATE',id:String(++id),request:{text:'example',source:'en',target:'ja'}}),
    save:translationInterval=>message({type:'SAVE_SETTINGS',settings:{translationProvider:'gemini',translationInterval}},{id:'test',url:'chrome-extension://test/options.html'}),
    async tick(ms){await flush();const end=time+ms;for(let attempts=0;;attempts++){if(attempts>100)throw new Error('Timer loop');const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}time=end;await flush();}
  };
}
for(const [before,after] of [[500,12000],[12000,500]]){
  test(`Settings save changes the very next request gap from ${before} to ${after} ms`,async()=>{
    const h=await harness(before);assert.equal((await h.translate()).ok,true);assert.equal((await h.save(after)).ok,true);
    const next=h.translate();await h.tick(after-1);assert.deepEqual(h.starts,[0]);await h.tick(1);
    assert.deepEqual(h.starts,[0,after]);assert.equal((await next).ok,true);assert.equal(h.data.local.settings.translationInterval,after);assert.equal(h.data.local.keys.gemini,'test-key');
  });
}
test('Settings save never clears a provider cooldown',async()=>{
  const h=await harness(12000);h.setLimit(true);assert.equal((await h.translate()).code,'RATE_OR_QUOTA');h.setLimit(false);
  assert.equal((await h.save(500)).ok,true);assert.equal((await h.translate()).code,'RATE_OR_QUOTA');assert.deepEqual(h.starts,[0]);
  await h.tick(29999);assert.equal((await h.translate()).code,'RATE_OR_QUOTA');await h.tick(1);assert.equal((await h.translate()).ok,true);assert.deepEqual(h.starts,[0,30000]);
});
