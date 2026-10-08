import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeKeyStorage} from '../extension/core/key-storage.js';
function storageFor(local={},session={}){
  const data={local,session},access=[];
  const area=name=>({async setAccessLevel({accessLevel}){access.push([name,accessLevel]);},async get(key){assert.equal(access.length,2);return {[key]:data[name][key]};},async set(value){Object.assign(data[name],structuredClone(value));},async remove(key){delete data[name][key];}});
  return {data,access,storage:{local:area('local'),session:area('session')}};
}
test('remaining legacy session keys migrate once and survive a fresh browser session',async()=>{
  const env=storageFor({}, {keys:{gemini:'old-key',deepgram:'speech-key'},capture:{id:'old'}});
  await initializeKeyStorage(env.storage);
  assert.deepEqual(env.data.local.keys,{gemini:'old-key',deepgram:'speech-key'});
  assert.equal(env.data.session.keys,undefined);
  assert.deepEqual(env.access,[['local','TRUSTED_CONTEXTS'],['session','TRUSTED_CONTEXTS']]);
  const restarted=storageFor(structuredClone(env.data.local));
  await initializeKeyStorage(restarted.storage);
  assert.deepEqual(restarted.data.local.keys,env.data.local.keys);
  assert.equal(restarted.data.session.capture,undefined);
});
test('saved or explicitly empty local keys win over stale session credentials',async()=>{
  for(const keys of [{gemini:'new-key'},{}]){
    const env=storageFor({keys},{keys:{gemini:'stale-key',deepgram:'stale-speech'}});
    await initializeKeyStorage(env.storage);
    assert.deepEqual(env.data.local.keys,keys);assert.equal(env.data.session.keys,undefined);
  }
});
test('a failed persistent write retains legacy keys for the next attempt',async()=>{
  const env=storageFor({}, {keys:{gemini:'old-key'}});
  env.storage.local.set=async()=>{throw new Error('write failed');};
  await assert.rejects(initializeKeyStorage(env.storage),/write failed/);
  assert.deepEqual(env.data.session.keys,{gemini:'old-key'});
});
test('storage access restriction failure prevents migration',async()=>{
  const env=storageFor({}, {keys:{gemini:'old-key'}});
  env.storage.local.setAccessLevel=async()=>{throw new Error('restriction failed');};
  await assert.rejects(initializeKeyStorage(env.storage),/restriction failed/);
  assert.equal(env.data.local.keys,undefined);assert.equal(env.data.session.keys.gemini,'old-key');
});
