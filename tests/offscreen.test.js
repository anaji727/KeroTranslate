import test from 'node:test';import assert from 'node:assert/strict';
let listener;const sent=[];const worker={id:'test'};
// Test doubles are confined to tests; the shipped extension has no fake provider.
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{async getUserMedia(){return {getTracks:()=>[{stop(){}}]};}}}});
globalThis.AudioContext=class {state='running';destination={};createMediaStreamSource(){return {connect(){}};}async resume(){}async close(){}};
globalThis.MediaRecorder=class {state='inactive';start(){this.state='recording';}stop(){this.state='inactive';}};
globalThis.WebSocket=class {readyState=1;bufferedAmount=0;constructor(){queueMicrotask(()=>{this.onopen?.();this.onmessage?.({data:JSON.stringify({type:'Results',start:0,is_final:true,channel:{alternatives:[{transcript:'test speech'}]}})});});}send(){}close(){}};
globalThis.chrome={runtime:{id:'test',getURL:p=>`chrome-extension://test/${p}`,onMessage:{addListener(f){listener=f;}},async sendMessage(m){sent.push(m);if(m.type==='PRIVATE_CONFIG')return {ok:true,keys:{deepgram:'fake'}};if(m.type==='CAPTION_TRANSLATE'){await new Promise(r=>setTimeout(r,350));return {ok:true,text:'translated'};}return {ok:true};}}};
await import('../extension/offscreen.js');
const turn=()=>new Promise(r=>setTimeout(r,0));
const config={sttProvider:'deepgram',translationProvider:'gemini',captionTarget:'en',captionMode:'both'};
const message=(m,sender=worker)=>{let reply;listener({target:'offscreen',...m},sender,r=>reply=r);return reply;};
test('mocked audio session stops without allowing its pending translation to publish',async()=>{
  assert.equal(message({type:'START',id:'test-session',streamId:'fake',settings:config}).ok,true);await turn();assert.ok(sent.some(m=>m.type==='AUDIO_CUE'));
  message({type:'STOP'});const count=sent.length;await new Promise(r=>setTimeout(r,400));assert.equal(sent.length,count);
});
test('late getUserMedia resolution after Stop immediately stops every track',async()=>{
  let resolveMedia;let stopped=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolveMedia=r)}}});
  message({type:'START',id:'late-media',streamId:'fake',settings:{...config,sttProvider:'deepgram'}});await turn();message({type:'STOP'});
  resolveMedia({getTracks:()=>[{stop(){stopped++;}},{stop(){stopped++;}}]});await turn();assert.equal(stopped,2);
});
test('content frames and other extension pages cannot start offscreen capture',()=>{
  assert.equal(message({type:'START',id:'bad',settings:config},{id:'test',tab:{id:1}}),undefined);
  assert.equal(message({type:'START',id:'bad',settings:config},{id:'test',url:'chrome-extension://test/options.html'}),undefined);
});
