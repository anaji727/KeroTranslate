import {sanitizeSettings} from './core/settings.js';
import {translate} from './core/providers.js';
const pending=new Map();let lifecycle=Promise.resolve();
const ready=Promise.all([chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})]);
const trusted=sender=>sender.id===chrome.runtime.id&&sender.url?.startsWith(chrome.runtime.getURL(''));
const youtube=sender=>sender.id===chrome.runtime.id&&sender.tab&&/^https:\/\/www\.youtube\.com\/(watch|live_chat)(\?|$|\/)/.test(sender.url||'');
const ns=(sender,id)=>`${sender.tab?.id}:${sender.frameId}:${id}`;
async function settings(){await ready;return sanitizeSettings((await chrome.storage.local.get('settings')).settings);}
async function capture(){return (await chrome.storage.session.get('capture')).capture;}
async function broadcast(tabId,message){if(tabId!==undefined)await chrome.tabs.sendMessage(tabId,message).catch(()=>{});}
async function offscreen(){
  const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']});
  if(!contexts.length)await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA'],justification:'Process user-selected YouTube tab audio and preserve audible playback.'});
}
async function stop(){
  const c=await capture();await chrome.storage.session.remove('capture');
  await chrome.runtime.sendMessage({target:'offscreen',type:'STOP'}).catch(()=>{});
  if(c)await broadcast(c.tabId,{type:'CAPTURE_STATUS',status:'STOPPED'});
  await chrome.action.setBadgeText({text:''});
}
async function start(tabId){
  await stop();const tab=await chrome.tabs.get(tabId);
  if(!/^https:\/\/www\.youtube\.com\/watch\?/.test(tab.url||''))throw new Error('Open a YouTube Live watch page first.');
  const check=await chrome.tabs.sendMessage(tabId,{type:'CHECK_LIVE'},{frameId:0}).catch(()=>null);
  if(!check?.live)throw new Error('A live player was not detected. Reload the live watch page.');
  if(!check.overlayReady)throw new Error(check.error||'Caption overlay is unavailable. Reload this YouTube page.');
  const config=await settings();const keys=(await chrome.storage.session.get('keys')).keys||{};
  const names={deepgram:'Deepgram',gemini:'Gemini',openai:'OpenAI',deepl:'DeepL',deepseek:'DeepSeek'};
  if(config.sttProvider!=='demo'&&!keys[config.sttProvider])throw new Error(`Add your ${names[config.sttProvider]} API key in Settings.`);
  if(config.captionMode!=='original'&&config.translationProvider!=='demo'&&!keys[config.translationProvider])throw new Error(`Add your ${names[config.translationProvider]} API key in Settings.`);
  await offscreen();
  const id=crypto.randomUUID();
  // Demo never captures real audio.
  let streamId=null;
  if(config.sttProvider!=='demo'){
    try{streamId=await chrome.tabCapture.getMediaStreamId({targetTabId:tabId});}
    catch{throw new Error('Open the KeroTranslate toolbar icon once on this YouTube tab, then press Start captions here again. If capture is already active elsewhere, stop it first.');}
  }
  await chrome.storage.session.set({capture:{id,tabId,url:tab.url,status:'STARTING',started:Date.now()}});
  await broadcast(tabId,{type:'CAPTURE_STATUS',status:'STARTING'});
  const reply=await chrome.runtime.sendMessage({target:'offscreen',type:'START',id,streamId,settings:config});
  if(!reply?.ok){await stop();throw new Error('Audio environment unavailable.');}
  await chrome.action.setBadgeBackgroundColor({color:'#315d30'});await chrome.action.setBadgeText({text:config.sttProvider==='demo'?'DEMO':'ON'});
}
function serial(action){const next=lifecycle.then(action);lifecycle=next.catch(()=>{});return next;}
async function handle(m,sender){
  await ready;if(!trusted(sender)&&!youtube(sender))throw new Error('Unsupported page.');
  if(m.type==='CONFIG')return {settings:await settings()};
  if(m.type==='OPEN_SETTINGS'){await chrome.runtime.openOptionsPage();return {};}
  if(['PANEL_START','PANEL_STOP','PANEL_STATUS'].includes(m.type)){
    if(!youtube(sender)||!/^https:\/\/www\.youtube\.com\/live_chat(?:\?|$|\/)/.test(sender.url))throw new Error('Open the live chat panel.');
    const tabId=sender.tab.id;
    if(m.type==='PANEL_START')await serial(()=>start(tabId));
    if(m.type==='PANEL_STOP')await serial(async()=>{if((await capture())?.tabId===tabId)await stop();});
    const c=await capture();return {status:c?.tabId===tabId?c.status:'STOPPED',error:c?.tabId===tabId?c.error||'':''};
  }
  if(m.type==='NAVIGATED'){
    for(const [key,item]of pending)if(key.startsWith(`${sender.tab?.id}:${sender.frameId}:`)){item.abort();pending.delete(key);}
    const c=await capture();if(sender.frameId===0&&c?.tabId===sender.tab?.id)await serial(stop);return {};
  }
  if(m.type==='CANCEL'){pending.get(ns(sender,m.id))?.abort();return {};}
  if(m.type==='TRANSLATE'){
    if(!youtube(sender)||!/^https:\/\/www\.youtube\.com\/live_chat(?:\?|$|\/)/.test(sender.url))throw new Error('Composer translation is only available in live chat.');
    if(typeof m.id!=='string'||m.id.length>80)throw new Error('Invalid request.');
    const key=ns(sender,m.id),prefix=ns(sender,'');
    // One in-flight translation per frame; a new version cancels the old version.
    for(const [k,c]of pending)if(k.startsWith(prefix)){c.abort();pending.delete(k);}
    const controller=new AbortController();pending.set(key,controller);
    try{
      const config=await settings(),keys=(await chrome.storage.session.get('keys')).keys||{};
      const text=await translate({...m.request,signal:controller.signal},config,keys);
      return {text};
    }finally{if(pending.get(key)===controller)pending.delete(key);}
  }
  if(!trusted(sender))throw new Error('Open extension settings for this action.');
  if(m.type==='PRIVATE_CONFIG')return {settings:await settings(),keys:(await chrome.storage.session.get('keys')).keys||{}};
  if(m.type==='STATUS')return {capture:await capture(),settings:await settings(),metrics:(await chrome.storage.session.get('metrics')).metrics||{}};
  if(m.type==='TEST_OVERLAY'){
    const result=await chrome.tabs.sendMessage(m.tabId,{type:'TEST_OVERLAY'},{frameId:0}).catch(()=>null);
    if(!result?.ok)throw new Error(result?.error||'Open a YouTube Live watch page and reload it.');
    return {overlayReady:true};
  }
  if(m.type==='SAVE_SETTINGS'){
    const config=sanitizeSettings(m.settings);await serial(stop);
    for(const c of pending.values())c.abort();pending.clear();
    await chrome.storage.local.set({settings:config});
    if(m.keys)await chrome.storage.session.set({keys:Object.fromEntries(['gemini','deepgram','openai','deepl','deepseek'].map(name=>[name,String(m.keys[name]||'').trim().slice(0,500)]))});
    for(const tab of await chrome.tabs.query({url:'https://www.youtube.com/*'}))await broadcast(tab.id,{type:'CONFIG_CHANGED',settings:config});return {};
  }
  if(m.type==='CLEAR_KEYS'){await serial(stop);for(const c of pending.values())c.abort();pending.clear();await chrome.storage.session.remove('keys');return {};}
  if(m.type==='START_CAPTURE'){await serial(()=>start(m.tabId));return {};}
  if(m.type==='STOP_CAPTURE'){await serial(stop);return {};}
  if(sender.url===chrome.runtime.getURL('offscreen.html'))return serial(async()=>{
    const c=await capture();if(!c||c.id!==m.id)return {};
    if(m.type==='AUDIO_STATUS'){await chrome.storage.session.set({capture:{...c,status:m.status,error:m.error||''}});await broadcast(c.tabId,{type:'CAPTURE_STATUS',status:m.status,error:m.error||''});if(m.status==='ERROR')await chrome.action.setBadgeText({text:'ERR'});}
    if(m.type==='AUDIO_CUE')await broadcast(c.tabId,{type:'CAPTION',cue:m.cue});
    if(m.type==='METRICS')await chrome.storage.session.set({metrics:m.metrics});
    return {};
  });
  throw new Error('Unknown action.');
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m.target==='offscreen')return;
  handle(m,sender).then(result=>reply({ok:true,...result}),error=>reply({ok:false,error:error.message||'Operation failed.'}));return true;
});
chrome.tabs.onRemoved.addListener(tabId=>{serial(async()=>{if((await capture())?.tabId===tabId)await stop();});for(const [key,c]of pending)if(key.startsWith(`${tabId}:`)){c.abort();pending.delete(key);}});
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.url||change.status==='loading')serial(async()=>{if((await capture())?.tabId===tabId)await stop();});});
