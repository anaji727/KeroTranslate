(async()=>{
  const [{mountComposer},{mountCaptions},{insertDraft,livePlayer}]=await Promise.all([
    import(chrome.runtime.getURL('ui/composer-view.js')),import(chrome.runtime.getURL('ui/captions.js')),import(chrome.runtime.getURL('youtube.js'))
  ]);
  let config,composer,captions,captionHost,chatHost,lastUrl=location.href,queued=false,generation=0,mounting;
  const send=message=>chrome.runtime.sendMessage(message);
  async function translate({signal,...request}){
    const id=crypto.randomUUID();const abort=()=>send({type:'CANCEL',id}).catch(()=>{});
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    signal.addEventListener('abort',abort,{once:true});
    try{const result=await send({type:'TRANSLATE',id,request});if(signal.aborted)throw new DOMException('Aborted','AbortError');if(!result?.ok)throw new Error(result?.error||'Extension unavailable. Reload this page.');return result.text;}finally{signal.removeEventListener('abort',abort);}
  }
  function cleanup(){generation++;composer?.dispose();composer=null;captions?.dispose();captions=null;chatHost?.remove();captionHost?.remove();chatHost=null;captionHost=null;send({type:'NAVIGATED'}).catch(()=>{});}
  async function initialize(){
    if(lastUrl!==location.href){cleanup();lastUrl=location.href;}
    if(!/^\/(watch|live_chat)\/?$/.test(location.pathname))return;
    const url=location.href,version=generation;
    if(!config){const result=await send({type:'CONFIG'});if(version!==generation||url!==location.href)return;if(!result?.ok||!result.settings)throw new Error('Settings unavailable. Reload this YouTube page.');config=result.settings;}
    if(/^\/live_chat\/?$/.test(location.pathname)){
      const renderer=document.querySelector('yt-live-chat-message-input-renderer');
      if(renderer&&(!chatHost?.isConnected)){
        composer?.dispose();const host=document.createElement('div');host.style.cssText='flex:none;max-height:55vh;overflow:auto;margin:0 8px 8px;';
        const view=mountComposer(host,{settings:config,translate,insert:insertDraft,openSettings:()=>send({type:'OPEN_SETTINGS'}),captureAction:action=>send({type:action==='start'?'PANEL_START':'PANEL_STOP'})});
        renderer.before(host);chatHost=host;composer=view;
        send({type:'PANEL_STATUS'}).then(r=>{if(composer===view&&r.ok)view.captureStatus(r);}).catch(()=>{});
      }
    }else if(window===window.top){
      const player=livePlayer();
      if(player&&(!captions||captionHost?.parentElement!==player)){captions?.dispose();captions=null;captionHost=null;const host=document.createElement('div');host.id='kero-caption-overlay';const view=mountCaptions(host,config);player.append(host);captionHost=host;captions=view;}
    }
  }
  function mount(){if(!mounting)mounting=initialize().finally(()=>{mounting=null;});return mounting;}
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if(message.type==='CHECK_LIVE'||message.type==='TEST_OVERLAY'){
      mount().then(()=>{const live=!!livePlayer(),overlayReady=!!captions&&!!captionHost?.isConnected;if(message.type==='TEST_OVERLAY'&&overlayReady)captions.show({original:'字幕の表示テストです',translation:'Caption overlay is working.'});respond({ok:live&&overlayReady,live,overlayReady});},()=>respond({ok:false,live:!!livePlayer(),overlayReady:false,error:'Caption overlay could not initialize. Reload this YouTube page.'}));return true;
    }
    if(message.type==='CAPTION'){const version=generation;mount().then(()=>{if(version===generation)captions?.show(message.cue);}).catch(()=>{});}
    if(message.type==='CAPTURE_STATUS'&&['STOPPED','ERROR','STARTING'].includes(message.status)){generation++;captions?.clear();}
    if(message.type==='CAPTURE_STATUS')composer?.captureStatus(message);
    if(message.type==='CONFIG_CHANGED'){config=message.settings;composer?.refresh(config);captions?.configure(config);}
  });
  const observer=new MutationObserver(()=>{if(!queued){queued=true;setTimeout(()=>{queued=false;mount().catch(()=>{});},400);}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('yt-navigate-start',cleanup);
  window.addEventListener('pagehide',()=>{cleanup();observer.disconnect();},{once:true});
  await mount();
})().catch(()=>{});
