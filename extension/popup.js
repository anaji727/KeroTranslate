const q=id=>document.getElementById(id);let tabId;
const tabs=await chrome.tabs.query({active:true,currentWindow:true});tabId=tabs[0]?.id;
async function refresh(){const r=await chrome.runtime.sendMessage({type:'STATUS'});q('status').textContent=r.capture?.status||'Stopped';q('providers').textContent=`STT: ${r.settings.sttProvider} · MTL: ${r.settings.translationProvider}`;q('languages').textContent=`Speech: ${r.settings.speechLanguage} → Captions: ${r.settings.captionTarget}`;if(r.capture?.error)q('message').textContent=r.capture.error;}
q('test').onclick=async()=>{try{const r=await chrome.runtime.sendMessage({type:'TEST_OVERLAY',tabId});q('message').textContent=r.ok?'Test caption shown. No audio or API request.':r.error;}catch{q('message').textContent='Reload this YouTube page and try again.';}};
q('settings').onclick=()=>chrome.runtime.openOptionsPage();refresh();setInterval(refresh,1500);
