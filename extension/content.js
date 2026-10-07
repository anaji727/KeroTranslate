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
      if(player&&(!captions||!captionHost?.isConnected||captionHost?.parentElement!==player)){captions?.dispose();captions=null;captionHost=null;const host=document.createElement('div');host.id='kero-caption-overlay';const view=mountCaptions(host,config);player.append(host);captionHost=host;captions=view;}
    }
  }
  function mount(){if(!mounting)mounting=initialize().finally(()=>{mounting=null;});return mounting;}
  async function prepareOverlay(test){
    const url=location.href;let failed=false;
    // Retry a mount invalidated by navigation/STOPPED; also allow the player to attach.
    for(let attempt=0;attempt<4;attempt++){
      try{await mount();failed=false;}catch{failed=true;}
      if(url!==location.href)return {ok:false,live:false,overlayReady:false};
      const live=!!livePlayer(),overlayReady=live&&!!captions&&!!captionHost?.isConnected;
      if(overlayReady){if(test)captions.show({original:'字幕の表示テストです',translation:'Caption overlay is working.'});return {ok:true,live,overlayReady};}
      if(attempt<3)await new Promise(resolve=>setTimeout(resolve,150));
    }
    return {ok:false,live:!!livePlayer(),overlayReady:false,error:failed?'Caption overlay could not initialize. If the extension was just updated, reload YouTube once, then use Start captions in the toolbar popup.':'Caption overlay is not ready yet. Wait for the video to load and try Start captions again.'};
  }
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if(message.type==='CHECK_LIVE'||message.type==='TEST_OVERLAY'){
      prepareOverlay(message.type==='TEST_OVERLAY').then(respond);return true;
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
