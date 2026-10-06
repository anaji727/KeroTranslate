import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../extension/content.js',import.meta.url),'utf8')).replace(/import\(chrome.runtime.getURL\('([^']+)'\)\)/g,(_,path)=>`Promise.resolve(modules['${path}'])`);
async function harness({path='/watch',config,failView=false}={}){
  let listener,attempts=0;const sent=[],shown=[],children=[];
  const player={append(host){children.push(host);host.isConnected=true;host.parentElement=player;}};
  const location={pathname:path,href:`https://www.youtube.com${path}?v=test`};
  const context={Promise,location,DOMException,setTimeout:()=>0,clearTimeout(){},window:{addEventListener(){}},document:{documentElement:{},addEventListener(){},createElement(){return {style:{},remove(){this.isConnected=false;const i=children.indexOf(this);if(i>=0)children.splice(i,1);}};}},MutationObserver:class{observe(){}disconnect(){}},chrome:{runtime:{getURL:p=>p,onMessage:{addListener(fn){listener=fn;}},async sendMessage(m){sent.push(m);return m.type==='CONFIG'?(config?await config():{ok:true,settings:{}}):{ok:true};}}},modules:{'ui/composer-view.js':{},'youtube.js':{livePlayer:()=>location.pathname==='/watch'?player:null},'ui/captions.js':{mountCaptions(host){attempts++;if(failView&&attempts===1)throw new Error('view failed');return {show:cue=>shown.push(cue),clear(){},dispose(){host.remove();}};}}}};
  context.window.top=context.window;await vm.runInNewContext(source,context);
  return {sent,shown,children,location,message:m=>new Promise(resolve=>listener(m,{},resolve))};
}
test('rejected config leaves no orphan and a later request recovers',async()=>{
  let n=0;const h=await harness({config:()=>++n===1?{ok:false}:{ok:true,settings:{}}});
  assert.equal(h.children.length,0);assert.equal((await h.message({type:'CHECK_LIVE'})).overlayReady,true);assert.equal(h.children.length,1);
});
test('failed caption view is retried; test overlay uses no audio API',async()=>{
  const h=await harness({failView:true});assert.equal(h.children.length,0);
  assert.equal((await h.message({type:'TEST_OVERLAY'})).ok,true);assert.equal(h.children.length,1);assert.equal(h.shown.length,1);assert.ok(h.sent.every(m=>m.type==='CONFIG'));
});
test('home page defers config and supports navigation to a live page',async()=>{
  const h=await harness({path:'/'});assert.equal(h.sent.length,0);
  h.location.pathname='/watch';h.location.href='https://www.youtube.com/watch?v=test';
  assert.equal((await h.message({type:'CHECK_LIVE'})).overlayReady,true);
});
