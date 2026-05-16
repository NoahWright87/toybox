import type { OscWaveform } from './types';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

export function audioCurrentTime(): number {
  return getCtx().currentTime;
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function playNote(
  pitch: number,
  velocity: number,
  durationSec: number,
  waveform: OscWaveform,
  when?: number,
  gain = 1,
): void {
  const c = getCtx();
  const t = when ?? c.currentTime;
  const vol = (velocity / 127) * 0.22 * Math.max(0, Math.min(1, gain));

  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = waveform as OscillatorType;
  osc.frequency.value = midiToHz(pitch);
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + durationSec);
  osc.connect(env);
  env.connect(c.destination);
  osc.start(t);
  osc.stop(t + durationSec + 0.01);
}

function makeNoiseBuf(c: AudioContext, dur: number): AudioBuffer {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function playKick(velocity: number, when: number): void {
  const c = getCtx();
  const vol = (velocity / 127) * 0.7;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, when);
  osc.frequency.exponentialRampToValueAtTime(40, when + 0.08);
  env.gain.setValueAtTime(vol, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
  osc.connect(env);
  env.connect(c.destination);
  osc.start(when);
  osc.stop(when + 0.26);
}

function playSnare(velocity: number, when: number): void {
  const c = getCtx();
  const vol = (velocity / 127) * 0.4;
  const dur = 0.18;

  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuf(c, dur);
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 1800;
  const env = c.createGain();
  env.gain.setValueAtTime(vol, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + dur);
  noise.connect(filt);
  filt.connect(env);
  env.connect(c.destination);
  noise.start(when);
  noise.stop(when + dur);

  const osc = c.createOscillator();
  const oenv = c.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 200;
  oenv.gain.setValueAtTime(vol * 0.7, when);
  oenv.gain.exponentialRampToValueAtTime(0.001, when + 0.08);
  osc.connect(oenv);
  oenv.connect(c.destination);
  osc.start(when);
  osc.stop(when + 0.09);
}

function playHihat(open: boolean, velocity: number, when: number): void {
  const c = getCtx();
  const vol = (velocity / 127) * 0.25;
  const dur = open ? 0.28 : 0.045;

  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuf(c, dur);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 8000;
  const env = c.createGain();
  env.gain.setValueAtTime(vol, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + dur);
  noise.connect(hp);
  hp.connect(env);
  env.connect(c.destination);
  noise.start(when);
  noise.stop(when + dur);
}

export function playDrum(pitch: number, velocity: number, when?: number): void {
  const c = getCtx();
  const t = when ?? c.currentTime;
  switch (pitch) {
    case 36: playKick(velocity, t); break;
    case 38: playSnare(velocity, t); break;
    case 42: playHihat(false, velocity, t); break;
    case 46: playHihat(true, velocity, t); break;
  }
}
