import {sanitizeSettings} from '../core/settings.js';
export function mountCaptions(host,settings){
  host.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:50;display:grid;padding:5%;box-sizing:border-box;';
  const root=host.attachShadow({mode:'closed'});
  root.innerHTML=`<style>:host{position:absolute;inset:0;pointer-events:none;z-index:50;display:grid;padding:5%;box-sizing:border-box}.text{width:max-content;max-width:90%;color:white;background:#111b14e8;border-left:3px solid #b8ed9a;padding:9px 17px;border-radius:5px;font-family:system-ui,sans-serif;font-size:clamp(14px,2vw,24px);line-height:1.5;text-shadow:0 1px 2px #000;box-shadow:0 4px 18px #0005}.original,.recognition{font-size:.73em;color:#d0ddd0}.recognition{color:#fff}.recognition.partial{color:#a8b7ad}.recognition.separate{border-top:1px solid #73857580;margin-top:6px;padding-top:5px}.translation{font-weight:600}.original,.translation,.recognition{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;white-space:pre-wrap}.hidden{display:none!important}</style><div class="text"><div class="original"></div><div class="translation"></div><div class="recognition"></div></div>`;
  let timer,current=null,completed=null,lastSequence=0;
  const box=root.querySelector('.text'),original=root.querySelector('.original'),translation=root.querySelector('.translation'),recognition=root.querySelector('.recognition');
  function render(){
    const showOriginal=settings.captionMode!=='translation',showTranslation=settings.captionMode!=='original';
    original.textContent=completed?.original||'';translation.textContent=completed?.translation||'';
    recognition.textContent=current?`${current.original}${current.phase==='partial'?' …':''}`:'';
    original.classList.toggle('hidden',!showOriginal||!original.textContent);
    translation.classList.toggle('hidden',!showTranslation||!translation.textContent);
    recognition.classList.toggle('hidden',!showOriginal||!current);
    recognition.classList.toggle('partial',current?.phase==='partial');
    recognition.classList.toggle('separate',!!current&&!!completed);
    box.style.display=(showOriginal&&(original.textContent||current?.original))||(showTranslation&&translation.textContent)?'block':'none';
  }
  function configure(input){
    settings=sanitizeSettings(input);const p=settings.captionPosition;
    host.style.alignItems=({T:'start',M:'center',B:'end'})[p[0]];host.style.justifyItems=({L:'start',C:'center',R:'end'})[p[1]];
    for(const node of [original,translation,recognition])node.style.webkitLineClamp=settings.captionLines;
    const scale=settings.captionSize/100;box.style.fontSize=`clamp(${14*scale}px,${2*scale}vw,${24*scale}px)`;render();
  }
  function clear(){clearTimeout(timer);current=null;completed=null;lastSequence=0;render();}
  function show(cue){
    const {original:src='',translation:out='',pending=false,pendingNext=false}=cue;
    const phase=cue.phase||(pending?'final':'translated');
    const sequence=cue.sequence??(phase==='partial'||phase==='final'?lastSequence+1:lastSequence);
    if((phase==='partial'||phase==='final')&&sequence<lastSequence)return;
    if(phase==='partial'&&current?.sequence===sequence&&current.phase==='final')return;
    if((phase==='partial'||phase==='final')&&completed?.sequence>=sequence)return;
    if(phase!=='partial'&&phase!=='final'&&completed&&sequence<completed.sequence)return;
    clearTimeout(timer);
    if(phase==='partial'||phase==='final'){
      lastSequence=Math.max(lastSequence,sequence);
      current={original:src,phase,sequence};
      if(settings.captionMode==='original')completed=null;
      if(phase==='final'&&settings.captionMode==='original')timer=setTimeout(clear,settings.captionDuration*1000);
    }else{
      completed={original:src,translation:out,sequence};
      lastSequence=Math.max(lastSequence,sequence);
      // A late translation for A must not erase partial/final speech from B.
      if(current&&current.sequence<=sequence)current=null;
      if(!current&&!pendingNext)timer=setTimeout(clear,settings.captionDuration*1000);
    }
    render();
  }
  configure(settings);clear();return {show,clear,configure,dispose(){clear();host.remove();}};
}
