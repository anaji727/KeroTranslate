import {Composer} from '../core/composer.js';
import {style} from './style.js';
import {RELEASE_LABEL} from '../core/version.js';
const frogIconUrl=new URL('../assets/kero-frog.png',import.meta.url).href;
export function mountComposer(host,{translate,insert,settings,openSettings=()=>{},captureAction}){
  const root=host.attachShadow({mode:'closed'});
  root.innerHTML=`<style>${style}</style><section class="panel" aria-label="KeroTranslate composer"><header class="head"><span class="frog" aria-hidden="true"><img src="${frogIconUrl}" alt="" width="29" height="29"></span><span class="brand">KeroTranslate</span><span class="tag">${RELEASE_LABEL}</span><button class="gear" aria-label="Open settings">⚙</button></header><div class="body"><div class="bar"><select aria-label="Translation direction"><option value="en">EN → JA</option><option value="ja">JA → EN</option></select><span class="micro provider"></span><span class="phase" role="status"></span></div><label class="label" for="original">Original <span>Your words</span></label><textarea id="original" maxlength="2000" placeholder="Say something to the stream…"></textarea><div class="row-actions"><span class="micro count">0 / 2000</span><button class="original-insert">INSERT ↗</button></div><label class="label" for="mtl">MTL <span>Translation · editable when current</span></label><textarea id="mtl" maxlength="2000" placeholder="Your translation will appear here"></textarea><div class="row-actions"><span class="micro timing">Waiting for your words</span><button class="mtl-insert insert">INSERT ↗</button></div><div class="back-label">re-MTL <span class="micro">/ meaning check</span></div><div class="back" aria-live="polite">—</div><div class="notice" role="status"></div><div class="conflict hidden">YouTube already has a draft. Replace it?<div><button class="replace">Replace draft</button><button class="keep">Keep draft</button></div></div><div class="tools"><button class="retry hidden">Retry</button></div></div><footer class="foot">INSERT fills the chat input. It never sends.<br>re-MTL helps you check meaning; it cannot guarantee accuracy.</footer></section>`;
  const q=s=>root.querySelector(s);let pending=null,busy=false,mtlComposing=false;
  let captureBusy=false,captureValue='STOPPED';
  const controls=document.createElement('div');controls.className='capture-controls';
  controls.innerHTML='<div class="bar"><button class="capture-start insert">Start captions</button><button class="capture-stop">Stop</button><span class="capture-state micro" role="status">STOPPED</span></div><div class="capture-message notice" role="status"></div>';
  if(captureAction)q('.body').prepend(controls);
  function captureStatus({status='STOPPED',error=''}){
    captureValue=status;if(!captureAction)return;
    controls.querySelector('.capture-state').textContent=status;
    controls.querySelector('.capture-message').textContent=error;
    controls.querySelector('.capture-start').disabled=captureBusy||!['STOPPED','ERROR'].includes(status);
    controls.querySelector('.capture-stop').disabled=captureBusy||status==='STOPPED';
  }
  async function controlCapture(action){
    if(captureBusy)return;captureBusy=true;captureStatus({status:captureValue});
    try{const r=await captureAction(action);captureStatus({status:r.ok?r.status:captureValue,error:r.ok?r.error:r.error||'Capture unavailable.'});}
    catch{captureStatus({status:captureValue,error:'Extension unavailable. Reload this YouTube page.'});}
    finally{captureBusy=false;const error=controls.querySelector('.capture-message').textContent;captureStatus({status:captureValue,error});}
  }
  controls.querySelector('.capture-start').onclick=()=>controlCapture('start');controls.querySelector('.capture-stop').onclick=()=>controlCapture('stop');captureStatus({});
  const state=new Composer({translate,onChange:s=>{
    q('.phase').textContent=s.phase;q('.phase').dataset.state=s.phase;
    if(q('#original').value!==s.original)q('#original').value=s.original;
    if(q('#mtl').value!==s.mtl)q('#mtl').value=s.mtl;
    q('#mtl').disabled=!['READY','BACK_TRANSLATING','EDITING_MTL'].includes(s.phase);
    q('#mtl').classList.toggle('muted',['STALE','TRANSLATING'].includes(s.phase));
    q('.back').textContent=s.back||'—';q('.notice').textContent=s.error;
    q('.original-insert').disabled=!state.canInsert('original')||busy;
    q('.mtl-insert').disabled=!state.canInsert('mtl')||busy;
    q('.count').textContent=`${s.original.length} / 2000`;
    q('.timing').textContent=s.phase==='READY'?`${(s.elapsed/1000).toFixed(1)}s · translated + checked`:'Latest text only';
    q('.retry').classList.toggle('hidden',s.phase!=='ERROR');
    pending=null;q('.conflict').classList.add('hidden');
  }});
  const refresh=config=>{settings=config;q('select').value=config.source;q('.provider').textContent=({gemini:'Gemini',openai:'OpenAI',deepl:'DeepL',deepseek:'DeepSeek'})[config.translationProvider]||'Unknown';state.configure(config);};
  refresh(settings);
  q('#original').addEventListener('compositionstart',()=>state.compositionStart());
  q('#original').addEventListener('compositionend',e=>state.compositionEnd(e.target.value));
  q('#original').addEventListener('input',e=>state.input(e.target.value));
  q('#mtl').addEventListener('compositionstart',()=>{mtlComposing=true;state.invalidate();state.state.phase='EDITING_MTL';state.state.back='';state.emit();});
  q('#mtl').addEventListener('compositionend',e=>{mtlComposing=false;state.editMtl(e.target.value);});
  q('#mtl').addEventListener('input',e=>{if(!mtlComposing)state.editMtl(e.target.value);});
  q('select').addEventListener('change',e=>state.configure({source:e.target.value}));
  q('.gear').onclick=openSettings;q('.retry').onclick=()=>state.retry();
  async function insertText(kind,replace=false){
    if(busy||!state.canInsert(kind))return;
    const text=kind==='original'?state.state.original:state.state.mtl;
    const expected=pending?.expected;
    busy=true;state.emit();
    try{
      const result=await insert(text,{replace,expected});
      if(result.conflict){pending={kind,expected:result.expected};q('.conflict').classList.remove('hidden');}
      else q('.notice').textContent=result.message||'Inserted. Review and send in YouTube.';
    }catch(error){q('.notice').textContent=error.message;}finally{busy=false;q('.original-insert').disabled=!state.canInsert('original');q('.mtl-insert').disabled=!state.canInsert('mtl');}
  }
  q('.original-insert').onclick=()=>insertText('original');q('.mtl-insert').onclick=()=>insertText('mtl');
  q('.replace').onclick=()=>{if(pending)insertText(pending.kind,true);};
  q('.keep').onclick=()=>{pending=null;q('.conflict').classList.add('hidden');};
  return {state,refresh,captureStatus,dispose:()=>{state.dispose();host.remove();}};
}
