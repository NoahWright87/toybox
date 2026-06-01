import type { OscWaveform } from './types';
import { loadSoundFont as sf2Load, isSoundFontReady, playSfNote } from './sf2';

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

// Applies easing to a 0–1 progress value. curvature 0=linear, >0=ease-in, <0=ease-out.
export function shapedCurve(p: number, curvature: number): number {
  if (curvature === 0) return p;
  const exp = 1 + Math.abs(curvature) * 3;
  return curvature > 0 ? Math.pow(p, exp) : 1 - Math.pow(1 - p, exp);
}

export { isSoundFontReady };

export function loadSoundFont(url: string): Promise<void> {
  return sf2Load(url);
}

// Plays a note via soundfont sample (if loaded and gmProgram set) or oscillator fallback.
export function playNote(
  pitch: number,
  velocity: number,
  durationSec: number,
  waveform: OscWaveform,
  when?: number,
  gain = 1,
  attack = 0.01,
  release = 0.1,
  gmProgram?: number,
  bendToPitch?: number,
  bendCurvature = 0,
  bendStartSec = 0,      // seconds into the note when the slide begins
  bendDurationSec?: number, // seconds the slide lasts (defaults to near end of note)
): void {
  const c = getCtx();
  const t = when ?? c.currentTime;

  if (gmProgram !== undefined && isSoundFontReady()) {
    if (playSfNote(gmProgram, pitch, velocity, durationSec, c, t, gain, bendToPitch, bendCurvature, bendStartSec, bendDurationSec)) return;
    // SF failed to find a zone for this pitch — fall through to oscillator
  }
  const vol = (velocity / 127) * 0.22 * Math.max(0, Math.min(1, gain));

  const atkDur   = Math.min(attack, durationSec * 0.4);
  const relDur   = Math.min(release, durationSec * 0.4);
  const atkEnd   = t + atkDur;
  const relStart = t + Math.max(atkDur, durationSec - relDur);
  const relEnd   = relStart + relDur;

  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = waveform as OscillatorType;

  if (bendToPitch !== undefined) {
    const N = 32;
    const curve = new Float32Array(N);
    const startHz = midiToHz(pitch);
    const endHz   = midiToHz(bendToPitch);
    for (let i = 0; i < N; i++) {
      curve[i] = startHz + (endHz - startHz) * shapedCurve(i / (N - 1), bendCurvature);
    }
    const slideStart = t + bendStartSec;
    const slideDur   = bendDurationSec ?? Math.max(durationSec - relDur - bendStartSec - 0.01, 0.05);
    osc.frequency.setValueAtTime(startHz, t);
    osc.frequency.setValueCurveAtTime(curve, slideStart, slideDur);
    osc.frequency.setValueAtTime(endHz, slideStart + slideDur);
  } else {
    osc.frequency.value = midiToHz(pitch);
  }

  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, atkEnd);
  env.gain.setValueAtTime(vol, relStart);
  env.gain.exponentialRampToValueAtTime(0.001, relEnd + 0.005);

  osc.connect(env);
  env.connect(c.destination);
  osc.start(t);
  osc.stop(relEnd + 0.01);
}

// Starts a note that sustains until the returned stop function is called.
export function startSustainedNote(
  pitch: number,
  waveform: OscWaveform,
  gain: number,
  attack: number,
): () => void {
  const c = getCtx();
  const t = c.currentTime;
  const vol = 0.22 * Math.max(0, Math.min(1, gain));
  const atkDur = Math.min(attack, 0.05);

  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = waveform as OscillatorType;
  osc.frequency.value = midiToHz(pitch);

  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + atkDur);

  osc.connect(env);
  env.connect(c.destination);
  osc.start(t);

  return () => {
    const now = c.currentTime;
    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(env.gain.value, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    try { osc.stop(now + 0.16); } catch { /* already stopped */ }
  };
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
  osc.connect(env); env.connect(c.destination);
  osc.start(when); osc.stop(when + 0.26);
}

function playSnare(velocity: number, when: number): void {
  const c = getCtx();
  const vol = (velocity / 127) * 0.4;
  const dur = 0.18;

  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuf(c, dur);
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass'; filt.frequency.value = 1800;
  const env = c.createGain();
  env.gain.setValueAtTime(vol, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + dur);
  noise.connect(filt); filt.connect(env); env.connect(c.destination);
  noise.start(when); noise.stop(when + dur);

  const osc = c.createOscillator();
  const oenv = c.createGain();
  osc.type = 'triangle'; osc.frequency.value = 200;
  oenv.gain.setValueAtTime(vol * 0.7, when);
  oenv.gain.exponentialRampToValueAtTime(0.001, when + 0.08);
  osc.connect(oenv); oenv.connect(c.destination);
  osc.start(when); osc.stop(when + 0.09);
}

function playHihat(open: boolean, velocity: number, when: number): void {
  const c = getCtx();
  const vol = (velocity / 127) * 0.25;
  const dur = open ? 0.28 : 0.045;

  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuf(c, dur);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 8000;
  const env = c.createGain();
  env.gain.setValueAtTime(vol, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + dur);
  noise.connect(hp); hp.connect(env); env.connect(c.destination);
  noise.start(when); noise.stop(when + dur);
}

function playTom(freq: number, velocity: number, when: number): void {
  const c = getCtx();
  const vol = (velocity / 127) * 0.55;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, when);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.45, when + 0.14);
  env.gain.setValueAtTime(vol, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
  osc.connect(env); env.connect(c.destination);
  osc.start(when); osc.stop(when + 0.23);
}

function playClap(velocity: number, when: number): void {
  const c = getCtx();
  const vol = (velocity / 127) * 0.35;
  for (let i = 0; i < 2; i++) {
    const d = i * 0.014;
    const noise = c.createBufferSource();
    noise.buffer = makeNoiseBuf(c, 0.06);
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 0.8;
    const env = c.createGain();
    env.gain.setValueAtTime(vol, when + d);
    env.gain.exponentialRampToValueAtTime(0.001, when + d + 0.09);
    noise.connect(filt); filt.connect(env); env.connect(c.destination);
    noise.start(when + d); noise.stop(when + d + 0.1);
  }
}

function playCrash(velocity: number, when: number): void {
  const c = getCtx();
  const vol = (velocity / 127) * 0.2;
  const dur = 0.8;
  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuf(c, dur);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 6000;
  const env = c.createGain();
  env.gain.setValueAtTime(vol, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + dur);
  noise.connect(hp); hp.connect(env); env.connect(c.destination);
  noise.start(when); noise.stop(when + dur);
}

function playRide(velocity: number, when: number): void {
  const c = getCtx();
  const vol = (velocity / 127) * 0.15;
  const dur = 0.35;
  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuf(c, dur);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 10000; bp.Q.value = 2;
  const env = c.createGain();
  env.gain.setValueAtTime(vol, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + dur);
  noise.connect(bp); bp.connect(env); env.connect(c.destination);
  noise.start(when); noise.stop(when + dur);
}

export function playDrum(pitch: number, velocity: number, when?: number): void {
  const c = getCtx();
  const t = when ?? c.currentTime;
  switch (pitch) {
    case 36: playKick(velocity, t); break;
    case 38: playSnare(velocity, t); break;
    case 39: playClap(velocity, t); break;
    case 41: playTom(90,  velocity, t); break;
    case 42: playHihat(false, velocity, t); break;
    case 46: playHihat(true,  velocity, t); break;
    case 47: playTom(150, velocity, t); break;
    case 49: playCrash(velocity, t); break;
    case 50: playTom(220, velocity, t); break;
    case 51: playRide(velocity, t); break;
  }
}
