import test from 'node:test';import assert from 'node:assert/strict';
import {mountComposer} from '../extension/ui/composer-view.js';
import {DEFAULTS} from '../extension/core/settings.js';
test('main panel starts and stops captions, reflects broadcast status and displays capture errors',async t=>{
  const node=()=>({style:{},dataset:{},value:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},prepend(){}});
  const rootNodes=new Map(),controlNodes=new Map();
  const query=(map,key)=>{if(!map.has(key))map.set(key,node());return map.get(key);};
  const controls={...node(),querySelector:key=>query(controlNodes,key)};
  globalThis.document={createElement:()=>controls};t.after(()=>{delete globalThis.document;});
  const root={querySelector:key=>query(rootNodes,key)},host={attachShadow:()=>root,remove(){}};
  const actions=[];let response={ok:true,status:'LISTENING'};
  const view=mountComposer(host,{settings:DEFAULTS,translate:async()=>'',insert:async()=>({}),captureAction:async action=>{actions.push(action);return response;}});
  assert.equal(controlNodes.get('.capture-stop').disabled,true);
  await controlNodes.get('.capture-start').onclick();assert.deepEqual(actions,['start']);assert.equal(controlNodes.get('.capture-start').disabled,true);assert.equal(controlNodes.get('.capture-state').textContent,'LISTENING');
  response={ok:true,status:'STOPPED'};await controlNodes.get('.capture-stop').onclick();assert.deepEqual(actions,['start','stop']);assert.equal(controlNodes.get('.capture-start').disabled,false);
  response={ok:false,error:'Open the toolbar icon once.'};await controlNodes.get('.capture-start').onclick();assert.match(controlNodes.get('.capture-message').textContent,/toolbar/);assert.equal(controlNodes.get('.capture-start').disabled,false);
  view.captureStatus({status:'NO_SPEECH'});assert.equal(controlNodes.get('.capture-state').textContent,'NO_SPEECH');view.dispose();
});
