import {ProviderError} from './providers.js';

// Owned only by the service worker: all caption and composer HTTP translation
// requests share these lanes. STT streams do not go through this queue.
export class TranslationQueue {
  constructor({now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}){Object.assign(this,{now,setTimer,clearTimer});this.lanes=new Map();}
  schedule({provider,signal,intervalMs=1000,priority=0,run}){
    if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
    let lane=this.lanes.get(provider);
    if(!lane){lane={queue:[],running:false,nextAt:0,blockedUntil:0,timer:null};this.lanes.set(provider,lane);}
    if(this.now()<lane.blockedUntil)return Promise.reject(this.cooldownError(lane));
    if(lane.queue.length>=50)return Promise.reject(new ProviderError('BUSY','Translation queue is full. Try again shortly.'));
    return new Promise((resolve,reject)=>{
      const job={signal,intervalMs,priority,run,resolve,reject};
      job.abort=()=>{const index=lane.queue.indexOf(job);if(index<0)return;lane.queue.splice(index,1);signal.removeEventListener('abort',job.abort);reject(new DOMException('Aborted','AbortError'));this.pump(lane);};
      signal?.addEventListener('abort',job.abort,{once:true});lane.queue.push(job);this.pump(lane);
    });
  }
  cooldownError(lane){
    const remaining=Math.max(0,lane.blockedUntil-this.now());
    const error=new ProviderError('RATE_OR_QUOTA',`Translation paused after a provider limit. Try again in ${Math.ceil(remaining/1000)}s. If it persists, check your provider quota or increase the request interval.`);
    error.retryAfterMs=remaining;return error;
  }
  pump(lane){
    if(lane.running)return;
    if(lane.timer!==null){this.clearTimer(lane.timer);lane.timer=null;}
    if(!lane.queue.length)return;
    if(this.now()<lane.blockedUntil){for(const job of lane.queue.splice(0)){job.signal?.removeEventListener('abort',job.abort);job.reject(this.cooldownError(lane));}return;}
    const delay=lane.nextAt-this.now();
    if(delay>0){lane.timer=this.setTimer(()=>{lane.timer=null;this.pump(lane);},delay);return;}
    // Pick when sending, not when the timer starts: comments can overtake captions.
    lane.queue.sort((a,b)=>b.priority-a.priority);const job=lane.queue.shift();
    job.signal?.removeEventListener('abort',job.abort);
    if(job.signal?.aborted){job.reject(new DOMException('Aborted','AbortError'));this.pump(lane);return;}
    lane.running=true;lane.nextAt=this.now()+job.intervalMs;
    Promise.resolve().then(()=>{if(job.signal?.aborted)throw new DOMException('Aborted','AbortError');return job.run();}).then(job.resolve,error=>{
      if(error.code==='RATE_OR_QUOTA'){
        lane.blockedUntil=this.now()+Math.max(1000,Number(error.retryAfterMs)||30000);
        job.reject(this.cooldownError(lane));
      }else job.reject(error);
    }).finally(()=>{lane.running=false;this.pump(lane);});
  }
}
