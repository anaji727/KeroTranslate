// Keep a readable error visible while status updates continue underneath it.
export function createNotice(node,{minimumMs=1000,now=()=>Date.now(),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}){
  let until=0,timer=null,pending=null,disposed=false;
  function set(text='',error=false){
    if(disposed)return;
    if(text===node.textContent){pending=null;if(timer!==null){clearTimer(timer);timer=null;}return;}
    if(now()<until){
      pending={text,error};
      if(timer===null)timer=setTimer(()=>{timer=null;const next=pending;pending=null;if(next)set(next.text,next.error);},until-now());
      return;
    }
    if(timer!==null){clearTimer(timer);timer=null;}
    pending=null;node.textContent=text;until=error&&text?now()+minimumMs:0;
  }
  return {set,dispose(){disposed=true;if(timer!==null)clearTimer(timer);pending=null;}};
}
