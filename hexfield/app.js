import {NOTE_NAMES,LAYOUTS,mod,intervals,stepAt,pitchForStep,frequency,noteName,labelForStep,inScale,toHexPoint,fromHexPoint} from './music.js';
import {Engine} from './engine.js';
const $=id=>document.getElementById(id);
const defaults={layout:'wicki',edo:12,root:0,scale:'major',octave:0,size:38,labels:'notes',axisA:2,axisB:7,velocity:100,haptic:false,wave:'soft',volume:45};
let state={...defaults};
try{const saved=JSON.parse(localStorage.getItem('hexfield-v1')||'{}');for(const k of Object.keys(defaults))if(k in saved&&typeof saved[k]===typeof defaults[k])state[k]=saved[k];}catch{}
if(!LAYOUTS[state.layout])state.layout='wicki';if(![12,19,22,24,31,53].includes(state.edo))state.edo=12;
state.root=mod(state.root,12);state.octave=Math.max(-3,Math.min(3,state.octave));state.size=Math.max(24,Math.min(62,state.size));
const save=()=>{try{localStorage.setItem('hexfield-v1',JSON.stringify(state));}catch{}};
const engine=new Engine(message=>{if(message)toast(message);syncOutput();refreshMidiList();});
const canvas=$('board'),ctx=canvas.getContext('2d');
let geometry={radius:38,cx:0,cy:0,w:0,h:0};
let grid=[],cells=new Map(),pointers=new Map(),downPointers=new Set(),latched=new Set(),held=false,frame=0,route='sound',busy=false,lastToast='',toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4400);}
function showError(message){$('route-error').textContent=message;$('route-error').hidden=false;}
function clearError(){$('route-error').hidden=true;}
function populate(){
 $('root').innerHTML=NOTE_NAMES.map((n,i)=>'<option value="'+i+'">'+n+'</option>').join('');
 $('channel').innerHTML=Array.from({length:16},(_,i)=>'<option value="'+i+'">'+(i+1)+'</option>').join('');
 const map={layout:'layout',tuning:'edo',root:'root',scale:'scale','settings-scale':'scale','key-size':'size',labels:'labels','axis-a':'axisA','axis-b':'axisB',velocity:'velocity',voice:'wave',volume:'volume'};
 for(const [id,k]of Object.entries(map))$(id).value=state[k];$('haptic').checked=state.haptic;
 engine.wave=state.wave;engine.setVolume(state.volume/100);
}
function syncLabels(){
 const [a,b]=intervals(state);const signed=n=>(n>=0?'+':'')+n;
 $('axis-label').textContent=signed(a)+' →     '+signed(b)+' ↗     '+signed(b-a)+' ↖';
 $('tuning-caption').textContent=state.edo===12?'Same shape. Every key.':state.edo+' equal steps to the octave.';
 $('octave-label').textContent=(state.octave>0?'+':'')+state.octave;
 $('octave-down').disabled=state.octave<=-3;$('octave-up').disabled=state.octave>=3;
}
function resize(){
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 const nominal=state.size*(rect.width>1000?1.28:1);
 const r=Math.min(nominal,Math.max(21,(rect.height-52)/5.5));
 geometry={w:rect.width,h:rect.height,radius:r,cx:rect.width/2,cy:rect.height/2+9};
 grid=[];cells=new Map();
 const rows=Math.ceil(rect.height/(r*1.5))+2,cols=Math.ceil(rect.width/(r*Math.sqrt(3)))+rows;
 for(let rr=-rows;rr<=rows;rr++)for(let q=-cols;q<=cols;q++){
  const p=toHexPoint(q,rr,r,geometry.cx,geometry.cy);
  if(p.x<r*.6||p.x>rect.width-r*.6||p.y<r*.7+27||p.y>rect.height-r*.7-25)continue;
  const step=stepAt(q,rr,state),pitch=pitchForStep(step,state);if(pitch<0||pitch>127)continue;
  const cell={...p,q,r:rr,step,pitch,key:q+','+rr};grid.push(cell);cells.set(cell.key,cell);
 }
 syncLabels();redraw();
}
function hexPath(x,y,r){
 const vertices=Array.from({length:6},(_,i)=>({x:x+Math.cos(i*Math.PI/3-Math.PI/2)*r,y:y+Math.sin(i*Math.PI/3-Math.PI/2)*r}));
 const rounding=.11;ctx.beginPath();
 vertices.forEach((v,i)=>{const prev=vertices[(i+5)%6],next=vertices[(i+1)%6];const start={x:v.x+(prev.x-v.x)*rounding,y:v.y+(prev.y-v.y)*rounding};const end={x:v.x+(next.x-v.x)*rounding,y:v.y+(next.y-v.y)*rounding};if(i===0)ctx.moveTo(start.x,start.y);else ctx.lineTo(start.x,start.y);ctx.quadraticCurveTo(v.x,v.y,end.x,end.y);});ctx.closePath();
}
function redraw(){if(frame)return;frame=requestAnimationFrame(draw);}
function draw(){
 frame=0;ctx.clearRect(0,0,geometry.w,geometry.h);
 const active=new Set([...pointers.values()].map(p=>p.key));for(const key of latched)active.add(key);
 const r=geometry.radius-3;
 for(const cell of grid){
  const root=mod(cell.step,state.edo)===0,scale=inScale(cell.step,state),on=active.has(cell.key);
  hexPath(cell.x,cell.y,r);
  ctx.shadowBlur=on?20:0;ctx.shadowColor='#b8e5c84a';
  ctx.fillStyle=on?'#c5f0d5':root?'#2a453a':scale?'#253437':'#1b2428';ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle=on?'#e2ffed':root?'#668c75':scale?'#3c5154':'#2c3a40';ctx.lineWidth=on?1.8:1;ctx.stroke();
  ctx.fillStyle=on?'#19362a':root?'#c7ead4':scale?'#d3dfdd':'#85979f';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=(root?'500 ':'400 ')+Math.round(r*.36)+'px Inter, system-ui, sans-serif';
  ctx.fillText(labelForStep(cell.step,state),cell.x,cell.y-(root?3:0));
  if(root){ctx.fillStyle=on?'#507462':'#7caa90';ctx.font=Math.max(8,Math.round(r*.18))+'px ui-monospace,monospace';ctx.fillText(''+(Math.floor(cell.pitch/12)-1),cell.x,cell.y+r*.35);}
 }
}
function syncReadout(){
 const voices=[...engine.voices.values()];$('meter').classList.toggle('playing',voices.length>0);
 if(!voices.length){$('note-readout').textContent=engine.mode==='off'?'Ready when you are':engine.mode==='raw'?'Encoder armed':'Make a little music';$('detail-readout').textContent=engine.mode==='raw'?'Experimental · hardware unverified':LAYOUTS[state.layout].description;return;}
 const pitches=[...new Set(voices.map(v=>v.pitch))].sort((a,b)=>a-b);
 $('note-readout').textContent=pitches.length===1?noteName(pitches[0]):pitches.slice(0,5).map(p=>NOTE_NAMES[mod(Math.round(p),12)]).join(' · ')+(pitches.length>5?' …':'');
 $('detail-readout').textContent=pitches.length===1?frequency(pitches[0]).toFixed(1)+' Hz'+(state.edo!==12?' · '+state.edo+' EDO':''):voices.length+' voices';
}
function syncOutput(){
 const names={off:'Connect',sound:'Sound on',midi:'MIDI on',raw:'Audio MIDI'};
 $('output-label').textContent=names[engine.mode];$('output').classList.toggle('off',engine.mode==='off');$('output').classList.toggle('lab',engine.mode==='raw');
 $('empty-hint').hidden=engine.mode!=='off';$('disconnect').hidden=engine.mode==='off';
 const sr=engine.ctx?Math.round(engine.ctx.sampleRate/1000)+' kHz context':'';
 $('connection-status').textContent=engine.mode==='sound'?engine.sinkLabel+' · '+sr:engine.mode==='raw'?sr+' · 31,250 baud · output not hardware-verified':engine.mode==='midi'?(engine.output?.name||'MIDI device')+(engine.mpe?' · MPE':' · channel '+(engine.channel+1)):'';
 syncReadout();redraw();
}
function changeKeyboard(){releaseAll();save();resize();}
function releaseAll(){downPointers.clear();pointers.clear();latched.clear();held=false;$('sustain').setAttribute('aria-pressed','false');engine.panic();syncReadout();redraw();}
function playable(cell){
 if(engine.mode==='off'){openOutput();return false;}
 if(engine.mode!=='sound'&&!engine.mpe&&state.edo!==12){toast('This tuning needs MPE. Enable per-note tuning in output settings.');return false;}
 if(engine.mode==='sound'&&engine.ctx?.state!=='running'){toast('Audio paused. Tap Connect to resume.');return false;}
 return !!cell;
}
function press(id,cell){
 if(!cell||!playable(cell))return;
 // Retrigger a latched cell instead of accumulating duplicate notes.
 if(latched.has(cell.key)){engine.noteOff('held:'+cell.key);latched.delete(cell.key);}
 if(engine.noteOn(id,cell.pitch,state.velocity)){
  pointers.set(id,{key:cell.key,pitch:cell.pitch});if(state.haptic&&navigator.vibrate)navigator.vibrate(6);syncReadout();redraw();
 }
}
function release(id,allowHold=true){
 const p=pointers.get(id);if(!p)return;
 if(held&&allowHold){const v=engine.voices.get(id);if(v){if(engine.voices.has('held:'+p.key))engine.noteOff(id);else{engine.voices.delete(id);engine.voices.set('held:'+p.key,v);}latched.add(p.key);}}
 else engine.noteOff(id);
 pointers.delete(id);syncReadout();redraw();
}
function hit(event){const rect=canvas.getBoundingClientRect();const p=fromHexPoint(event.clientX-rect.left,event.clientY-rect.top,geometry.radius,geometry.cx,geometry.cy);return cells.get(p.q+','+p.r);}
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();const cell=hit(e);if(!cell)return;
 if(engine.mode==='off'){openOutput();return;}
 canvas.setPointerCapture(e.pointerId);downPointers.add('p:'+e.pointerId);press('p:'+e.pointerId,cell);
});
canvas.addEventListener('pointermove',e=>{
 const id='p:'+e.pointerId;if(!downPointers.has(id))return;const cell=hit(e);const p=pointers.get(id);
 if(cell?.key===p?.key)return;release(id,false);if(cell)press(id,cell);
});
canvas.addEventListener('pointerup',e=>{downPointers.delete('p:'+e.pointerId);release('p:'+e.pointerId);});
canvas.addEventListener('pointercancel',e=>{downPointers.delete('p:'+e.pointerId);release('p:'+e.pointerId,false);});
canvas.addEventListener('lostpointercapture',e=>{downPointers.delete('p:'+e.pointerId);release('p:'+e.pointerId,false);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function toggleHold(){held=!held;$('sustain').setAttribute('aria-pressed',String(held));if(!held){for(const key of latched)engine.noteOff('held:'+key);latched.clear();}syncReadout();redraw();}
$('sustain').onclick=toggleHold;$('panic').onclick=()=>{releaseAll();if(engine.mode==='raw'){engine.stop();toast('Encoder stopped. Reconnect to arm it again.');}else toast('All notes released.');};
const changeOctave=delta=>{state.octave=Math.max(-3,Math.min(3,state.octave+delta));changeKeyboard();};
$('octave-down').onclick=()=>changeOctave(-1);$('octave-up').onclick=()=>changeOctave(1);
for(const [id,k]of Object.entries({layout:'layout',tuning:'edo',root:'root',scale:'scale','settings-scale':'scale','key-size':'size',labels:'labels','axis-a':'axisA','axis-b':'axisB',velocity:'velocity'})){
 $(id).addEventListener('change',()=>{
  let value=typeof defaults[k]==='number'?Number($(id).value):$(id).value;
  if(typeof value==='number'&&!Number.isFinite(value))value=defaults[k];
  if(k==='axisA'||k==='axisB'){value=Math.max(-53,Math.min(53,value));$(id).value=value;}
  state[k]=value;if(k==='scale'){$('scale').value=value;$('settings-scale').value=value;}changeKeyboard();
  if(k==='edo'&&state.edo!==12&&engine.mode!=='sound'&&engine.mode!=='off'&&!engine.mpe)toast('Alternate tuning selected. Enable MPE in output settings to send these pitches.');
 });
}
$('haptic').onchange=()=>{state.haptic=$('haptic').checked;save();};
$('voice').onchange=()=>{state.wave=$('voice').value;engine.wave=state.wave;save();};
$('volume').oninput=()=>{state.volume=Number($('volume').value);engine.setVolume(state.volume/100);save();};
$('amplitude').oninput=()=>{$('amplitude-value').textContent=$('amplitude').value+'%';};
$('reset').onclick=()=>{releaseAll();state={...defaults};save();populate();resize();toast('Keyboard preferences reset.');};
function showDialog(id){releaseAll();$(id).showModal();}
function selectRoute(mode){
 route=mode;clearError();
 for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-selected',String(b.dataset.mode===mode));
 for(const m of ['sound','midi','raw'])$('route-'+m).hidden=m!==mode;
 $('audio-device-row').hidden=mode==='midi';$('midi-options').hidden=mode==='sound';
 $('connect').innerHTML=(mode==='sound'?'Play with sound':mode==='midi'?'Connect MIDI':'Arm audio encoder')+' <span>↗</span>';
 $('connect').classList.toggle('lab',mode==='raw');
 if(state.edo!==12&&mode!=='sound')$('mpe').checked=true;
 $('channel-row').hidden=$('mpe').checked;
}
function openOutput(){selectRoute(engine.mode==='off'?'sound':engine.mode);showDialog('output-dialog');syncOutput();}
$('output').onclick=openOutput;$('start').onclick=openOutput;$('settings').onclick=()=>showDialog('settings-dialog');
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>selectRoute(b.dataset.mode);
for(const dialog of document.querySelectorAll('dialog')){
 dialog.querySelector('.close').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('cancel',()=>releaseAll());
}
$('mpe').onchange=()=>{$('channel-row').hidden=$('mpe').checked;};
function refreshMidiList(){
 if(!engine.midiAccess)return;const current=$('midi-device').value,outputs=[...engine.midiAccess.outputs.values()].filter(o=>o.state!=='disconnected');
 $('midi-device').replaceChildren();
 if(!outputs.length){$('midi-device').add(new Option('No MIDI output found',''));$('midi-help').textContent='No MIDI outputs found. Connect a class-compliant USB MIDI instrument or interface, then try again.';}
 else{for(const out of outputs)$('midi-device').add(new Option(out.name||out.id,out.id));if(outputs.some(o=>o.id===current))$('midi-device').value=current;$('midi-help').textContent=outputs.length+' output'+(outputs.length===1?'':'s')+' available.';}
}
$('find-midi').onclick=async()=>{
 clearError();$('find-midi').disabled=true;$('find-midi').textContent='Looking for devices…';
 try{await engine.requestMidi();refreshMidiList();}catch(e){showError(e.name==='NotAllowedError'?'MIDI permission was declined. Allow MIDI access in the browser site settings and try again.':e.message);}
 finally{$('find-midi').disabled=false;$('find-midi').textContent='Find MIDI devices';}
};
$('choose-audio').onclick=async()=>{
 clearError();try{const result=await engine.chooseAudioOutput();$('audio-device-help').textContent=result.system?'This browser uses the phone’s system output. Connect your cable and select it in Android’s sound controls. No microphone permission is needed.':'Selected: '+result.label;syncOutput();}catch(e){showError(e.name==='NotAllowedError'?'Output selection was cancelled or blocked. You can use the system output.':e.message);}
};
$('connect').onclick=async()=>{
 if(busy)return;busy=true;clearError();$('connect').disabled=true;
 try{
  releaseAll();
  if(route!=='sound'&&state.edo!==12&&!$('mpe').checked)throw new Error('Enable per-note tuning (MPE) for '+state.edo+' EDO, or choose 12 EDO.');
  await engine.setMode(route,{outputId:$('midi-device').value,mpe:$('mpe').checked,channel:Number($('channel').value),amplitude:Number($('amplitude').value)/100,reverse:$('polarity').value==='b'});
  $('output-dialog').close();syncOutput();canvas.focus({preventScroll:true});
  if(route==='raw')toast('Audio encoder armed. Physical MIDI compatibility is unverified.');
 }catch(e){showError(e.message||'Could not connect this output.');syncOutput();}
 finally{busy=false;$('connect').disabled=false;}
};
$('disconnect').onclick=async()=>{releaseAll();await engine.stop();syncOutput();toast('Output disconnected.');};
$('fullscreen').onclick=async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Use your browser’s Add to Home screen for a full-screen instrument.');}catch{toast('Fullscreen is unavailable here. Try opening Hexfield directly in Chrome.');}
};
const keyboardRows=['asdfghjk','qwertyui'];
document.addEventListener('keydown',e=>{
 if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.key==='Escape'){releaseAll();if(engine.mode==='raw')engine.stop();return;}
 if(document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName))return;
 const key=e.key.toLowerCase();
 if(key===' '){e.preventDefault();toggleHold();return;}
 if(key==='z'||key==='x'){e.preventDefault();changeOctave(key==='z'?-1:1);return;}
 for(let r=0;r<keyboardRows.length;r++){const index=keyboardRows[r].indexOf(key);if(index>=0){e.preventDefault();const q=index-3,step=stepAt(q,r,state);press('k:'+key,{q,r,step,key:q+','+r,pitch:pitchForStep(step,state)});return;}}
});
document.addEventListener('keyup',e=>release('k:'+e.key.toLowerCase()));
window.addEventListener('blur',()=>releaseAll());
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseAll();if(engine.mode==='raw')engine.stop();}});
window.addEventListener('pagehide',()=>{releaseAll();engine.stop();});
window.addEventListener('resize',()=>{releaseAll();resize();});
new ResizeObserver(resize).observe($('board-wrap'));
populate();resize();syncOutput();
// A deliberate first tap chooses the destination and unlocks browser audio.
selectRoute('sound');$('output-dialog').showModal();
