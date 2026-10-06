import {mountComposer} from '../extension/ui/composer-view.js';
import {mountCaptions} from '../extension/ui/captions.js';
import {DEFAULTS} from '../extension/core/settings.js';
import {demoTranslate,FIXTURES} from '../extension/core/providers.js';
const q=s=>document.querySelector(s);let settings={...DEFAULTS},index=0,playing=true,timer;
const captions=mountCaptions(q('#caption-host'),settings);
const composer=mountComposer(q('#composer-host'),{settings,demo:true,translate:demoTranslate,openSettings:()=>q('#info').showModal(),insert:async(text,{replace,expected})=>{
  const input=q('#native');
  if(input.value===text)return {message:'Already inserted. Nothing was added.'};
  if(input.value&&(!replace||expected!==input.value))return {conflict:true,expected:input.value};
  input.value=text;input.focus();q('#draft-status').textContent='Inserted · not sent';return {message:'Inserted into the demo input. No posting is available here.'};
}});
composer.state.input('今日も配信ありがとう！');
let stages=[];
function sample(){
  stages.forEach(clearTimeout);stages=[];
  const pair=FIXTURES[index++%FIXTURES.length],sequence=index;
  if(!playing){captions.show({sequence,phase:'translated',original:pair[0],translation:pair[1]});return;}
  captions.show({sequence,phase:'partial',original:pair[0].slice(0,Math.ceil(pair[0].length/2))});
  stages.push(setTimeout(()=>captions.show({sequence,phase:'partial',original:pair[0]}),600));
  stages.push(setTimeout(()=>captions.show({sequence,phase:'final',original:pair[0]}),1300));
  stages.push(setTimeout(()=>captions.show({sequence,phase:'translated',original:pair[0],translation:pair[1]}),2300));
}
function run(){sample();timer=setInterval(sample,5500);}run();
q('#play').onclick=()=>{playing=!playing;q('#play').textContent=playing?'Ⅱ Pause samples':'▶ Play samples';q('#sample-status').textContent=playing?'Sample captions playing':'Paused · sample data';clearInterval(timer);stages.forEach(clearTimeout);stages=[];if(playing)run();else captions.clear();};
q('#modes').onclick=e=>{const mode=e.target.dataset.mode;if(!mode)return;settings.captionMode=mode;for(const b of q('#modes').children)b.classList.toggle('selected',b.dataset.mode===mode);captions.configure(settings);if(!playing)sample();};
const positions=['TL','TC','TR','ML','MC','MR','BL','BC','BR'],glyphs=['↖','↑','↗','←','·','→','↙','↓','↘'];
positions.forEach((p,i)=>{const b=document.createElement('button');b.textContent=glyphs[i];b.setAttribute('aria-label',`Position ${p}`);b.setAttribute('aria-pressed',String(p===settings.captionPosition));b.classList.toggle('active',p===settings.captionPosition);b.onclick=()=>{settings.captionPosition=p;for(const btn of q('#positions').children){btn.classList.toggle('active',btn===b);btn.setAttribute('aria-pressed',String(btn===b));}captions.configure(settings);if(!playing)sample();};q('#positions').append(b);});
q('#lines').onchange=e=>{settings.captionLines=Number(e.target.value);captions.configure(settings);};q('#about').onclick=()=>q('#info').showModal();q('#close').onclick=()=>q('#info').close();
q('#size').onchange=e=>{settings.captionSize=Number(e.target.value);captions.configure(settings);};
