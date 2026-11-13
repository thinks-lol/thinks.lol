import {frequency,midiPitch,bendRangeMessages} from './music.js';
export class Engine {
  constructor(onStatus) { this.onStatus=onStatus;this.mode='off';this.voices=new Map();this.ctx=null;this.midiAccess=null;this.output=null;this.node=null;this.mpe=false;this.channel=0;this.volume=.45;this.wave='soft';this.sinkId='';this.sinkLabel='System output';this.counter=0; }
  async context(raw=false) {
    if(this.ctx && (this.ctx.state==='closed'||(raw&&this.ctx.sampleRate<96000))){await this.ctx.close().catch(()=>{});this.ctx=null;this.node=null;}
    if(!this.ctx) {
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)throw new Error('Web Audio is unavailable in this browser. Open Hexfield in Chrome.');
      try{this.ctx=new AC(raw?{sampleRate:96000,latencyHint:'interactive'}:{latencyHint:'interactive'});}catch(e){if(raw)throw new Error('This browser cannot create the 96 kHz encoder. Use USB MIDI instead.');throw e;}
      this.master=this.ctx.createGain();this.master.gain.value=this.volume*.22;
      const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-10;compressor.ratio.value=4;
      this.master.connect(compressor);compressor.connect(this.ctx.destination);
      if(this.sinkId&&this.ctx.setSinkId)await this.ctx.setSinkId(this.sinkId);
    }
    await this.ctx.resume();
    if(this.ctx.state!=='running')throw new Error('Audio is paused. Tap Connect again to enable it.');
    return this.ctx;
  }
  async setMode(mode,options={}) {
    this.panic();
    await this.drainRaw();
    if(this.node){this.node.disconnect();this.node.port.postMessage({type:'clear'});}
    this.mode='off';this.output=null;
    if(mode==='sound')await this.context(false);
    else if(mode==='midi') {
      if(!this.midiAccess)throw new Error('Connect a MIDI device first.');
      this.output=this.midiAccess.outputs.get(options.outputId);
      if(!this.output||this.output.state==='disconnected')throw new Error('Choose a connected MIDI output.');
      await this.output.open();
    } else if(mode==='raw') {
      const ctx=await this.context(true);
      if(!ctx.audioWorklet)throw new Error('AudioWorklet is unavailable. Open the HTTPS app directly in Chrome.');
      if(!this.node){await ctx.audioWorklet.addModule('./midi-worklet.js');this.node=new AudioWorkletNode(ctx,'midi-encoder',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});}
      this.node.port.postMessage({type:'config',amplitude:options.amplitude??.35,reverse:options.reverse??false});
      this.node.connect(ctx.destination);
    }
    this.mode=mode;this.mpe=!!options.mpe;this.channel=options.channel??0;
    if((mode==='midi'||mode==='raw')&&this.mpe) {
      // Lower MPE zone: channel 1 manager, channels 2..16 members.
      this.send([0xb0,101,0,0xb0,100,6,0xb0,6,15,0xb0,101,127,0xb0,100,127]);
      for(let c=1;c<16;c++)for(const msg of bendRangeMessages(c,48))this.send(msg);
    }
    this.onStatus?.();
  }
  async requestMidi() {
    if(!navigator.requestMIDIAccess)throw new Error('Web MIDI is unavailable here. Open this page in Chrome on Android or desktop.');
    this.midiAccess=await navigator.requestMIDIAccess({sysex:false});
    this.midiAccess.onstatechange=()=>{
      if(this.output?.state==='disconnected'){this.panic();this.mode='off';this.output=null;}
      this.onStatus?.();
    };
    return Array.from(this.midiAccess.outputs.values());
  }
  async chooseAudioOutput() {
    if(!navigator.mediaDevices?.selectAudioOutput)return {system:true};
    const device=await navigator.mediaDevices.selectAudioOutput();
    if(this.ctx&&!this.ctx.setSinkId)throw new Error('This browser cannot route Web Audio. Choose the output in your phone’s sound controls.');
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC?.prototype.setSinkId)throw new Error('This browser uses the system audio output. Select your cable in the phone’s sound controls.');
    if(this.ctx)await this.ctx.setSinkId(device.deviceId);
    this.sinkId=device.deviceId;this.sinkLabel=device.label||'Selected output';
    return {label:this.sinkLabel};
  }
  send(bytes) {
    if(this.mode==='midi'&&this.output?.state!=='disconnected') {
      // Web MIDI accepts concatenated complete messages.
      try{this.output.send(bytes);}catch(e){this.onStatus?.(e.message);}
    } else if(this.mode==='raw'&&this.node)this.node.port.postMessage({type:'bytes',bytes});
  }
  noteOn(id,pitch,velocity=100) {
    if(this.mode==='off'||pitch<0||pitch>127)return false;
    if(this.voices.has(id))this.noteOff(id);
    if(this.mode==='sound') {
      if(this.ctx?.state!=='running')return false;
      const ctx=this.ctx,t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=this.wave==='bright'?'sawtooth':this.wave==='pure'?'sine':'triangle';osc.frequency.value=frequency(pitch);
      const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=this.wave==='bright'?4500:2400;
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(velocity/127,t+.009);gain.gain.exponentialRampToValueAtTime(Math.max(.001,velocity/127*.65),t+.2);
      osc.connect(filter);filter.connect(gain);gain.connect(this.master);osc.start();
      osc.onended=()=>{osc.disconnect();filter.disconnect();gain.disconnect();};
      this.voices.set(id,{osc,gain,pitch,order:this.counter++});
    } else {
      if(!this.mpe&&Math.abs(pitch-Math.round(pitch))>.001)return false;
      let channel=this.channel;
      if(this.mpe) {
        const busy=new Set([...this.voices.values()].map(v=>v.channel));
        channel=Array.from({length:15},(_,i)=>i+1).find(c=>!busy.has(c));
        if(channel===undefined){const oldest=[...this.voices.entries()].sort((a,b)=>a[1].order-b[1].order)[0];channel=oldest[1].channel;this.noteOff(oldest[0]);}
      }
      const {note,bend}=midiPitch(pitch);
      const already=[...this.voices.values()].some(v=>v.note===note&&v.channel===channel);
      if(this.mpe)this.send([0xe0|channel,bend&127,(bend>>7)&127]);
      if(!already)this.send([0x90|channel,note,velocity]);
      this.voices.set(id,{note,pitch,channel,order:this.counter++});
    }
    return true;
  }
  noteOff(id) {
    const v=this.voices.get(id);if(!v)return;
    this.voices.delete(id);
    if(v.osc){const t=this.ctx.currentTime;v.gain.gain.cancelScheduledValues(t);v.gain.gain.setTargetAtTime(0,t,.045);v.osc.stop(t+.28);}
    else if(![...this.voices.values()].some(a=>a.note===v.note&&a.channel===v.channel))this.send([0x80|v.channel,v.note,0]);
  }
  panic() {
    for(const id of [...this.voices.keys()])this.noteOff(id);
    if(this.mode==='midi'||this.mode==='raw') {
      for(let c=0;c<16;c++){this.send([0xb0|c,64,0,0xb0|c,123,0,0xb0|c,120,0]);}
    }
  }
  async drainRaw() {
    if(this.mode!=='raw'||!this.node||this.ctx?.state!=='running')return;
    const port=this.node.port,id='drain-'+(++this.counter);
    await new Promise(resolve=>{
      let timer;const finish=()=>{clearTimeout(timer);port.removeEventListener('message',listener);resolve();};
      const listener=event=>{if(event.data.type==='drained'&&event.data.id===id)finish();};
      port.addEventListener('message',listener);port.start();timer=setTimeout(finish,800);port.postMessage({type:'drain',id});
    });
    // Give the final processed block time to leave the browser's audio buffer.
    await new Promise(resolve=>setTimeout(resolve,Math.max(30,((this.ctx.baseLatency||0)+(this.ctx.outputLatency||0))*1000+10)));
  }
  async stop() {this.panic();await this.drainRaw();if(this.node){this.node.disconnect();this.node.port.postMessage({type:'clear'});}this.mode='off';this.onStatus?.();}
  setVolume(v) {this.volume=v;if(this.master&&this.ctx)this.master.gain.setTargetAtTime(v*.22,this.ctx.currentTime,.02);}
}
