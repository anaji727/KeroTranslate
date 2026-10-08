import test from 'node:test';import assert from 'node:assert/strict';
import {createNotice} from '../extension/ui/notice.js';
function harness(){
  let now=0,id=0;const tasks=new Map(),node={textContent:''};
  const notice=createNotice(node,{now:()=>now,setTimer:(fn,ms)=>{tasks.set(++id,{fn,at:now+ms});return id;},clearTimer:id=>tasks.delete(id)});
  return {node,notice,tasks,tick(ms){now+=ms;for(const [id,t]of [...tasks])if(t.at<=now){tasks.delete(id);t.fn();}}};
}
test('errors remain visible for one second despite success, empty and status updates',()=>{
  const h=harness();h.notice.set('Network error',true);h.tick(10);h.notice.set('');h.notice.set('Saved');h.tick(989);assert.equal(h.node.textContent,'Network error');h.tick(1);assert.equal(h.node.textContent,'Saved');
});
test('replacement errors receive their own minimum display time and repeats do not extend it',()=>{
  const h=harness();h.notice.set('First error',true);h.tick(500);h.notice.set('First error',true);h.notice.set('Second error',true);h.tick(500);assert.equal(h.node.textContent,'Second error');h.notice.set('');h.tick(999);assert.equal(h.node.textContent,'Second error');h.tick(1);assert.equal(h.node.textContent,'');
});
test('disposing a notice cancels delayed DOM updates',()=>{
  const h=harness();h.notice.set('Error',true);h.notice.set('');h.notice.dispose();assert.equal(h.tasks.size,0);h.tick(1000);assert.equal(h.node.textContent,'Error');
});
