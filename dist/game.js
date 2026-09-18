import {createGame,stepGame,MODES,DIFFICULTIES,DURATION,clamp} from './engine.js';
import {createAudio} from './audio.js';
import {resolveLocale,translate,applyLocale} from './i18n.js';
const $=id=>document.getElementById(id),canvas=$('world'),audio=createAudio();
let mode='foot',difficulty='normal',game=createGame(),view,previous=performance.now(),uiTime=0,frameId,soundEnabled=true,dragPointer=null,dragX=0,dragY=0,hadLock=false;
let savedLocale;try{savedLocale=localStorage.getItem('dead-air.locale')}catch{}
let locale=resolveLocale(savedLocale,navigator.languages??[navigator.language]),audioUnavailable=false;
const t=(key,values)=>translate(locale,key,values);
applyLocale(document,locale);$('language-select').value=locale;
let reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const coarse=matchMedia('(pointer:coarse)').matches,keys=new Set(),touch={forward:0,right:0,boost:false,jump:false};let stickPointer=null;
$('motion-toggle').checked=reduced;
function clearInput(){keys.clear();touch.forward=0;touch.right=0;touch.boost=false;touch.jump=false;dragPointer=null;stickPointer=null;$('joystick-knob').style.transform='translate(0,0)'}
function inputDescription(){return t(coarse?'controls.touch':mode==='foot'?'controls.foot':'controls.vehicle')}
function syncAudio(){
  $('audio-button').textContent=t(audioUnavailable?'audio.unavailable':soundEnabled?'audio.on':'audio.off');
  $('audio-button').setAttribute('aria-pressed',String(soundEnabled));
  $('audio-button').setAttribute('aria-label',t(soundEnabled?'audio.mute':'audio.unmute'));
}
function sync(){
  $('menu').hidden=game.status!=='ready';$('hud').hidden=game.status!=='playing';$('pause-screen').hidden=game.status!=='paused';$('result-screen').hidden=!['lost','won'].includes(game.status);$('pause-button').hidden=game.status!=='playing';
  $('mode-label').textContent=t(`mode.${mode}`);$('energy-label').textContent=t(mode==='foot'?'hud.stamina':'hud.boostEnergy');
  $('control-hint').textContent=t(mode==='foot'?'controls.foot.short':'controls.vehicle.short');$('entry-note').textContent=inputDescription();$('jump-button').hidden=mode!=='foot';
  $('flight-spec').textContent=t('spec.summary',{speed:Math.round(DIFFICULTIES[difficulty].speed*3.6),source:DIFFICULTIES[difficulty].source});
  syncAudio();
}
function changeLanguage(value){
  locale=resolveLocale(value);try{localStorage.setItem('dead-air.locale',locale)}catch{}
  clearInput();applyLocale(document,locale);$('language-select').value=locale;sync();telemetry();
  if(['lost','won'].includes(game.status))renderResult();
}

function selectMode(value){
  if(game.status!=='ready'||!MODES[value])return false;mode=value;game=createGame(mode,difficulty);document.querySelectorAll('[data-mode]').forEach(b=>{const selected=b.dataset.mode===mode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.querySelector('.check').textContent=selected?'✓':''});sync();return true;
}
function selectDifficulty(value){if(game.status!=='ready'||!DIFFICULTIES[value])return false;difficulty=value;game=createGame(mode,difficulty);document.querySelectorAll('[data-difficulty]').forEach(b=>{const selected=b.dataset.difficulty===difficulty;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});sync();return true}
function releaseMouse(){if(document.pointerLockElement===canvas)document.exitPointerLock()}
function lockMouse(){
  if(coarse)return;
  if(!canvas.requestPointerLock){$('look-hint').hidden=false;return}
  try{const result=canvas.requestPointerLock();if(result?.catch)result.catch(()=>{hadLock=false;$('look-hint').hidden=false})}catch{$('look-hint').hidden=false}
}
async function enableAudio(){if(soundEnabled){const ok=await audio.unlock();audioUnavailable=!ok;if(!ok){soundEnabled=false;audio.setEnabled(false)}syncAudio()}}
function start(lock=true){
  if(!view)return;clearInput();game=createGame(mode,difficulty);game.status='playing';previous=performance.now();$('damage-flash').style.opacity='0';sync();telemetry();canvas.focus({preventScroll:true});enableAudio();if(lock)lockMouse();
}
function pause(focusResume=true){if(game.status!=='playing')return;game.status='paused';clearInput();audio.suspend();releaseMouse();sync();if(focusResume)$('resume-button').focus({preventScroll:true})}
function resume(){if(game.status!=='paused')return;clearInput();game.status='playing';previous=performance.now();sync();canvas.focus({preventScroll:true});enableAudio();lockMouse()}
function setup(){clearInput();releaseMouse();audio.suspend();game=createGame(mode,difficulty);$('damage-flash').style.opacity='0';sync();$('start-button').focus({preventScroll:true})}
function renderResult(){
  const won=game.status==='won',values={mode:t(`mode.${mode}`),difficulty:t(`difficulty.${difficulty}`),time:game.elapsed.toFixed(1)};
  $('result-kicker').textContent=t(won?'result.wonKicker':'result.lostKicker',values);
  $('result-title').textContent=t(won?'result.wonTitle':'result.lostTitle');
  $('result-description').textContent=t(won?'result.wonDescription':'result.lostDescription',values);
  $('result-time').innerHTML=`${game.elapsed.toFixed(1)}<small>s</small>`;$('result-dodges').textContent=game.dodges;$('result-distance').innerHTML=`${Math.round(game.distance)}<small>m</small>`;
}
function finish(){
  clearInput();releaseMouse();audio.suspend();sync();renderResult();$('retry-button').focus({preventScroll:true});
}
function telemetry(){
  const p=game.player,remaining=Math.max(0,DURATION-game.elapsed).toFixed(1).split('.');$('timer').innerHTML=`${remaining[0]}<small>.${remaining[1]}</small>`;$('speed').textContent=Math.round(Math.abs(p.speed)*3.6);$('energy').textContent=`${Math.round(p.energy)}%`;$('energy-fill').style.width=`${p.energy}%`;$('energy-fill').style.background=p.energy<20?'#f18a58':'#dfd7af';$('integrity').textContent=mode==='armor'?t('hud.armor',{health:p.health})+(p.invulnerable>0?t('hud.hit'):''):mode==='foot'?t(p.altitude>.05?'hud.airborne':p.jumpCooldown>0?'hud.jumpCooldown':'hud.jumpReady'):t('hud.oneHit');
  const directions=['N','NW','W','SW','S','SE','E','NE'],index=((Math.round(p.yaw/(Math.PI/4))%8)+8)%8;$('compass').textContent=directions[index];$('compass-left').textContent=directions[(index+1)%8];$('compass-right').textContent=directions[(index+7)%8];
  $('warning').style.opacity=game.threat>.3||game.boundary?'1':'0';
  $('warning-label').textContent=t(game.boundary?'warning.boundary':game.threat>.95?'warning.imminent':'warning.approaching');
  $('warning-sub').textContent=t(game.boundary?'warning.boundaryDetail':game.threat>.7?'warning.noBraking':'warning.direction');
  const closest=[...game.drones].sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];$('drone-speed').textContent=closest?`${Math.round(Math.hypot(closest.vx,closest.vy,closest.vz)*3.6)} km/h`:t('hud.waiting');$('pass-flash').style.opacity=!reduced&&game.lastPass?String(Math.max(0,1-(game.elapsed-game.lastPass.time)*3)*.42):'0';
  $('intro-toast').style.opacity=game.elapsed<5?'1':'0';$('damage-flash').style.opacity=p.invulnerable>0?String(Math.min(.9,p.invulnerable*.4)):'0';
}
function look(dx,dy){game.player.yaw-=dx*.0025;game.player.pitch=clamp(game.player.pitch-dy*.0022,-1.18,1.3)}
function loop(time){
  const dt=Math.min(.25,(time-previous)/1000);previous=time;
  if(game.status==='playing'){
    if(keys.has('ArrowLeft'))game.player.yaw+=dt*1.8;if(keys.has('ArrowRight'))game.player.yaw-=dt*1.8;if(keys.has('ArrowUp'))game.player.pitch=clamp(game.player.pitch+dt*1.3,-1.18,1.3);if(keys.has('ArrowDown'))game.player.pitch=clamp(game.player.pitch-dt*1.3,-1.18,1.3);
    const before=game.damageCount,explosions=game.explosions.length,passes=game.passCount;
    stepGame(game,{forward:(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)+touch.forward,right:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touch.right,boost:keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.boost,jump:keys.has('Space')||touch.jump},dt);
    if(game.damageCount!==before||game.explosions.length>explosions)audio.impact();if(game.passCount!==passes)audio.passBy(game.lastPass.side);
    if(game.status==='won'||game.status==='lost')finish();
  }
  if(time-uiTime>60){telemetry();audio.update(game,time/1000);uiTime=time}
  view.render(game,time/1000,dt,reduced);frameId=requestAnimationFrame(loop);
}

$('start-button').addEventListener('click',()=>start());$('retry-button').addEventListener('click',()=>start());$('setup-button').addEventListener('click',setup);$('quit-button').addEventListener('click',setup);$('pause-button').addEventListener('click',pause);$('resume-button').addEventListener('click',resume);$('reload-button').addEventListener('click',()=>location.reload());
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>selectMode(b.dataset.mode));for(const b of document.querySelectorAll('[data-difficulty]'))b.addEventListener('click',()=>selectDifficulty(b.dataset.difficulty));
$('audio-button').addEventListener('click',async()=>{soundEnabled=!soundEnabled;audioUnavailable=false;if(soundEnabled)await enableAudio();audio.setEnabled(soundEnabled);syncAudio()});
$('language-select').addEventListener('focus',()=>pause(false));
$('language-select').addEventListener('change',event=>changeLanguage(event.target.value));
function openHelp(){pause();$('help-dialog').showModal()}$('help-button').addEventListener('click',openHelp);$('specs-button').addEventListener('click',openHelp);['close-help','understood-button'].forEach(id=>$(id).addEventListener('click',()=>$('help-dialog').close()));$('motion-toggle').addEventListener('change',()=>reduced=$('motion-toggle').checked);
window.addEventListener('keydown',event=>{if($('help-dialog').open||event.target=== $('language-select'))return;if(event.code==='Escape'){if(game.status==='playing')pause();return}if(game.status==='playing'&&['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)){event.preventDefault();keys.add(event.code)}});
window.addEventListener('keyup',event=>keys.delete(event.code));window.addEventListener('blur',()=>{clearInput();pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
window.addEventListener('mousemove',event=>{if(game.status==='playing'&&document.pointerLockElement===canvas)look(event.movementX,event.movementY)});
canvas.addEventListener('pointerdown',event=>{if(game.status!=='playing'||document.pointerLockElement===canvas)return;dragPointer=event.pointerId;dragX=event.clientX;dragY=event.clientY;canvas.setPointerCapture(event.pointerId)});
canvas.addEventListener('pointermove',event=>{if(event.pointerId!==dragPointer||game.status!=='playing')return;look(event.clientX-dragX,event.clientY-dragY);dragX=event.clientX;dragY=event.clientY});['pointerup','pointercancel','lostpointercapture'].forEach(name=>canvas.addEventListener(name,()=>dragPointer=null));
canvas.addEventListener('click',()=>{if(game.status==='playing'&&!coarse&&!document.pointerLockElement)lockMouse()});
document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;$('look-hint').hidden=locked||coarse;if(locked)hadLock=true;else if(hadLock){hadLock=false;pause()}});
document.addEventListener('pointerlockerror',()=>{$('look-hint').hidden=false});
const stick=$('joystick');function moveStick(event){if(event.pointerId!==stickPointer)return;const r=stick.getBoundingClientRect(),dx=event.clientX-r.left-r.width/2,dy=event.clientY-r.top-r.height/2,limit=r.width*.32,len=Math.max(limit,Math.hypot(dx,dy));touch.right=dx/len;touch.forward=-dy/len;$('joystick-knob').style.transform=`translate(${dx/len*limit}px,${dy/len*limit}px)`}
stick.addEventListener('pointerdown',event=>{if(game.status!=='playing'||stickPointer!==null)return;event.preventDefault();stickPointer=event.pointerId;stick.setPointerCapture(event.pointerId);moveStick(event)});stick.addEventListener('pointermove',moveStick);['pointerup','pointercancel','lostpointercapture'].forEach(name=>stick.addEventListener(name,event=>{if(stickPointer!==event.pointerId)return;touch.forward=touch.right=0;stickPointer=null;$('joystick-knob').style.transform='translate(0,0)'}));
$('boost-button').addEventListener('pointerdown',event=>{event.preventDefault();touch.boost=true;$('boost-button').setPointerCapture(event.pointerId)});['pointerup','pointercancel','lostpointercapture'].forEach(name=>$('boost-button').addEventListener(name,()=>touch.boost=false));
$('jump-button').addEventListener('pointerdown',event=>{if(game.status!=='playing'||mode!=='foot')return;event.preventDefault();touch.jump=true;$('jump-button').setPointerCapture(event.pointerId)});['pointerup','pointercancel','lostpointercapture'].forEach(name=>$('jump-button').addEventListener(name,()=>touch.jump=false));
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();pause();$('error-screen').hidden=false;$('error-message').dataset.i18n='error.context';$('error-message').textContent=t('error.context')});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);audio.destroy();view?.destroy()},{once:true});window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});

// Optional browser-native agent interface uses exactly the same UI state/actions.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  const tools=[{name:'read_simulation_status',description:'Read current first-person drone simulation state without changing it.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({status:game.status,mode,difficulty,locale,elapsed:+game.elapsed.toFixed(1),health:game.player.health,dodges:game.dodges,altitude:+game.player.altitude.toFixed(2),nearMisses:game.nearMisses,referenceMaxKmh:+(DIFFICULTIES[difficulty].speed*3.6).toFixed(1)})},{name:'configure_simulation',description:'Select transport and difficulty on the start screen. Does not start the simulation.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['foot','bike','armor']},difficulty:{type:'string',enum:['easy','normal','hard']}},required:['mode','difficulty'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(game.status!=='ready')throw new Error('Return to the selection screen first');if(!input||!MODES[input.mode]||!DIFFICULTIES[input.difficulty])throw new Error('Invalid transport or difficulty');selectMode(input.mode);selectDifficulty(input.difficulty);return {status:'ready',mode,difficulty}}}];
  for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}}
  addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
try{const {createRenderer}=await import('./render.js');view=createRenderer(canvas);sync();view.render(game,0);$('loading').hidden=true;frameId=requestAnimationFrame(loop)}catch(error){console.error(error);$('loading').hidden=true;$('error-screen').hidden=false;$('start-button').disabled=true}
