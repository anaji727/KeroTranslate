import {translate,FIXTURES} from './core/providers.js';
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
async function cue(s,{text,final,id}){
  if(active!==s||s.finalIds.has(id))return;
  if(final){s.finalIds.add(id);if(s.finalIds.size>100)s.finalIds.delete(s.finalIds.values().next().value);}
  s.lastSpeech=Date.now();status(s,s.settings.sttProvider==='demo'?'DEMO':'LISTENING');
  if(s.segmentId!==id){s.segmentId=id;s.sequence=(s.sequence||0)+1;}
  const sequence=s.sequence;
  notify(s,'AUDIO_CUE',{cue:{id,sequence,phase:final?'final':'partial',original:text,translation:'',pending:s.settings.captionMode!=='original'}});
  if(!final||s.settings.captionMode==='original')return;
  s.metrics.finalSegments++;
  // Finish the current translation; retain only the newest waiting segment to bound live delay.
  s.queued={id,text,sequence};if(s.translating)return;
  s.translating=true;
  try{while(active===s&&s.queued){const next=s.queued;s.queued=null;await translateCue(s,next);}}
  finally{s.translating=false;}
}
async function translateCue(s,{id,text,sequence}){
  const controller=s.controller=new AbortController();const begin=performance.now();s.metrics.requests++;
  try{
    const out=await translate({text,source:'auto',target:s.settings.captionTarget,signal:controller.signal},s.settings,s.keys,u=>{s.metrics.inputTokens+=(u.promptTokenCount||0);s.metrics.outputTokens+=(u.candidatesTokenCount||0)+(u.thoughtsTokenCount||0);});
    if(active!==s||controller.signal.aborted)return;
    s.metrics.lastTranslationMs=Math.round(performance.now()-begin);
    notify(s,'AUDIO_CUE',{cue:{id,sequence,phase:'translated',original:text,translation:out,pendingNext:!!s.queued}});
  }catch(e){if(active===s&&!controller.signal.aborted){s.metrics.errors++;status(s,'TRANSLATION_ERROR',e.message);notify(s,'AUDIO_CUE',{cue:{id,sequence,phase:'error',original:text,translation:'',pendingNext:!!s.queued}});}}
}
async function begin(s,streamId){
  try{
    const reply=await chrome.runtime.sendMessage({type:'PRIVATE_CONFIG'});if(active!==s)return;
    if(!reply.ok)throw new Error('Could not load extension settings.');s.keys=reply.keys;
    if(s.settings.sttProvider!=='demo'){
      const media=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:streamId}},video:false});
      if(active!==s){media.getTracks().forEach(t=>t.stop());return;}s.media=media;
      s.context=new AudioContext();const source=s.context.createMediaStreamSource(media);source.connect(s.context.destination);await s.context.resume();
      if(active!==s)return;
      if(s.context.state!=='running')throw new Error('Audio playback could not resume. Capture stopped.');
      media.getTracks().forEach(t=>t.onended=()=>fail(s,'Tab audio ended. Start again from the KeroTranslate panel.'));
    }
    s.provider=createSttProvider(s.settings.sttProvider,{key:s.keys.deepgram,language:s.settings.speechLanguage,samples:FIXTURES,onResult:event=>cue(s,event),onBytes:n=>s.metrics.audioBytes+=n,onError:error=>fail(s,error),onOpen:()=>{
      status(s,s.settings.sttProvider==='demo'?'DEMO':'LISTENING');s.lastSpeech=s.started=Date.now();
      s.tick=setInterval(()=>{if(active!==s)return;if(s.settings.sttProvider!=='demo')s.metrics.audioSeconds=(Date.now()-s.started)/1000;notify(s,'METRICS',{metrics:s.metrics});if(Date.now()-s.lastSpeech>15000)status(s,'NO_SPEECH');},5000);
    }});
    s.provider.start(s.media);
  }catch(e){fail(s,e.name==='NotAllowedError'?'Tab audio permission was denied.':e.message||'Audio capture failed.');}
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m.target!=='offscreen'||sender.id!==chrome.runtime.id||sender.tab||(sender.url&&sender.url!==chrome.runtime.getURL('background.js')))return;
  if(m.type==='STOP'){stop();reply({ok:true});}
  if(m.type==='START'){stop();const s=active={id:m.id,settings:m.settings,finalIds:new Set(),metrics:{audioBytes:0,audioSeconds:0,finalSegments:0,requests:0,errors:0,inputTokens:0,outputTokens:0}};begin(s,m.streamId);reply({ok:true});}
});
