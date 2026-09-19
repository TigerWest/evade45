import type { GameState } from './types';

interface DroneVoice {
  osc: OscillatorNode;
  second: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  pan: StereoPannerNode;
}

export interface GameAudio {
  unlock: () => Promise<boolean>;
  setEnabled: (value: boolean) => void;
  passBy: (side: number) => void;
  impact: () => void;
  update: (game: GameState, time: number) => void;
  suspend: () => void;
  destroy: () => void;
}

export function createAudio(): GameAudio {
  let context: AudioContext | undefined,
    master: GainNode | undefined,
    engineGain: GainNode | undefined,
    engineOsc: OscillatorNode | undefined,
    windGain: GainNode | undefined,
    breathGain: GainNode | undefined;
  const voices: DroneVoice[] = [];
  let enabled = true,
    lastStep = 0,
    lastBeat = 0;
  async function unlock(): Promise<boolean> {
    const Audio =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return false;
    if (!context) {
      context = new Audio();
      master = context.createGain();
      master.gain.value = 0.55;
      master.connect(context.destination);
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate),
        data = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.022) / 1.025;
        data[i] = previous * 3;
      }
      const wind = context.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 450;
      windGain = context.createGain();
      windGain.gain.value = 0;
      wind.connect(filter);
      filter.connect(windGain);
      windGain.connect(master);
      wind.start();
      breathGain = context.createGain();
      breathGain.gain.value = 0;
      const breathFilter = context.createBiquadFilter();
      breathFilter.type = 'bandpass';
      breathFilter.frequency.value = 650;
      breathFilter.Q.value = 0.6;
      wind.connect(breathFilter);
      breathFilter.connect(breathGain);
      breathGain.connect(master);
      for (let i = 0; i < 4; i++) {
        const osc = context.createOscillator(),
          second = context.createOscillator(),
          filter = context.createBiquadFilter(),
          gain = context.createGain(),
          pan = context.createStereoPanner(),
          lfo = context.createOscillator(),
          mod = context.createGain();
        osc.type = 'sawtooth';
        second.type = 'triangle';
        osc.frequency.value = 145;
        second.frequency.value = 293;
        filter.type = 'lowpass';
        filter.frequency.value = 950;
        gain.gain.value = 0;
        lfo.frequency.value = 29 + i;
        mod.gain.value = 7;
        lfo.connect(mod);
        mod.connect(osc.frequency);
        osc.connect(filter);
        second.connect(filter);
        filter.connect(gain);
        gain.connect(pan);
        pan.connect(master);
        osc.start();
        second.start();
        lfo.start();
        voices.push({ osc, second, filter, gain, pan });
      }
      engineOsc = context.createOscillator();
      engineOsc.type = 'triangle';
      engineOsc.frequency.value = 45;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    try {
      await context.resume();
      return true;
    } catch {
      return false;
    }
  }
  function tone(freq: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    if (!context || !enabled || !master) return;
    const o = context.createOscillator(),
      g = context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, context.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(25, freq * 0.4),
      context.currentTime + duration,
    );
    g.gain.setValueAtTime(volume, context.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(context.currentTime + duration);
  }
  return {
    unlock,
    setEnabled(value: boolean) {
      enabled = value;
      if (master && context)
        master.gain.setTargetAtTime(value ? 0.55 : 0, context.currentTime, 0.08);
    },
    passBy(side: number) {
      if (!context || !enabled || !master) return;
      const source = context.createBufferSource(),
        buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.32), context.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      source.buffer = buffer;
      const filter = context.createBiquadFilter(),
        gain = context.createGain(),
        pan = context.createStereoPanner();
      filter.type = 'bandpass';
      filter.Q.value = 0.65;
      filter.frequency.setValueAtTime(2200, context.currentTime);
      filter.frequency.exponentialRampToValueAtTime(280, context.currentTime + 0.32);
      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.32);
      pan.pan.setValueAtTime(side * 0.75, context.currentTime);
      pan.pan.linearRampToValueAtTime(-side * 0.35, context.currentTime + 0.32);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(master);
      source.start();
      source.stop(context.currentTime + 0.33);
    },
    impact() {
      tone(65, 0.55, 0.5, 'sawtooth');
      tone(170, 0.18, 0.16, 'triangle');
    },
    update(game: GameState, time: number) {
      if (!context || !windGain || !breathGain || !engineGain || !engineOsc) return;
      const active = game.status === 'playing',
        p = game.player;
      windGain.gain.setTargetAtTime(active ? 0.09 : 0, context.currentTime, 0.3);
      const exertion = (100 - p.energy) / 100;
      breathGain.gain.setTargetAtTime(
        active && game.mode === 'foot'
          ? Math.pow(Math.max(0, Math.sin(time * (2.5 + exertion * 2))), 2) *
              (0.05 + exertion * 0.55)
          : 0,
        context.currentTime,
        0.08,
      );
      const closest = [...game.drones]
        .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))
        .slice(0, 4);
      for (let i = 0; i < voices.length; i++) {
        const v = voices[i],
          d = closest[i];
        if (!active || !d) {
          v.gain.gain.setTargetAtTime(0, context.currentTime, 0.08);
          continue;
        }
        const dx = d.x - p.x,
          dz = d.z - p.z,
          dist = Math.hypot(dx, d.y - p.y, dz);
        const volume = Math.min(0.2, 2.6 / Math.max(4, dist) ** 1.12);
        const radial =
          ((d.vx - p.vx) * dx + d.vy * (p.y - d.y) + (d.vz - p.vz) * dz) / Math.max(1, dist);
        const doppler = Math.max(0.83, Math.min(1.2, 343 / (343 - radial)));
        const speed = Math.hypot(d.vx, d.vy, d.vz);
        const pitch = (130 + speed * 2.4 + Math.sin(time * 3 + i) * 3) * doppler;
        v.osc.frequency.setTargetAtTime(pitch, context.currentTime, 0.05);
        v.second.frequency.setTargetAtTime(pitch * 2.03, context.currentTime, 0.05);
        v.gain.gain.setTargetAtTime(volume, context.currentTime, 0.07);
        v.filter.frequency.setTargetAtTime(
          600 + 2200 / (1 + dist * 0.06),
          context.currentTime,
          0.1,
        );
        v.pan.pan.setTargetAtTime(
          Math.max(
            -0.95,
            Math.min(
              0.95,
              (dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw)) / Math.max(1, Math.hypot(dx, dz)),
            ),
          ),
          context.currentTime,
          0.05,
        );
      }
      engineGain.gain.setTargetAtTime(
        active && game.mode !== 'foot' ? 0.04 + Math.abs(p.speed) * 0.003 : 0,
        context.currentTime,
        0.15,
      );
      engineOsc.frequency.setTargetAtTime(35 + Math.abs(p.speed) * 4, context.currentTime, 0.1);
      if (
        active &&
        game.mode === 'foot' &&
        p.altitude === 0 &&
        p.speed > 1 &&
        time - lastStep > (p.boosting ? 0.28 : 0.43)
      ) {
        tone(72 + Math.random() * 15, 0.075, 0.065, 'triangle');
        lastStep = time;
      }
      if (active && game.threat > 0.7 && time - lastBeat > 0.55) {
        tone(48, 0.13, 0.08);
        lastBeat = time;
      }
    },
    suspend() {
      if (context) {
        voices.forEach((v) => v.gain.gain.setTargetAtTime(0, context!.currentTime, 0.04));
        engineGain?.gain.setTargetAtTime(0, context.currentTime, 0.04);
        windGain?.gain.setTargetAtTime(0, context.currentTime, 0.04);
        breathGain?.gain.setTargetAtTime(0, context.currentTime, 0.04);
      }
    },
    destroy() {
      context?.close();
    },
  };
}
