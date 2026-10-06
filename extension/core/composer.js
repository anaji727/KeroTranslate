// Framework-independent state machine. A revision covers source, direction and settings.
export class Composer {
  constructor({translate,onChange=()=>{},debounce=650}) {
    Object.assign(this,{translate,onChange,debounce,revision:0,composing:false,disposed:false});
    this.state={original:'',mtl:'',back:'',phase:'EMPTY',source:'ja',target:'en',error:'',elapsed:0};
  }
  emit(){this.onChange({...this.state});}
  invalidate(){clearTimeout(this.timer);this.controller?.abort();this.revision++;}
  input(text){
    this.invalidate(); this.state.original=text;
    this.state.error='';this.state.phase=text.trim()?'STALE':'EMPTY';
    if(!text.trim()){this.state.mtl='';this.state.back='';}
    this.emit();
    if(text.trim()&&!this.composing)this.timer=setTimeout(()=>this.run(),this.debounce);
  }
  compositionStart(){this.composing=true;this.invalidate();this.state.phase=this.state.original?'STALE':'EMPTY';this.emit();}
  compositionEnd(text){this.composing=false;this.input(text);}
  configure({source=this.state.source}={}){this.state.source=source;this.state.target=source==='ja'?'en':'ja';this.input(this.state.original);}
  editMtl(text){
    // Do not permit turning a stale translation into an insertable current one.
    if(!['READY','BACK_TRANSLATING','EDITING_MTL'].includes(this.state.phase))return;
    this.invalidate();this.state.mtl=text;this.state.back='';this.state.phase='EDITING_MTL';this.emit();
    if(text.trim())this.timer=setTimeout(()=>this.run(true),this.debounce);
  }
  async run(backOnly=false){
    if(this.disposed||this.composing||!this.state.original.trim())return;
    this.invalidate();const version=this.revision;
    const controller=this.controller=new AbortController();const start=performance.now();
    const {original,source,target}=this.state;
    const current=()=>!this.disposed&&version===this.revision&&!controller.signal.aborted;
    this.state.error='';
    try{
      if(!backOnly){
        this.state.phase='TRANSLATING';this.emit();
        const mtl=await this.translate({text:original,source,target,signal:controller.signal});
        if(!current())return;this.state.mtl=mtl;
      }
      this.state.back='';this.state.phase='BACK_TRANSLATING';this.emit();
      const back=await this.translate({text:this.state.mtl,source:target,target:source,signal:controller.signal});
      if(!current())return;
      this.state.back=back;this.state.elapsed=Math.round(performance.now()-start);this.state.phase='READY';this.emit();
    }catch(error){if(!current())return;this.failedBackOnly=this.state.phase==='BACK_TRANSLATING';this.state.error=error.message||'Translation failed';this.state.phase='ERROR';this.emit();}
  }
  retry(){return this.run(!!this.failedBackOnly);}
  canInsert(kind){return kind==='original'?!!this.state.original.trim():this.state.phase==='READY'&&!!this.state.mtl.trim();}
  dispose(){this.disposed=true;this.invalidate();}
}
