import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCaptions} from '../extension/ui/captions.js';
import {sanitizeSettings} from '../extension/core/settings.js';
function harness(t,settings={}){
  const jobs=new Map();let id=0;
  t.mock.method(globalThis,'setTimeout',(fn,ms)=>{jobs.set(++id,{fn,ms});return id;});
  t.mock.method(globalThis,'clearTimeout',id=>jobs.delete(id));
  const nodes=Object.fromEntries(['.text','.original','.translation','.recognition'].map(k=>{const classes=new Set();return [k,{style:{},textContent:'',classList:{toggle(c,on){on?classes.add(c):classes.delete(c);},contains:c=>classes.has(c)}}];}));
  const host={style:{},attachShadow:()=>({querySelector:s=>nodes[s]}),remove(){}};
  const view=mountCaptions(host,settings);return {view,jobs,nodes};
}
test('pending recognition stays visible; reading timer starts on translation arrival',t=>{
  const {view,jobs,nodes}=harness(t,{captionDuration:15});
  view.show({original:'日本語',pending:true});assert.equal(jobs.size,0);assert.equal(nodes['.recognition'].textContent,'日本語');
  view.show({original:'日本語',translation:'Japanese'});assert.equal([...jobs.values()][0].ms,15000);
  view.show({original:'次の発話',pending:true});assert.equal(jobs.size,0);assert.equal(nodes['.translation'].textContent,'Japanese');assert.equal(nodes['.original'].textContent,'日本語');
  view.show({original:'次の発話',translation:'Next utterance'});assert.equal([...jobs.values()][0].ms,15000);
  [...jobs.values()][0].fn();assert.equal(nodes['.text'].style.display,'none');
});
test('partial changes in place, final loses dim styling and old translation preserves newer speech',t=>{
  const {view,jobs,nodes}=harness(t);
  view.show({sequence:1,phase:'partial',original:'こん'});assert.equal(nodes['.recognition'].textContent,'こん …');assert.equal(nodes['.recognition'].classList.contains('partial'),true);assert.equal(jobs.size,0);
  view.show({sequence:1,phase:'partial',original:'こんにちは'});assert.equal(nodes['.recognition'].textContent,'こんにちは …');
  view.show({sequence:1,phase:'final',original:'こんにちは。'});assert.equal(nodes['.recognition'].textContent,'こんにちは。');assert.equal(nodes['.recognition'].classList.contains('partial'),false);
  view.show({sequence:1,phase:'partial',original:'stale'});assert.equal(nodes['.recognition'].textContent,'こんにちは。');
  view.show({sequence:2,phase:'partial',original:'次の'});
  view.show({sequence:1,phase:'translated',original:'こんにちは。',translation:'Hello.'});assert.equal(nodes['.recognition'].textContent,'次の …');assert.equal(nodes['.translation'].textContent,'Hello.');assert.equal(jobs.size,0);
  view.show({sequence:2,phase:'final',original:'次の文。'});view.show({sequence:2,phase:'translated',original:'次の文。',translation:'Next sentence.'});assert.equal(nodes['.recognition'].textContent,'');assert.equal(jobs.size,1);
  view.clear();view.show({sequence:1,phase:'partial',original:'再開'});assert.equal(nodes['.recognition'].textContent,'再開 …');
});
test('original-only mode expires normally and Stop clears pending captions',t=>{
  const {view,jobs,nodes}=harness(t,{captionMode:'original',captionDuration:5});view.show({original:'hello',pending:true});assert.equal([...jobs.values()][0].ms,5000);view.clear();assert.equal(jobs.size,0);assert.equal(nodes['.original'].textContent,'');
});
test('completed caption stays while an already queued translation is running',t=>{
  const {view,jobs}=harness(t);view.show({original:'one',translation:'first',pendingNext:true});assert.equal(jobs.size,0);view.show({original:'two',translation:'second'});assert.equal(jobs.size,1);
});
test('translation-only mode has no empty box while awaiting first result',t=>{
  const {view,nodes}=harness(t,{captionMode:'translation'});view.show({original:'hello',pending:true});assert.equal(nodes['.text'].style.display,'none');
});
test('size updates existing captions and settings reject unsupported values',t=>{
  const {view,nodes}=harness(t);view.configure({captionSize:200});assert.equal(nodes['.text'].style.fontSize,'clamp(28px,4vw,48px)');
  assert.equal(sanitizeSettings({captionSize:'150',captionDuration:'20'}).captionSize,150);
  assert.equal(sanitizeSettings({captionDuration:0,captionSize:999}).captionDuration,10);assert.equal(sanitizeSettings({captionSize:999}).captionSize,100);
});
