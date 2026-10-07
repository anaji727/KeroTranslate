import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../extension/popup.js',import.meta.url),'utf8');
async function popup({url='https://www.youtube.com/watch?v=test',capture,failStart=false}={}){
  const nodes=new Map(),messages=[];let poll;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,textContent:''});return nodes.get(id);};
  const context={document:{getElementById:node},setInterval(fn){poll=fn;},chrome:{tabs:{async query(){return [{id:42,url}];}},runtime:{async openOptionsPage(){},async sendMessage(m){messages.push(m);if(m.type==='START_CAPTURE'){if(failStart)return {ok:false,error:'API key missing.'};capture={tabId:m.tabId,status:'STARTING'};}if(m.type==='STOP_CAPTURE')capture=undefined;return {ok:true,capture,settings:{sttProvider:'demo',translationProvider:'demo',speechLanguage:'ja',captionTarget:'en'}};}}}};
  await vm.runInNewContext(`(async()=>{${source}\n})()`,context);return {node,messages,poll};
}
test('popup starts and stops its tab without returning to the main panel',async()=>{
  const h=await popup();assert.equal(h.node('start').disabled,false);assert.equal(h.node('stop').disabled,true);
  await h.node('start').onclick();assert.equal(h.node('status').textContent,'STARTING');assert.equal(h.node('start').disabled,true);assert.equal(h.node('stop').disabled,false);
  await h.node('stop').onclick();assert.equal(h.node('start').disabled,false);assert.deepEqual(h.messages.filter(m=>m.type!=='STATUS').map(m=>[m.type,m.tabId]),[['START_CAPTURE',42],['STOP_CAPTURE',42]]);
});
test('popup never shows another tabs capture as its own or enables stop for it',async()=>{
  const h=await popup({capture:{tabId:99,status:'LISTENING',error:'Other tab error'}});assert.equal(h.node('status').textContent,'Stopped on this tab');assert.equal(h.node('stop').disabled,true);assert.equal(h.node('message').textContent,'');
});
test('popup disables capture on unsupported pages and retains actionable start errors',async()=>{
  const other=await popup({url:'https://example.com'});assert.equal(other.node('start').disabled,true);assert.equal(other.node('test').disabled,true);
  const h=await popup({failStart:true});await h.node('start').onclick();assert.equal(h.node('message').textContent,'API key missing.');assert.equal(h.node('start').disabled,false);
});
