export function createAudio(){
  let context,master,voices=[],engineGain,engineOsc,windGain,breathGain,enabled=true,lastStep=0,lastBeat=0;
  async function unlock(){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
    if(!context){
      context=new Audio();master=context.createGain();master.gain.value=.55;master.connect(context.destination);
      const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);let previous=0;for(let i=0;i<data.length;i++){previous=(previous+(Math.random()*2-1)*.022)/1.025;data[i]=previous*3}
      const wind=context.createBufferSource();wind.buffer=buffer;wind.loop=true;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=450;windGain=context.createGain();windGain.gain.value=0;wind.connect(filter);filter.connect(windGain);windGain.connect(master);wind.start();
      breathGain=context.createGain();breathGain.gain.value=0;const breathFilter=context.createBiquadFilter();breathFilter.type='bandpass';breathFilter.frequency.value=650;breathFilter.Q.value=.6;wind.connect(breathFilter);breathFilter.connect(breathGain);breathGain.connect(master);
      for(let i=0;i<4;i++){
        const osc=context.createOscillator(),second=context.createOscillator(),filter=context.createBiquadFilter(),gain=context.createGain(),pan=context.createStereoPanner(),lfo=context.createOscillator(),mod=context.createGain();
        osc.type='sawtooth';second.type='triangle';osc.frequency.value=145;second.frequency.value=293;filter.type='lowpass';filter.frequency.value=950;gain.gain.value=0;lfo.frequency.value=29+i;mod.gain.value=7;lfo.connect(mod);mod.connect(osc.frequency);osc.connect(filter);second.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(master);osc.start();second.start();lfo.start();voices.push({osc,second,filter,gain,pan});
      }
      engineOsc=context.createOscillator();engineOsc.type='triangle';engineOsc.frequency.value=45;engineGain=context.createGain();engineGain.gain.value=0;engineOsc.connect(engineGain);engineGain.connect(master);engineOsc.start();
    }
    try{await context.resume();return true}catch{return false}
  }
  function tone(freq,duration,volume,type='sine'){if(!context||!enabled)return;const o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(freq,context.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(25,freq*.4),context.currentTime+duration);g.gain.setValueAtTime(volume,context.currentTime);g.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);o.connect(g);g.connect(master);o.start();o.stop(context.currentTime+duration)}
  return {
    unlock,
    setEnabled(value){enabled=value;if(master)master.gain.setTargetAtTime(value?.55:0,context.currentTime,.08)},
    passBy(side){if(!context||!enabled)return;const source=context.createBufferSource(),buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.32),context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);source.buffer=buffer;const filter=context.createBiquadFilter(),gain=context.createGain(),pan=context.createStereoPanner();filter.type='bandpass';filter.Q.value=.65;filter.frequency.setValueAtTime(2200,context.currentTime);filter.frequency.exponentialRampToValueAtTime(280,context.currentTime+.32);gain.gain.setValueAtTime(.001,context.currentTime);gain.gain.linearRampToValueAtTime(.2,context.currentTime+.045);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.32);pan.pan.setValueAtTime(side*.75,context.currentTime);pan.pan.linearRampToValueAtTime(-side*.35,context.currentTime+.32);source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(master);source.start();source.stop(context.currentTime+.33)},
    impact(){tone(65,.55,.5,'sawtooth');tone(170,.18,.16,'triangle')},
    update(game,time){
      if(!context)return;const active=game.status==='playing',p=game.player;
      windGain.gain.setTargetAtTime(active?.09:0,context.currentTime,.3);
      const exertion=(100-p.energy)/100;breathGain.gain.setTargetAtTime(active&&game.mode==='foot'?Math.pow(Math.max(0,Math.sin(time*(2.5+exertion*2))),2)*(.05+exertion*.55):0,context.currentTime,.08);
      const closest=[...game.drones].sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).slice(0,4);
      for(let i=0;i<voices.length;i++){const v=voices[i],d=closest[i];if(!active||!d){v.gain.gain.setTargetAtTime(0,context.currentTime,.08);continue}const dx=d.x-p.x,dz=d.z-p.z,dist=Math.hypot(dx,d.y-p.y,dz);const volume=Math.min(.2,2.6/Math.max(4,dist)**1.12);const radial=((d.vx-p.vx)*dx+d.vy*(p.y-d.y)+(d.vz-p.vz)*dz)/Math.max(1,dist);const doppler=Math.max(.83,Math.min(1.2,343/(343-radial)));const speed=Math.hypot(d.vx,d.vy,d.vz);const pitch=(130+speed*2.4+Math.sin(time*3+i)*3)*doppler;v.osc.frequency.setTargetAtTime(pitch,context.currentTime,.05);v.second.frequency.setTargetAtTime(pitch*2.03,context.currentTime,.05);v.gain.gain.setTargetAtTime(volume,context.currentTime,.07);v.filter.frequency.setTargetAtTime(600+2200/(1+dist*.06),context.currentTime,.1);v.pan.pan.setTargetAtTime(Math.max(-.95,Math.min(.95,(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))/Math.max(1,Math.hypot(dx,dz)))),context.currentTime,.05)}
      engineGain.gain.setTargetAtTime(active&&game.mode!=='foot'?.04+Math.abs(p.speed)*.003:0,context.currentTime,.15);engineOsc.frequency.setTargetAtTime(35+Math.abs(p.speed)*4,context.currentTime,.1);
      if(active&&game.mode==='foot'&&p.altitude===0&&p.speed>1&&time-lastStep>(p.boosting?.28:.43)){tone(72+Math.random()*15,.075,.065,'triangle');lastStep=time}
      if(active&&game.threat>.7&&time-lastBeat>.55){tone(48,.13,.08);lastBeat=time}
    },
    suspend(){if(context){voices.forEach(v=>v.gain.gain.setTargetAtTime(0,context.currentTime,.04));engineGain.gain.setTargetAtTime(0,context.currentTime,.04);windGain.gain.setTargetAtTime(0,context.currentTime,.04);breathGain.gain.setTargetAtTime(0,context.currentTime,.04)}},
    destroy(){context?.close()},
  };
}
