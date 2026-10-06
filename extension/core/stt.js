// STT boundary: start(MediaStream), stop(); callbacks never contain keys.
export class DeepgramStt {
  constructor({key,language,onResult,onOpen,onError,onBytes=()=>{},Socket=WebSocket,Recorder=MediaRecorder}){Object.assign(this,{key,language,onResult,onOpen,onError,onBytes,Socket,Recorder,stopped:false});}
  start(media){
    const params=new URLSearchParams({model:'nova-3',language:this.language,smart_format:'true',interim_results:'true',endpointing:'350',mip_opt_out:'true'});
    let socket;try{socket=this.socket=new this.Socket(`wss://api.deepgram.com/v1/listen?${params}`,['token',this.key]);}catch{throw new Error('STT connection could not be created. Check your key format.');}
    this.timeout=setTimeout(()=>this.fail('STT connection timed out. Check your key and network.'),12000);
    socket.onopen=()=>{
      if(this.stopped)return;clearTimeout(this.timeout);
      try{
        const recorder=this.recorder=new this.Recorder(media,{mimeType:'audio/webm;codecs=opus'});
        recorder.ondataavailable=e=>{if(!this.stopped&&socket.readyState===1&&e.data.size){if(socket.bufferedAmount>2_000_000){this.fail('STT connection is too slow. Capture stopped.');return;}socket.send(e.data);this.onBytes(e.data.size);}};
        recorder.onerror=()=>this.fail('Audio encoding failed. Capture stopped.');recorder.start(250);this.onOpen();
      }catch{this.fail('Audio encoding could not start.');}
    };
    socket.onmessage=event=>{
      if(this.stopped)return;let data;try{data=JSON.parse(event.data);}catch{return;}
      if(data.type==='Error'){this.fail('STT provider returned an error. Check your account and model.');return;}
      if(data.type==='Results'&&data.channel?.alternatives?.[0]?.transcript)this.onResult({id:String(data.start),text:data.channel.alternatives[0].transcript,final:!!data.is_final});
    };
    socket.onerror=()=>this.fail('STT connection failed. Browser WebSocket errors cannot distinguish a bad key, quota, or network failure. Check Deepgram usage.');
    socket.onclose=()=>this.fail('STT disconnected. Capture stopped; restart manually.');
  }
  fail(message){if(this.stopped)return;this.stop();this.onError(message);}
  stop(){this.stopped=true;clearTimeout(this.timeout);if(this.recorder?.state==='recording')this.recorder.stop();if(this.socket){this.socket.onclose=null;this.socket.onerror=null;this.socket.close();}}
}
export class DemoStt {
  constructor({samples,onResult,onOpen}){Object.assign(this,{samples,onResult,onOpen,index:0});}
  start(){this.onOpen();const next=()=>this.onResult({id:String(this.index),text:this.samples[this.index++%this.samples.length][0],final:true});next();this.timer=setInterval(next,5500);}
  stop(){clearInterval(this.timer);}
}
export function createSttProvider(provider,options){if(provider==='demo')return new DemoStt(options);if(provider==='deepgram')return new DeepgramStt(options);throw new Error('Unsupported STT provider.');}
