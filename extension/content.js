(async()=>{
  const [{mountComposer},{mountCaptions},{insertDraft,livePlayer}]=await Promise.all([
    import(chrome.runtime.getURL('ui/composer-view.js')),import(chrome.runtime.getURL('ui/captions.js')),import(chrome.runtime.getURL('youtube.js'))
  ]);
  let config,composer,captions,captionHost,chatHost,lastUrl=location.href,queued=false;
  const send=message=>chrome.runtime.sendMessage(message);
  async function translate({signal,...request}){
    const id=crypto.randomUUID();const abort=()=>send({type:'CANCEL',id}).catch(()=>{});
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    signal.addEventListener('abort',abort,{once:true});
    try{const result=await send({type:'TRANSLATE',id,request});if(signal.aborted)throw new DOMException('Aborted','AbortError');if(!result?.ok)throw new Error(result?.error||'Extension unavailable. Reload this page.');return result.text;}finally{signal.removeEventListener('abort',abort);}
  }
  function cleanup(){composer?.dispose();composer=null;captions?.dispose();captions=null;chatHost=null;captionHost=null;send({type:'NAVIGATED'}).catch(()=>{});}
  async function mount(){
    if(lastUrl!==location.href){cleanup();lastUrl=location.href;}
    if(!config){const result=await send({type:'CONFIG'});config=result.settings;}
    if(/^\/live_chat\/?$/.test(location.pathname)){
      const renderer=document.querySelector('yt-live-chat-message-input-renderer');
      if(renderer&&(!chatHost?.isConnected)){
        composer?.dispose();chatHost=document.createElement('div');chatHost.style.cssText='flex:none;max-height:55vh;overflow:auto;margin:0 8px 8px;';
        renderer.before(chatHost);
        composer=mountComposer(chatHost,{settings:config,translate,insert:insertDraft,openSettings:()=>send({type:'OPEN_SETTINGS'})});
      }
    }else if(window===window.top){
      const player=livePlayer();
      if(player&&!captionHost?.isConnected){captions?.dispose();captionHost=document.createElement('div');player.append(captionHost);captions=mountCaptions(captionHost,config);}
    }
  }
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if(message.type==='CHECK_LIVE'){respond({live:!!livePlayer()});return;}
    if(message.type==='CAPTION')captions?.show(message.cue);
    if(message.type==='CAPTURE_STATUS'&&message.status!=='LISTENING'&&message.status!=='NO_SPEECH')captions?.clear();
    if(message.type==='CONFIG_CHANGED'){config=message.settings;composer?.refresh(config);captions?.configure(config);}
  });
  const observer=new MutationObserver(()=>{if(!queued){queued=true;setTimeout(()=>{queued=false;mount().catch(()=>{});},400);}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('yt-navigate-start',cleanup);
  window.addEventListener('pagehide',()=>{cleanup();observer.disconnect();},{once:true});
  await mount();
})().catch(()=>{});
