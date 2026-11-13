export const mod = (n, d) => ((n % d) + d) % d;
export const NOTE_NAMES = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
export const LAYOUTS = {
  wicki: {name:'Wicki–Hayden', a:2, b:7, description:'Whole tones across. Fourths and fifths on the diagonals.'},
  sonome: {name:'Sonome', a:4, b:7, description:'The harmonic table. Thirds and fifths form triangular chords.'},
  chromatic: {name:'Chromatic', a:1, b:5, description:'Semitones across, fourths along the rising diagonal.'},
  custom: {name:'Custom', a:2, b:7, description:'Set the interval of each grid axis in tuning steps.'}
};
export function intervals(s) {
  if(s.layout === 'custom') return [s.axisA, s.axisB];
  const l = LAYOUTS[s.layout] || LAYOUTS.wicki;
  return [Math.round(l.a*s.edo/12), Math.round(l.b*s.edo/12)];
}
export function stepAt(q,r,s) { const [a,b]=intervals(s); return a*q + b*r + s.octave*s.edo; }
export function pitchForStep(step,s) { return 60 + s.root + step*12/s.edo; }
export function frequency(pitch) { return 440 * 2**((pitch-69)/12); }
export function noteName(pitch) { const n=Math.round(pitch); return NOTE_NAMES[mod(n,12)]+(Math.floor(n/12)-1); }
export function labelForStep(step,s) {
  if(s.labels==='degrees') return String(mod(step,s.edo)+1);
  if(s.edo!==12) return String(mod(step,s.edo)) + (mod(step,s.edo)===0?' · '+NOTE_NAMES[s.root]:'');
  return NOTE_NAMES[mod(Math.round(pitchForStep(step,s)),12)];
}
export function inScale(step,s) {
  if(s.scale==='all') return true;
  const base=s.scale==='minor'?[0,2,3,5,7,8,10]:s.scale==='pentatonic'?[0,2,4,7,9]:[0,2,4,5,7,9,11];
  return base.map(n=>Math.round(n*s.edo/12)).includes(mod(step,s.edo));
}
export function midiPitch(pitch,range=48) {
  const note=Math.max(0,Math.min(127,Math.round(pitch)));
  const bend=Math.max(0,Math.min(16383,Math.round(8192+(pitch-note)/range*8192)));
  return {note,bend};
}
export function bendRangeMessages(channel, range) {
  const c=0xb0|channel;
  return [[c,101,0],[c,100,0],[c,6,range],[c,38,0],[c,101,127],[c,100,127]];
}
export function toHexPoint(q,r,radius,cx,cy) { return {x:cx+Math.sqrt(3)*radius*(q+r/2),y:cy-1.5*radius*r}; }
export function fromHexPoint(x,y,radius,cx,cy) {
  const r=-(y-cy)/(1.5*radius),q=(x-cx)/(Math.sqrt(3)*radius)-r/2;
  let xx=q,zz=r,yy=-q-r,rx=Math.round(xx),ry=Math.round(yy),rz=Math.round(zz);
  const dx=Math.abs(rx-xx),dy=Math.abs(ry-yy),dz=Math.abs(rz-zz);
  if(dx>dy&&dx>dz)rx=-ry-rz;else if(dy>dz)ry=-rx-rz;else rz=-rx-ry;
  return {q:rx||0,r:rz||0};
}
