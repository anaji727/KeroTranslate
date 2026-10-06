import test from 'node:test';import assert from 'node:assert/strict';
const data={local:{},session:{keys:{gemini:'secret-g',deepgram:'secret-d'}}};let listener;const access=[];const sent=[];
const area=name=>({async setAccessLevel(v){access.push([name,v.accessLevel]);},async get(key){return {[key]:data[name][key]};},async set(v){Object.assign(data[name],v);},async remove(key){delete data[name][key];}});
globalThis.chrome={storage:{local:area('local'),session:area('session')},runtime:{id:'test',getURL:path=>`chrome-extension://test/${path}`,onMessage:{addListener(fn){listener=fn;}},async sendMessage(m){sent.push(m);return {ok:true};},async openOptionsPage(){}},tabs:{async sendMessage(tabId,m){sent.push({tabId,...m});},async query(){return [];},onRemoved:{addListener(){}},onUpdated:{addListener(){}}},action:{async setBadgeText(){},async setBadgeBackgroundColor(){}}};
await import('../extension/background.js');
const content={id:'test',url:'https://www.youtube.com/live_chat?v=demo',tab:{id:42},frameId:2};
const options={id:'test',url:'chrome-extension://test/options.html'};
const audio={id:'test',url:'chrome-extension://test/offscreen.html'};
const message=(m,s=content)=>new Promise(resolve=>listener(m,s,resolve));
test('storage is restricted to trusted extension contexts',()=>{assert.deepEqual(access,[['local','TRUSTED_CONTEXTS'],['session','TRUSTED_CONTEXTS']]);});
test('content scripts cannot read keys or mutate private settings',async()=>{for(const type of ['PRIVATE_CONFIG','CLEAR_KEYS','SAVE_SETTINGS','START_CAPTURE']){const r=await message({type});assert.equal(r.ok,false);assert.ok(!JSON.stringify(r).includes('secret-g'));}assert.equal(data.session.keys.gemini,'secret-g');});
test('public config contains no credentials',async()=>{const r=await message({type:'CONFIG'});assert.equal(r.ok,true);assert.ok(!JSON.stringify(r).includes('secret'));assert.equal(r.keys,undefined);});
test('unrelated page is rejected',async()=>{assert.equal((await message({type:'CONFIG'},{...content,url:'https://example.com/'})).ok,false);});
test('trusted options can retrieve session keys',async()=>{const r=await message({type:'PRIVATE_CONFIG'},options);assert.equal(r.keys.gemini,'secret-g');});
test('late audio events after Stop cannot revive session or publish captions',async()=>{data.session.capture={id:'old',tabId:42};await message({type:'STOP_CAPTURE'},options);const count=sent.length;await message({type:'AUDIO_STATUS',id:'old',status:'LISTENING'},audio);await message({type:'AUDIO_CUE',id:'old',cue:{original:'late'}},audio);assert.equal(data.session.capture,undefined);assert.equal(sent.length,count);});
test('key deletion clears session credentials',async()=>{await message({type:'CLEAR_KEYS'},options);assert.equal(data.session.keys,undefined);});
test('capture refuses a live player whose overlay failed initialization',async()=>{
  const send=chrome.tabs.sendMessage;
  chrome.tabs.get=async()=>({url:'https://www.youtube.com/watch?v=test'});
  chrome.tabs.sendMessage=async(_tab,m)=>m.type==='CHECK_LIVE'?{live:true,overlayReady:false}:undefined;
  try{const r=await message({type:'START_CAPTURE',tabId:42},options);assert.equal(r.ok,false);assert.match(r.error,/overlay/);assert.equal(data.session.capture,undefined);}
  finally{chrome.tabs.sendMessage=send;}
});
test('panel controls use the sender tab and cannot stop another tab or read private state',async()=>{
  data.session.capture={id:'other',tabId:99,status:'LISTENING',error:'private'};
  const r=await message({type:'PANEL_STOP',tabId:99});assert.equal(data.session.capture.tabId,99);assert.equal(r.status,'STOPPED');assert.equal(r.error,'');assert.equal(r.capture,undefined);
  data.session.capture={id:'own',tabId:42,status:'LISTENING'};assert.equal((await message({type:'PANEL_STATUS'})).status,'LISTENING');
  await message({type:'PANEL_STOP'});assert.equal(data.session.capture,undefined);
  assert.equal((await message({type:'PANEL_START'}, {...content,url:'https://example.com/'})).ok,false);
});
test('panel start ignores a supplied tab ID and targets its own live watch tab',async()=>{
  const get=chrome.tabs.get,send=chrome.tabs.sendMessage;let selected;
  chrome.tabs.get=async id=>{selected=id;return {url:'https://www.youtube.com/watch?v=test'};};chrome.tabs.sendMessage=async()=>({live:true,overlayReady:false});
  try{assert.equal((await message({type:'PANEL_START',tabId:99})).ok,false);assert.equal(selected,42);}finally{chrome.tabs.get=get;chrome.tabs.sendMessage=send;}
});
