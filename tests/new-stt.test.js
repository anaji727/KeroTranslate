import test from 'node:test';import assert from 'node:assert/strict';
import {OpenaiStt,DeeplStt,AudioTurnDetector} from '../extension/core/stt-extra.js';
class Context {
  constructor(){this.state='running';}
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createMediaStreamDestination(){return {stream:{getTracks:()=>[{stop(){}}]}};}
  createAnalyser(){return {fftSize:1024,getFloatTimeDomainData(a){a.fill(0);}};}
  async resume(){}async close(){this.closed=true;}
}
class Peer {
  addTrack(){}createDataChannel(){return this.channel={readyState:'open',send(){},close(){this.closed=true;}};}
  async createOffer(){return {sdp:'offer'};}async setLocalDescription(){}async setRemoteDescription(v){this.remote=v;}close(){this.closed=true;}
}
class Socket {constructor(url){this.url=url;this.readyState=1;this.bufferedAmount=0;this.sent=[];}send(x){this.sent.push(JSON.parse(x));}close(){this.closed=true;}}
class Recorder {constructor(media,options){this.media=media;this.options=options;}start(ms){this.state='recording';this.ms=ms;}stop(){this.state='inactive';}}
const options=()=>({key:'fake-key',language:'ja',Context,Peer,Socket,Recorder,onOpen(){},onResult(){},onError(){}});
const session={streaming_url:'wss://api.deepl.com/v3/voice/realtime/connect',token:'ephemeral'};
const response=data=>({ok:true,json:async()=>data});
test('OpenAI WebRTC creates transcription-only session with supported live model configuration',async()=>{
  let request,opened=0;const p=new OpenaiStt({...options(),onOpen:()=>opened++,fetchImpl:async(url,o)=>{request={url,...o};return {ok:true,text:async()=>'answer'};}});
  try{await p.start({getAudioTracks:()=>[{}]});const config=JSON.parse(request.body.get('session'));
    assert.equal(request.url,'https://api.openai.com/v1/realtime/calls');assert.equal(request.headers.Authorization,'Bearer fake-key');assert.equal(request.body.get('sdp'),'offer');
    assert.equal(config.type,'transcription');assert.equal(config.audio.input.turn_detection,null);assert.deepEqual(config.audio.input.transcription,{model:'gpt-live-transcribe',delay:'low',languages:['ja']});assert.equal(p.peer.remote.sdp,'answer');
    p.channel.onopen();await Promise.resolve();assert.equal(opened,1);
  }finally{p.stop();}assert.equal(p.peer.closed,true);assert.equal(p.context.closed,true);
});
test('OpenAI partial deltas accumulate; out-of-order final events keep their turn sequence',()=>{
  const out=[];const p=new OpenaiStt({...options(),onResult:e=>out.push(e)});
  for(const id of ['one','two'])p.event({type:'input_audio_buffer.committed',item_id:id});
  p.event({type:'conversation.item.input_audio_transcription.delta',item_id:'one',delta:'こん'});
  p.event({type:'conversation.item.input_audio_transcription.delta',item_id:'one',delta:'にちは'});
  p.event({type:'conversation.item.input_audio_transcription.completed',item_id:'two',transcript:'second'});
  p.event({type:'conversation.item.input_audio_transcription.completed',item_id:'one',transcript:'こんにちは。'});
  assert.equal(out[1].text,'こんにちは');assert.equal(out[2].sequence,2);assert.equal(out[3].sequence,1);assert.equal(out[3].final,true);
  const count=out.length;p.stop();p.event({type:'conversation.item.input_audio_transcription.delta',item_id:'late',delta:'late'});assert.equal(out.length,count);
});
test('local endpointing clears silence, commits after pause and bounds continuous sound',()=>{
  const vad=new AudioTurnDetector();let actions=[];
  for(let i=0;i<100;i++){const a=vad.next(0);if(a)actions.push(a);}assert.deepEqual(actions,['clear']);
  vad.next(.03);for(let i=0;i<5;i++)assert.equal(vad.next(0),null);assert.equal(vad.next(0),'commit');
  for(let i=0;i<79;i++)assert.equal(vad.next(.03),null);assert.equal(vad.next(.03),'commit');
});
test('stopping OpenAI during session creation aborts fetch and ignores late answer',async()=>{
  let resolve,signal;const p=new OpenaiStt({...options(),fetchImpl:(_url,o)=>{signal=o.signal;return new Promise(r=>resolve=r);}});
  const starting=p.start({getAudioTracks:()=>[{}]});for(let i=0;i<4;i++)await Promise.resolve();p.stop();resolve({ok:true,text:async()=>'late'});await starting;
  assert.equal(signal.aborted,true);assert.equal(p.peer.closed,true);assert.equal(p.peer.remote,undefined);
});
test('DeepL requests only source STT, downmixes mono and sends ordered base64 WebM',async()=>{
  let body,opened=0;const p=new DeeplStt({...options(),onOpen:()=>opened++,fetchImpl:async(url,o)=>{assert.equal(url,'https://api.deepl.com/v3/voice/realtime');body=JSON.parse(o.body);return response(session);}});
  try{await p.start({});await p.socket.onopen();assert.equal(opened,1);assert.equal(p.mono.channelCount,1);assert.equal(p.recorder.ms,200);assert.equal(body.source_language,'ja');assert.equal(body.source_language_mode,'fixed');assert.equal(body.target_languages,undefined);assert.ok(!p.socket.url.includes('fake-key'));
    p.audio(new Blob(['one']));p.audio(new Blob(['two']));await p.sending;assert.deepEqual(p.socket.sent.map(e=>atob(e.source_media_chunk.data)),['one','two']);
  }finally{p.stop();}assert.equal(p.recorder.state,'inactive');assert.equal(p.context.closed,true);assert.deepEqual(p.socket.sent.at(-1),{end_of_source_media:{}});
});
test('DeepL tentative and concluded transcripts map to partial/final without translating tentative text',()=>{
  const out=[];const p=new DeeplStt({...options(),onResult:e=>out.push(e)});
  p.event({source_transcript_update:{tentative:[{text:'こん'}]}});
  p.event({source_transcript_update:{concluded:[{text:'こんにちは'}],tentative:[{text:'次'}]}});
  assert.deepEqual(out.map(e=>[e.sequence,e.text,e.final]),[[1,'こん',false],[1,'こんにちは',true],[2,'次',false]]);p.stop();
});
test('DeepL refuses a foreign streaming endpoint and reports sanitized errors once',async()=>{
  const errors=[];const p=new DeeplStt({...options(),onError:e=>errors.push(e),fetchImpl:async()=>response({...session,streaming_url:'wss://evil.example/steal'})});
  await p.start({});assert.equal(p.socket,undefined);assert.equal(errors.length,1);assert.ok(!errors[0].includes('ephemeral'));p.fail('late');assert.equal(errors.length,1);
});
test('DeepL stop during token request never opens a socket',async()=>{
  let resolve,signal;const p=new DeeplStt({...options(),fetchImpl:(_url,o)=>{signal=o.signal;return new Promise(r=>resolve=r);}});
  const starting=p.start({});p.stop();resolve(response(session));await starting;assert.equal(signal.aborted,true);assert.equal(p.socket,undefined);
});
test('DeepL backpressure stops capture and pending encodes cannot send after Stop',async()=>{
  const errors=[];const p=new DeeplStt({...options(),onError:e=>errors.push(e),fetchImpl:async()=>response(session)});
  await p.start({});await p.socket.onopen();p.socket.bufferedAmount=2_000_001;p.audio(new Blob(['x']));assert.equal(p.stopped,true);assert.equal(errors.length,1);assert.equal(p.recorder.state,'inactive');
  const q=new DeeplStt({...options(),fetchImpl:async()=>response(session)});await q.start({});await q.socket.onopen();q.audio(new Blob(['late']));q.stop();await q.sending;assert.equal(q.socket.sent.filter(e=>e.source_media_chunk).length,0);
});


for(const [name,Adapter] of [['OpenAI',OpenaiStt],['DeepL',DeeplStt]])for(const supplied of [false,true]){
  test(`${name} STT uses the global fetch receiver (${supplied?'supplied':'default'} transport)`,async t=>{
    const calls=[],errors=[];
    function fetchWithBrowserBrandCheck(url,request){
      if(this!==globalThis)throw new TypeError('Illegal invocation');
      calls.push({url,request});return Promise.resolve(name==='OpenAI'?{ok:true,text:async()=>'answer'}:response(session));
    }
    if(!supplied)t.mock.method(globalThis,'fetch',fetchWithBrowserBrandCheck);
    const adapter=new Adapter({...options(),onError:error=>errors.push(error),...(supplied?{fetchImpl:fetchWithBrowserBrandCheck}:{})});
    try{
      await adapter.start({getAudioTracks:()=>[{}]});assert.deepEqual(errors,[]);assert.equal(calls.length,1);
      assert.equal(calls[0].request.signal,adapter.controller.signal);
      if(name==='OpenAI')assert.equal(adapter.peer.remote.sdp,'answer');else assert.ok(adapter.socket.url.startsWith('wss://api.deepl.com/'));
    }finally{adapter.stop();}
    assert.equal(calls[0]?.request.signal.aborted,true);
  });
}
