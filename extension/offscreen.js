import {queuedTranslate} from './core/translation-client.js';
import {createSttProvider} from './core/stt.js';
let active=null;
function notify(s,type,data={}){if(active===s)chrome.runtime.sendMessage({type,id:s.id,...data}).catch(()=>{});}
function status(s,value,error=''){notify(s,'AUDIO_STATUS',{status:value,error});}
function stop(){
  const s=active;active=null;if(!s)return;
  clearInterval(s.tick);s.controller?.abort();s.provider?.stop();
  s.media?.getTracks().forEach(t=>t.stop());s.context?.close().catch(()=>{});
}
function fail(s,error){if(active!==s)return;status(s,'ERROR',error);stop();}
async function cue(s,{text,final,id,sequence:providerSequence}){
  if(active!==s||s.finalIds.has(id))return;
  if(final){s.finalIds.add(id);if(s.finalIds.size>100)s.finalIds.delete(s.finalIds.values().next().value);}
  s.lastSpeech=Date.now();status(s,'LISTENING');
  s.segments??=new Map();
  if(!s.segments.has(id)){s.sequence=Math.max((s.sequence||0)+1,providerSequence||0);s.segments.set(id,providerSequence||s.sequence);if(s.segments.size>200)s.segments.delete(s.segments.keys().next().value);}
  const sequence=s.segments.get(id);
  notify(s,'AUDIO_CUE',{cue:{id,sequence,phase:final?'final':'partial',original:text,translation:'',pending:s.settings.captionMode!=='original'}});
  if(!final||s.settings.captionMode==='original')return;
  s.metrics.finalSegments++;
  // Finish the current translation; retain only the newest waiting segment to bound live delay.
  if(sequence<(s.newestTranslation||0))return;
  s.newestTranslation=sequence;s.queued={id,text,sequence};if(s.translating)return;
  s.translating=true;
  try{while(active===s&&s.queued){const next=s.queued;s.queued=null;await translateCue(s,next);}}
  finally{s.translating=false;}
}
async function translateCue(s,{id,text,sequence}){
  // Drop obsolete work while a provider is cooling down; keep recognizing audio.
  if(Date.now()<(s.retryAt||0)){s.metrics.skippedSegments=(s.metrics.skippedSegments||0)+1;notify(s,'AUDIO_CUE',{cue:{id,sequence,phase:'error',original:text,translation:'',pendingNext:!!s.queued}});return;}
  const controller=s.controller=new AbortController();const begin=performance.now();s.metrics.requests++;
  try{
    const out=await queuedTranslate({sessionId:s.id,text,target:s.settings.captionTarget,signal:controller.signal},u=>{s.metrics.inputTokens+=(u.promptTokenCount||0);s.metrics.outputTokens+=(u.candidatesTokenCount||0)+(u.thoughtsTokenCount||0);s.metrics.billedCharacters=(s.metrics.billedCharacters||0)+(u.billedCharacters||0);});
    if(active!==s||controller.signal.aborted)return;
    s.failures=0;s.retryAt=0;
    s.metrics.lastTranslationMs=Math.round(performance.now()-begin);
    notify(s,'AUDIO_CUE',{cue:{id,sequence,phase:'translated',original:text,translation:out,pendingNext:!!s.queued}});
  }catch(e){if(active===s&&!controller.signal.aborted){s.metrics.errors++;s.failures=(s.failures||0)+1;s.retryAt=Date.now()+(e.code==='RATE_OR_QUOTA'?Math.max(1000,Number(e.retryAfterMs)||30000):Math.min(10000,1000*2**Math.min(4,s.failures-1)));status(s,'TRANSLATION_ERROR',e.message);notify(s,'AUDIO_CUE',{cue:{id,sequence,phase:'error',original:text,translation:'',pendingNext:!!s.queued}});}}
}
async function begin(s,streamId){
  try{
    const reply=await chrome.runtime.sendMessage({type:'PRIVATE_CONFIG'});if(active!==s)return;
    if(!reply.ok)throw new Error('Could not load extension settings.');s.keys=reply.keys;
    {
      const media=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:streamId}},video:false});
      if(active!==s){media.getTracks().forEach(t=>t.stop());return;}s.media=media;
      s.context=new AudioContext();const source=s.context.createMediaStreamSource(media);source.connect(s.context.destination);await s.context.resume();
      if(active!==s)return;
      if(s.context.state!=='running')throw new Error('Audio playback could not resume. Capture stopped.');
      media.getTracks().forEach(t=>t.onended=()=>fail(s,'Tab audio ended. Start again from the KeroTranslate panel.'));
    }
    s.provider=createSttProvider(s.settings.sttProvider,{key:s.keys[s.settings.sttProvider],language:s.settings.speechLanguage,onResult:event=>cue(s,event),onBytes:n=>s.metrics.audioBytes+=n,onError:error=>fail(s,error),onOpen:()=>{
      status(s,'LISTENING');s.lastSpeech=s.started=Date.now();
      s.tick=setInterval(()=>{if(active!==s)return;s.metrics.audioSeconds=(Date.now()-s.started)/1000;notify(s,'METRICS',{metrics:s.metrics});if(Date.now()-s.lastSpeech>15000)status(s,'NO_SPEECH');},5000);
    }});
    await s.provider.start(s.media);
  }catch(e){fail(s,e.name==='NotAllowedError'?'Tab audio permission was denied.':e.message||'Audio capture failed.');}
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m.target!=='offscreen'||sender.id!==chrome.runtime.id||sender.tab||(sender.url&&sender.url!==chrome.runtime.getURL('background.js')))return;
  if(m.type==='STOP'){stop();reply({ok:true});}
  if(m.type==='START'){stop();const s=active={id:m.id,settings:m.settings,finalIds:new Set(),metrics:{audioBytes:0,audioSeconds:0,finalSegments:0,requests:0,errors:0,inputTokens:0,outputTokens:0}};begin(s,m.streamId);reply({ok:true});}
});
