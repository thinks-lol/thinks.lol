import {MidiSerial} from './serial.js';
class MidiEncoderProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.encoder=new MidiSerial(sampleRate);this.amplitude=.35;this.reverse=false;
    this.port.onmessage=({data})=>{
      if(data.type==='bytes')this.encoder.enqueue(data.bytes);
      if(data.type==='clear')this.encoder.clear();
      if(data.type==='drain')this.drainId=data.id;
      if(data.type==='config'){this.amplitude=data.amplitude;this.reverse=data.reverse;}
    };
  }
  process(_inputs,outputs) {const out=outputs[0];if(out.length>=2)this.encoder.fill(out[0],out[1],this.amplitude,this.reverse);if(this.drainId&&this.encoder.bitsLeft===0&&this.encoder.read>=this.encoder.queue.length&&this.encoder.remaining<=0){this.port.postMessage({type:'drained',id:this.drainId});this.drainId=null;}return true;}
}
registerProcessor('midi-encoder',MidiEncoderProcessor);
