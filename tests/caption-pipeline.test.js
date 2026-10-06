import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
test('ongoing speech does not cancel translations; waiting work is bounded and Stop suppresses results',async()=>{
  const sent=[],requests=[];let listener,emit;
  const source=(await readFile(new URL('../extension/offscreen.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
  const context={AbortController,Date,performance,clearInterval(){},setInterval(){},FIXTURES:[],translate:(request)=>new Promise(resolve=>requests.push({request,resolve})),createSttProvider:(_name,options)=>{emit=options.onResult;return {start(){options.onOpen();},stop(){}};},chrome:{runtime:{id:'test',getURL:p=>p,onMessage:{addListener(fn){listener=fn;}},async sendMessage(m){sent.push(m);return {ok:true,keys:{}};}}}};
  vm.runInNewContext(source,context);
  const send=m=>listener({target:'offscreen',...m},{id:'test'},()=>{});
  const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  send({type:'START',id:'session',settings:{sttProvider:'demo',captionMode:'both',captionTarget:'en'}});await flush();
  emit({id:'1',text:'on',final:false});assert.equal(requests.length,0);assert.equal(sent.at(-1).cue.phase,'partial');assert.equal(sent.at(-1).cue.sequence,1);
  emit({id:'1',text:'one',final:true});assert.equal(sent.at(-1).cue.phase,'final');assert.equal(sent.at(-1).cue.sequence,1);
  emit({id:'2',text:'two interim',final:false});emit({id:'2',text:'two',final:true});emit({id:'3',text:'three',final:true});
  assert.equal(requests.length,1);assert.equal(requests[0].request.signal.aborted,false);
  requests[0].resolve('translated one');await flush();assert.ok(sent.some(m=>m.cue?.translation==='translated one'));
  assert.equal(requests.length,2);assert.equal(requests[1].request.text,'three');
  send({type:'STOP'});const count=sent.length;requests[1].resolve('too late');await flush();assert.equal(sent.length,count);assert.equal(requests[1].request.signal.aborted,true);
});
