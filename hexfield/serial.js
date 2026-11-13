// UART waveform encoder. This produces samples, NOT MIDI-compliant electrical levels.
// 31,250 baud, 8 data bits, no parity, one stop bit; data sent LSB first.
export class MidiSerial {
  constructor(rate=96000) { this.rate=rate; this.queue=[]; this.read=0; this.bitsLeft=0; this.word=0; this.remaining=0; this.level=1; }
  enqueue(bytes) { for(const b of bytes) { if(!Number.isInteger(b)||b<0||b>255)throw new Error('Invalid MIDI byte'); this.queue.push(b); } }
  clear() { this.queue=[];this.read=0;this.bitsLeft=0;this.remaining=0;this.level=1; }
  nextLevel() {
    if(this.remaining<=0) {
      if(this.bitsLeft===0) {
        if(this.read>=this.queue.length) { this.queue=[];this.read=0;this.remaining=0;return 1; }
        this.word=(this.queue[this.read++]<<1)|512; // bit 0=start, bits 1..8=data, bit 9=stop
        this.bitsLeft=10;
      }
      this.level=this.word&1; this.word>>=1; this.bitsLeft--;
      this.remaining+=this.rate/31250;
    }
    this.remaining-=1;
    return this.level;
  }
  fill(left,right,amplitude=.35,reverse=false) {
    for(let i=0;i<left.length;i++) {
      const asserted=1-this.nextLevel();
      const v=asserted*amplitude;
      // Type A nominal polarity: ring positive relative to tip for current-on bits.
      left[i]=v===0?0:(reverse?v:-v);
      right[i]=v===0?0:(reverse?-v:v);
    }
  }
}
