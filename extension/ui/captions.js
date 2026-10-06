import {sanitizeSettings} from '../core/settings.js';
export function mountCaptions(host,settings){
  host.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:50;display:grid;padding:5%;box-sizing:border-box;';
  const root=host.attachShadow({mode:'closed'});
  root.innerHTML=`<style>:host{position:absolute;inset:0;pointer-events:none;z-index:50;display:grid;padding:5%;box-sizing:border-box}.text{width:max-content;max-width:90%;color:white;background:#111b14e8;border-left:3px solid #b8ed9a;padding:9px 17px;border-radius:5px;font-family:system-ui,sans-serif;font-size:clamp(14px,2vw,24px);line-height:1.5;text-shadow:0 1px 2px #000;box-shadow:0 4px 18px #0005}.original{font-size:.73em;color:#d0ddd0}.translation{font-weight:600}.original,.translation{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;white-space:pre-wrap}.text:empty{display:none}.hidden{display:none!important}</style><div class="text"><div class="original"></div><div class="translation"></div></div>`;
  let timer;const box=root.querySelector('.text'),original=root.querySelector('.original'),translation=root.querySelector('.translation');
  function configure(input){const s=settings=sanitizeSettings(input);const p=s.captionPosition;host.style.alignItems=({T:'start',M:'center',B:'end'})[p[0]];host.style.justifyItems=({L:'start',C:'center',R:'end'})[p[1]];original.style.webkitLineClamp=s.captionLines;translation.style.webkitLineClamp=s.captionLines;original.classList.toggle('hidden',s.captionMode==='translation');translation.classList.toggle('hidden',s.captionMode==='original');const scale=s.captionSize/100;box.style.fontSize=`clamp(${14*scale}px,${2*scale}vw,${24*scale}px)`;}
  function clear(){clearTimeout(timer);original.textContent='';translation.textContent='';box.style.display='none';}
  function show({original:src='',translation:out='',pending=false,pendingNext=false}){
    clearTimeout(timer);
    // A new recognition interim must not erase the last readable translation.
    if(pending&&settings.captionMode!=='original'){
      if(!translation.textContent){original.textContent=src;box.style.display=src&&settings.captionMode!=='translation'?'block':'none';}
      return;
    }
    original.textContent=src;translation.textContent=out;box.style.display=(settings.captionMode==='translation'?out:src||out)?'block':'none';
    if(!pendingNext)timer=setTimeout(clear,settings.captionDuration*1000);
  }
  configure(settings);clear();return {show,clear,configure,dispose(){clear();host.remove();}};
}
