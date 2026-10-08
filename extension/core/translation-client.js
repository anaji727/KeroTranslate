// Offscreen audio submits text to the worker's shared translation scheduler.
export async function queuedTranslate({sessionId,text,target,signal},onUsage=()=>{}){
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const requestId=crypto.randomUUID();
  const abort=()=>chrome.runtime.sendMessage({type:'CAPTION_CANCEL',id:sessionId,requestId}).catch(()=>{});
  signal.addEventListener('abort',abort,{once:true});
  try{
    const result=await chrome.runtime.sendMessage({type:'CAPTION_TRANSLATE',id:sessionId,requestId,request:{text,target}});
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    if(!result?.ok){const error=new Error(result?.error||'Caption translation unavailable.');error.code=result?.code;error.retryAfterMs=result?.retryAfterMs;throw error;}
    onUsage(result.usage||{});return result.text;
  }finally{signal.removeEventListener('abort',abort);}
}
