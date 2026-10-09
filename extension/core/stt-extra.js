import {checkProviderResponse} from './providers.js';

// Simple local energy endpointing, not a speech classifier. Game/music audio may
// keep a turn open; the 8-second cap bounds that delay. Never commit empty silence.
export class AudioTurnDetector {
  constructor(){this.elapsed=0;this.speech=0;this.quiet=0;}
  next(rms,ms=100){
    this.elapsed+=ms;
    if(rms>=0.015){this.speech+=ms;this.quiet=0;}else this.quiet+=ms;
    let action=null;
    if(this.speech>=100&&(this.quiet>=600||this.elapsed>=8000))action='commit';
    else if(!this.speech&&this.elapsed>=10000)action='clear';
    if(action){this.elapsed=0;this.speech=0;this.quiet=0;}
    return action;
  }
}

class LiveStt {
  constructor({fetchImpl=globalThis.fetch,...options}){
    // Browser-native fetch must receive the Window/Worker global, not this adapter.
    Object.assign(this,{onBytes:()=>{},stopped:false,...options});
    this.fetchImpl=(...args)=>Reflect.apply(fetchImpl,globalThis,args);
    this.controller=new AbortController();
  }
  fail(message){if(this.stopped)return;this.stop();this.onError(message);}
  timeoutStart(label){this.timeout=setTimeout(()=>this.fail(`${label} connection timed out. Check API access and network.`),20000);}
  stop(){
    this.stopped=true;clearTimeout(this.timeout);clearInterval(this.vadTimer);this.controller.abort();
    if(this.recorder?.state==='recording')this.recorder.stop();
    if(this.socket){this.socket.onclose=null;this.socket.onerror=null;this.socket.close();}
    if(this.channel){this.channel.onclose=null;this.channel.onerror=null;this.channel.close();}
    if(this.peer){this.peer.onconnectionstatechange=null;this.peer.close();}
    this.source?.disconnect();this.context?.close().catch(()=>{});
    this.mono?.stream.getTracks().forEach(t=>t.stop());
  }
}

export class OpenaiStt extends LiveStt {
  constructor(options){super(options);this.Peer=options.Peer||globalThis.RTCPeerConnection;this.Context=options.Context||globalThis.AudioContext;this.items=new Map();this.ordinal=0;}
  async start(media){
    if(!this.key)throw new Error('OpenAI key missing. Add it in Settings.');
    this.timeoutStart('OpenAI');
    try{
      const peer=this.peer=new this.Peer();
      for(const track of media.getAudioTracks())peer.addTrack(track,media);
      peer.onconnectionstatechange=()=>{if(['failed','disconnected','closed'].includes(peer.connectionState))this.fail('OpenAI audio connection ended. Restart captions manually.');};
      const channel=this.channel=peer.createDataChannel('oai-events');
      channel.onmessage=e=>{if(this.stopped)return;let event;try{event=JSON.parse(e.data);}catch{return;}this.event(event);};
      channel.onerror=()=>this.fail('OpenAI transcription connection failed.');
      channel.onclose=()=>this.fail('OpenAI transcription disconnected. Restart captions manually.');
      channel.onopen=()=>{
        if(this.stopped)return;clearTimeout(this.timeout);
        try{
          const context=this.context=new this.Context();this.source=context.createMediaStreamSource(media);
          const analyser=this.analyser=context.createAnalyser();analyser.fftSize=1024;this.source.connect(analyser);
          const samples=new Float32Array(analyser.fftSize),detector=new AudioTurnDetector();
          context.resume().then(()=>{if(this.stopped)return;if(context.state!=='running'){this.fail('OpenAI audio analysis could not start.');return;}this.onOpen();}).catch(()=>this.fail('OpenAI audio analysis could not start.'));
          this.vadTimer=setInterval(()=>{
            if(this.stopped||channel.readyState!=='open')return;
            analyser.getFloatTimeDomainData(samples);
            const rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);
            const action=detector.next(rms);
            if(action)try{channel.send(JSON.stringify({type:`input_audio_buffer.${action}`}));}catch{this.fail('OpenAI audio transport failed.');}
          },100);
        }catch{this.fail('OpenAI audio analysis could not start.');}
      };
      const offer=await peer.createOffer();if(this.stopped)return;
      await peer.setLocalDescription(offer);if(this.stopped)return;
      const transcription={model:'gpt-live-transcribe',delay:'low'};
      if(this.language!=='multi')transcription.languages=[this.language];
      const form=new FormData();form.set('sdp',offer.sdp);form.set('session',JSON.stringify({type:'transcription',audio:{input:{transcription,turn_detection:null}}}));
      const response=await this.fetchImpl('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:`Bearer ${this.key}`},body:form,signal:this.controller.signal});
      if(this.stopped)return;checkProviderResponse(response);const sdp=await response.text();if(this.stopped)return;
      await peer.setRemoteDescription({type:'answer',sdp});
    }catch(e){if(!this.stopped)this.fail(e.code?e.message:'OpenAI STT could not connect. Check API key, live transcription access and network.');}
  }
  item(id){
    if(!this.items.has(id)){this.items.set(id,{sequence:++this.ordinal,text:'',final:false});if(this.items.size>200)this.items.delete(this.items.keys().next().value);}
    return this.items.get(id);
  }
  event(e){
    if(this.stopped)return;
    if(e.type==='error'||e.type==='conversation.item.input_audio_transcription.failed'){this.fail('OpenAI transcription failed. Check your API usage and live transcription access.');return;}
    if(!e.item_id)return;
    if(e.type==='input_audio_buffer.committed'){this.item(e.item_id);return;}
    const final=e.type==='conversation.item.input_audio_transcription.completed';
    if(!final&&e.type!=='conversation.item.input_audio_transcription.delta')return;
    const item=this.item(e.item_id);if(item.final)return;
    item.text=final?(e.transcript||''):item.text+(e.delta||'');item.final=final;
    if(item.text.trim())this.onResult({id:e.item_id,sequence:item.sequence,text:item.text.trim(),final});
  }
}

export class DeeplStt extends LiveStt {
  constructor(options){super(options);this.Socket=options.Socket||globalThis.WebSocket;this.Recorder=options.Recorder||globalThis.MediaRecorder;this.Context=options.Context||globalThis.AudioContext;this.sequence=1;this.pendingBytes=0;this.sending=Promise.resolve();}
  stop(){
    if(!this.stopped&&this.socket?.readyState===1)try{this.socket.send(JSON.stringify({end_of_source_media:{}}));}catch{}
    super.stop();
  }
  async start(media){
    if(!this.key)throw new Error('DeepL API key missing. Voice requires a paid API plan with Voice access.');
    this.timeoutStart('DeepL Voice');
    try{
      const body={source_media_content_type:'audio/webm;codecs=opus'};
      if(this.language!=='multi'){body.source_language=this.language;body.source_language_mode='fixed';}
      const response=await this.fetchImpl('https://api.deepl.com/v3/voice/realtime',{method:'POST',signal:this.controller.signal,headers:{'Content-Type':'application/json',Authorization:`DeepL-Auth-Key ${this.key}`},body:JSON.stringify(body)});
      if(this.stopped)return;checkProviderResponse(response);const session=await response.json();if(this.stopped)return;
      const url=new URL(session.streaming_url);
      // Never send even a short-lived token to a host supplied outside our allowlist.
      if(url.origin!=='wss://api.deepl.com'||url.pathname!=='/v3/voice/realtime/connect'||url.username||url.password||!session.token)throw new Error('Unexpected DeepL stream endpoint.');
      url.search='';url.hash='';url.searchParams.set('token',session.token);
      const socket=this.socket=new this.Socket(url.href);
      socket.onopen=async()=>{
        if(this.stopped)return;
        try{
          const context=this.context=new this.Context();this.source=context.createMediaStreamSource(media);
          const mono=this.mono=context.createMediaStreamDestination();mono.channelCount=1;mono.channelCountMode='explicit';this.source.connect(mono);
          await context.resume();if(this.stopped)return;
          if(context.state!=='running')throw new Error('Audio suspended.');
          const recorder=this.recorder=new this.Recorder(mono.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:32000});
          recorder.ondataavailable=e=>this.audio(e.data);
          recorder.onerror=()=>this.fail('DeepL audio encoding failed.');
          recorder.start(200);clearTimeout(this.timeout);this.onOpen();
        }catch{this.fail('DeepL audio encoding could not start.');}
      };
      socket.onmessage=e=>{if(this.stopped)return;let event;try{event=JSON.parse(e.data);}catch{return;}this.event(event);};
      socket.onerror=()=>this.fail('DeepL Voice connection failed. Check Voice API access, quota and network.');
      socket.onclose=()=>this.fail('DeepL Voice disconnected. Restart captions manually.');
    }catch(e){if(!this.stopped)this.fail(e.code?e.message:'DeepL Voice could not connect. A paid API plan with Voice access is required.');}
  }
  audio(blob){
    if(this.stopped||!blob.size)return;
    this.pendingBytes+=blob.size;
    if(this.pendingBytes+(this.socket?.bufferedAmount||0)>2_000_000){this.fail('DeepL audio connection is too slow. Capture stopped.');return;}
    this.sending=this.sending.then(async()=>{
      if(this.stopped)return;const bytes=new Uint8Array(await blob.arrayBuffer());if(this.stopped)return;
      if(this.socket.readyState!==1)throw new Error('Disconnected.');
      let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
      this.socket.send(JSON.stringify({source_media_chunk:{data:btoa(binary)}}));this.onBytes(bytes.length);
    }).catch(()=>this.fail('DeepL audio transport failed.')).finally(()=>{this.pendingBytes-=blob.size;});
  }
  event(e){
    if(this.stopped)return;
    if(e.error||e.end_of_stream){this.fail(e.error?'DeepL Voice returned an error. Check Voice access and usage.':'DeepL Voice session ended. Restart captions manually.');return;}
    const update=e.source_transcript_update;if(!update)return;
    const concluded=(update.concluded||[]).map(s=>s.text||'').join('').trim();
    if(concluded){this.onResult({id:`deepl-${this.sequence}`,sequence:this.sequence,text:concluded,final:true});this.sequence++;}
    const tentative=(update.tentative||[]).map(s=>s.text||'').join('').trim();
    if(tentative)this.onResult({id:`deepl-${this.sequence}`,sequence:this.sequence,text:tentative,final:false});
  }
}
