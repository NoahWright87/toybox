import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./ModemLabPage.css";

// ── Synthesis helpers ──────────────────────────────────────────────────────

function addTone(
  ctx: AudioContext,
  dest: AudioNode,
  freqs: number[],
  start: number,
  dur: number,
  gain: number,
  type: OscillatorType = "sine",
): void {
  const fi = 0.004;
  const fo = Math.min(0.008, dur * 0.2);
  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    const gn  = ctx.createGain();
    osc.connect(gn);
    gn.connect(dest);
    osc.type = type;
    osc.frequency.value = freq;
    gn.gain.setValueAtTime(0, start);
    gn.gain.linearRampToValueAtTime(gain, start + fi);
    gn.gain.setValueAtTime(gain, start + dur - fo);
    gn.gain.linearRampToValueAtTime(0, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.01);
  }
}

function addNoise(
  ctx: AudioContext,
  dest: AudioNode,
  start: number,
  dur: number,
  gain: number,
  filterFreq?: number,
  filterQ = 1.0,
): void {
  const len = Math.ceil(ctx.sampleRate * (dur + 0.06));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0, start);
  gn.gain.linearRampToValueAtTime(gain, start + 0.005);
  gn.gain.setValueAtTime(gain, start + dur - 0.01);
  gn.gain.linearRampToValueAtTime(0, start + dur);

  if (filterFreq !== undefined) {
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = filterFreq;
    filt.Q.value = filterQ;
    src.connect(filt);
    filt.connect(gn);
  } else {
    src.connect(gn);
  }
  gn.connect(dest);
  src.start(start);
  src.stop(start + dur + 0.06);
}

// ── Phase config types ─────────────────────────────────────────────────────

interface SliderParam {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
}

interface TextParam {
  id: string;
  label: string;
  defaultValue: string;
}

interface PhaseConfig {
  id: string;
  label: string;
  desc: string;
  sliders: SliderParam[];
  texts?: TextParam[];
}

// ── Phase definitions ──────────────────────────────────────────────────────

const PHASES: PhaseConfig[] = [
  {
    id: "dial-tone",
    label: "Dial Tone",
    desc: "Standard PSTN dial tone: 350 + 440 Hz composite.",
    sliders: [
      { id: "freq1",    label: "Freq 1",   min: 200, max: 600,  step: 1,    defaultValue: 350,  unit: "Hz" },
      { id: "freq2",    label: "Freq 2",   min: 200, max: 800,  step: 1,    defaultValue: 440,  unit: "Hz" },
      { id: "gain",     label: "Gain",     min: 0.01, max: 1,   step: 0.01, defaultValue: 0.18, unit: "" },
      { id: "duration", label: "Duration", min: 100, max: 5000, step: 50,   defaultValue: 750,  unit: "ms" },
    ],
  },
  {
    id: "dtmf",
    label: "DTMF Dial",
    desc: "Touch-tone: two ITU-T frequencies per digit.",
    texts: [{ id: "digits", label: "Digits", defaultValue: "18008276364" }],
    sliders: [
      { id: "onDuration",  label: "On time", min: 50,  max: 300, step: 5,    defaultValue: 100,  unit: "ms" },
      { id: "gapDuration", label: "Gap",     min: 10,  max: 200, step: 5,    defaultValue: 50,   unit: "ms" },
      { id: "gain",        label: "Gain",    min: 0.01, max: 1,  step: 0.01, defaultValue: 0.22, unit: "" },
    ],
  },
  {
    id: "pulse",
    label: "Pulse Dial",
    desc: "Rotary-style: series of line-break clicks per digit.",
    texts: [{ id: "digits", label: "Digits", defaultValue: "1234567" }],
    sliders: [
      { id: "onDuration",   label: "Click len",  min: 10,  max: 80,   step: 1,    defaultValue: 33,   unit: "ms" },
      { id: "cycleDuration",label: "Cycle len",  min: 60,  max: 200,  step: 5,    defaultValue: 100,  unit: "ms" },
      { id: "digitGap",     label: "Digit gap",  min: 200, max: 1500, step: 50,   defaultValue: 600,  unit: "ms" },
      { id: "gain",         label: "Gain",       min: 0.01, max: 1,   step: 0.01, defaultValue: 0.32, unit: "" },
    ],
  },
  {
    id: "ringback",
    label: "Ringback",
    desc: "Audible ring signal: 440 + 480 Hz, 2s on / 4s off.",
    sliders: [
      { id: "freq1",        label: "Freq 1",   min: 200, max: 700,  step: 1,    defaultValue: 440,  unit: "Hz" },
      { id: "freq2",        label: "Freq 2",   min: 300, max: 800,  step: 1,    defaultValue: 480,  unit: "Hz" },
      { id: "ringDuration", label: "Ring on",  min: 500, max: 4000, step: 100,  defaultValue: 2000, unit: "ms" },
      { id: "pauseDuration",label: "Ring off", min: 500, max: 8000, step: 100,  defaultValue: 4000, unit: "ms" },
      { id: "rings",        label: "Count",    min: 1,   max: 5,    step: 1,    defaultValue: 2,    unit: "" },
      { id: "gain",         label: "Gain",     min: 0.01, max: 1,   step: 0.01, defaultValue: 0.15, unit: "" },
    ],
  },
  {
    id: "busy",
    label: "Busy Signal",
    desc: "Line engaged: 480 + 620 Hz, 0.5s on / 0.5s off.",
    sliders: [
      { id: "freq1",      label: "Freq 1",   min: 200, max: 800,  step: 1,    defaultValue: 480,  unit: "Hz" },
      { id: "freq2",      label: "Freq 2",   min: 300, max: 1000, step: 1,    defaultValue: 620,  unit: "Hz" },
      { id: "onDuration", label: "On / Off", min: 100, max: 1000, step: 50,   defaultValue: 500,  unit: "ms" },
      { id: "cycles",     label: "Cycles",   min: 2,   max: 10,   step: 1,    defaultValue: 4,    unit: "" },
      { id: "gain",       label: "Gain",     min: 0.01, max: 1,   step: 0.01, defaultValue: 0.20, unit: "" },
    ],
  },
  {
    id: "ansam",
    label: "ANSam Carrier",
    desc: "Answering modem: 2100 Hz with 180° phase reversals every 450 ms (ITU-T V.25).",
    sliders: [
      { id: "carrierFreq",       label: "Carrier",       min: 1800, max: 2400, step: 1,    defaultValue: 2100,  unit: "Hz" },
      { id: "reversalInterval",  label: "Reversal Δt",   min: 100,  max: 1000, step: 10,   defaultValue: 450,   unit: "ms" },
      { id: "sidebandOffset",    label: "Sideband ±",    min: 1,    max: 50,   step: 1,    defaultValue: 15,    unit: "Hz" },
      { id: "mainGain",          label: "Main gain",     min: 0.01, max: 1,    step: 0.01, defaultValue: 0.22,  unit: "" },
      { id: "sidebandGain",      label: "Sideband gain", min: 0,    max: 0.3,  step: 0.005,defaultValue: 0.035, unit: "" },
      { id: "duration",          label: "Duration",      min: 500,  max: 8000, step: 100,  defaultValue: 3300,  unit: "ms" },
    ],
  },
  {
    id: "negotiation",
    label: "V.8 Negotiation",
    desc: "CI/CM/JM exchange: 1300 Hz CI bursts, then 75-baud V.21 FSK (980/1180 Hz).",
    sliders: [
      { id: "ciFreq",   label: "CI freq",   min: 800,  max: 2000, step: 10,   defaultValue: 1300, unit: "Hz" },
      { id: "ansFreq",  label: "Ans freq",  min: 1500, max: 2500, step: 10,   defaultValue: 2100, unit: "Hz" },
      { id: "fskMark",  label: "FSK mark",  min: 600,  max: 1400, step: 10,   defaultValue: 980,  unit: "Hz" },
      { id: "fskSpace", label: "FSK space", min: 800,  max: 1800, step: 10,   defaultValue: 1180, unit: "Hz" },
      { id: "burstLen", label: "CI burst",  min: 20,   max: 400,  step: 10,   defaultValue: 100,  unit: "ms" },
      { id: "burstGap", label: "Burst gap", min: 5,    max: 100,  step: 5,    defaultValue: 15,   unit: "ms" },
      { id: "gain",     label: "Gain",      min: 0.01, max: 1,    step: 0.01, defaultValue: 0.19, unit: "" },
      { id: "duration", label: "Duration",  min: 500,  max: 8000, step: 100,  defaultValue: 2000, unit: "ms" },
    ],
  },
  {
    id: "training",
    label: "Training Noise",
    desc: "Channel equalisation: swept bandpass noise + V.34 pilot tones + AM carriers.",
    sliders: [
      { id: "noiseGain",  label: "Noise level", min: 0,   max: 1,    step: 0.01,  defaultValue: 0.16,  unit: "" },
      { id: "filterQ",    label: "Filter Q",    min: 0.1, max: 10,   step: 0.1,   defaultValue: 0.8,   unit: "" },
      { id: "sweepStart", label: "Sweep start", min: 100, max: 2000, step: 50,    defaultValue: 400,   unit: "Hz" },
      { id: "sweepPeak",  label: "Sweep peak",  min: 1000,max: 4000, step: 100,   defaultValue: 2800,  unit: "Hz" },
      { id: "sweepMid",   label: "Sweep mid",   min: 200, max: 3000, step: 100,   defaultValue: 900,   unit: "Hz" },
      { id: "sweepPeak2", label: "Sweep peak 2",min: 1000,max: 4000, step: 100,   defaultValue: 2500,  unit: "Hz" },
      { id: "sweepEnd",   label: "Sweep end",   min: 500, max: 3500, step: 100,   defaultValue: 1600,  unit: "Hz" },
      { id: "pilotGain",  label: "Pilot gain",  min: 0,   max: 0.3,  step: 0.005, defaultValue: 0.028, unit: "" },
      { id: "amGain",     label: "AM gain",     min: 0,   max: 0.3,  step: 0.005, defaultValue: 0.036, unit: "" },
      { id: "duration",   label: "Duration",    min: 1000,max: 15000,step: 500,   defaultValue: 7000,  unit: "ms" },
    ],
  },
  {
    id: "connected",
    label: "Connected Click",
    desc: "Carrier lock: brief noise burst as modems switch to data mode.",
    sliders: [
      { id: "gain",     label: "Gain",     min: 0.01, max: 1,   step: 0.01, defaultValue: 0.38, unit: "" },
      { id: "duration", label: "Duration", min: 5,    max: 100, step: 1,    defaultValue: 12,   unit: "ms" },
    ],
  },
  {
    id: "no-carrier",
    label: "NO CARRIER",
    desc: "Connection failed: three descending error tones.",
    sliders: [
      { id: "freq1", label: "Tone 1", min: 500,  max: 3000, step: 10,   defaultValue: 1400, unit: "Hz" },
      { id: "freq2", label: "Tone 2", min: 400,  max: 2500, step: 10,   defaultValue: 1100, unit: "Hz" },
      { id: "freq3", label: "Tone 3", min: 300,  max: 2000, step: 10,   defaultValue: 820,  unit: "Hz" },
      { id: "dur1",  label: "Dur 1",  min: 50,   max: 500,  step: 10,   defaultValue: 150,  unit: "ms" },
      { id: "dur2",  label: "Dur 2",  min: 50,   max: 500,  step: 10,   defaultValue: 150,  unit: "ms" },
      { id: "dur3",  label: "Dur 3",  min: 100,  max: 1000, step: 10,   defaultValue: 320,  unit: "ms" },
      { id: "gain",  label: "Gain",   min: 0.01, max: 1,    step: 0.01, defaultValue: 0.28, unit: "" },
    ],
  },
];

// ── Play functions (return duration in seconds) ───────────────────────────

type PlayFn = (
  ctx: AudioContext,
  dest: AudioNode,
  p: Record<string, number>,
  t: Record<string, string>,
) => number;

const DTMF_MAP: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
  "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
  "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
};

const PLAY_FNS: Record<string, PlayFn> = {

  "dial-tone": (ctx, dest, p) => {
    const dur = p.duration / 1000;
    addTone(ctx, dest, [p.freq1, p.freq2], ctx.currentTime, dur, p.gain);
    return dur;
  },

  "dtmf": (ctx, dest, p, t) => {
    const digits = t.digits || "0";
    const onSec  = p.onDuration / 1000;
    const gapSec = p.gapDuration / 1000;
    let off = 0;
    const start = ctx.currentTime;
    for (const ch of digits) {
      const freqs = DTMF_MAP[ch];
      if (freqs) {
        addTone(ctx, dest, freqs, start + off, onSec, p.gain);
        off += onSec + gapSec;
      }
    }
    return off + 0.15;
  },

  "pulse": (ctx, dest, p, t) => {
    const digits   = t.digits || "0";
    const onSec    = p.onDuration / 1000;
    const cycleSec = p.cycleDuration / 1000;
    const gapSec   = p.digitGap / 1000;
    let off = 0;
    const start = ctx.currentTime;
    for (const ch of digits) {
      const n = ch === "0" ? 10 : parseInt(ch, 10);
      if (isNaN(n)) continue;
      for (let i = 0; i < n; i++) {
        addNoise(ctx, dest, start + off, onSec, p.gain);
        off += cycleSec;
      }
      off += gapSec;
    }
    return off + 0.15;
  },

  "ringback": (ctx, dest, p) => {
    const ringDur  = p.ringDuration / 1000;
    const pauseDur = p.pauseDuration / 1000;
    const rings    = Math.round(p.rings);
    const start    = ctx.currentTime;
    for (let i = 0; i < rings; i++) {
      addTone(ctx, dest, [p.freq1, p.freq2], start + i * (ringDur + pauseDur), ringDur, p.gain);
    }
    return rings * (ringDur + pauseDur);
  },

  "busy": (ctx, dest, p) => {
    const onSec  = p.onDuration / 1000;
    const cycles = Math.round(p.cycles);
    const start  = ctx.currentTime;
    for (let i = 0; i < cycles; i++) {
      addTone(ctx, dest, [p.freq1, p.freq2], start + i * onSec * 2, onSec, p.gain);
    }
    return cycles * onSec * 2 + 0.1;
  },

  // ANSam: 2100 Hz carrier with instantaneous 180° phase reversals every
  // reversalInterval ms. Sidebands at fc ± sidebandOffset add AM character.
  "ansam": (ctx, dest, p) => {
    const dur      = p.duration / 1000;
    const interval = p.reversalInterval / 1000;
    const start    = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gn  = ctx.createGain();
    osc.connect(gn);
    gn.connect(dest);
    osc.type = "sine";
    osc.frequency.value = p.carrierFreq;

    const steps = Math.floor(dur / interval);
    gn.gain.setValueAtTime(0, start);
    gn.gain.linearRampToValueAtTime(p.mainGain, start + 0.02);
    for (let i = 1; i <= steps; i++) {
      const rt   = start + i * interval;
      const sign = i % 2 === 0 ? p.mainGain : -p.mainGain;
      // Very brief dip through zero makes the reversal cleaner
      gn.gain.linearRampToValueAtTime(sign * 0.04, rt - 0.003);
      gn.gain.linearRampToValueAtTime(sign, rt + 0.003);
    }
    gn.gain.linearRampToValueAtTime(0, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.01);

    if (p.sidebandGain > 0) {
      addTone(ctx, dest,
        [p.carrierFreq - p.sidebandOffset, p.carrierFreq + p.sidebandOffset],
        start, dur, p.sidebandGain);
    }
    return dur;
  },

  // V.8 Negotiation:
  //   Phase 1 (~40%): CI tone (ciFreq) alternates with answering-modem response (ansFreq)
  //   Phase 2 (~60%): V.21 FSK at 75 baud — alternating mark/space (fskMark / fskSpace)
  //                   This is the "rapid warbling" that is the most distinctive V.8 sound.
  "negotiation": (ctx, dest, p) => {
    const dur     = p.duration / 1000;
    const start   = ctx.currentTime;
    const bLen    = p.burstLen / 1000;
    const bGap    = p.burstGap / 1000;

    // Phase 1: CI / answer burst exchange
    const phase1End = dur * 0.40;
    let off = 0;
    while (off + bLen < phase1End) {
      addTone(ctx, dest, [p.ciFreq],  start + off,            bLen,        p.gain);
      off += bLen + bGap;
      if (off + bLen * 0.6 < phase1End) {
        addTone(ctx, dest, [p.ansFreq], start + off, bLen * 0.6,  p.gain * 0.85);
        off += bLen * 0.6 + bGap * 0.5;
      }
    }

    // Phase 2: V.21 75-baud FSK  (1 / 75 ≈ 13.3 ms per symbol)
    const symbolSec = 1 / 75;
    let off2 = phase1End;
    while (off2 + symbolSec < dur) {
      const freq = Math.random() < 0.5 ? p.fskMark : p.fskSpace;
      addTone(ctx, dest, [freq], start + off2, symbolSec, p.gain * 0.9);
      off2 += symbolSec;
    }

    return dur;
  },

  // Training: swept bandpass noise + pilot tones + choppy AM carriers.
  // The user can tune sweep waypoints, noise gain, filter Q, and AM levels.
  "training": (ctx, dest, p) => {
    const dur   = p.duration / 1000;
    const start = ctx.currentTime;

    // Swept noise layer
    const len = Math.ceil(ctx.sampleRate * (dur + 0.12));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const dat = buf.getChannelData(0);
    for (let i = 0; i < len; i++) dat[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type  = "bandpass";
    filt.Q.value = p.filterQ;
    filt.frequency.setValueAtTime(p.sweepStart, start);
    filt.frequency.linearRampToValueAtTime(p.sweepPeak,  start + dur * 0.25);
    filt.frequency.linearRampToValueAtTime(p.sweepMid,   start + dur * 0.45);
    filt.frequency.linearRampToValueAtTime(p.sweepPeak2, start + dur * 0.65);
    filt.frequency.linearRampToValueAtTime(p.sweepEnd,   start + dur);

    const noiseGn = ctx.createGain();
    noiseGn.gain.setValueAtTime(0, start);
    noiseGn.gain.linearRampToValueAtTime(p.noiseGain, start + 0.09);
    noiseGn.gain.setValueAtTime(p.noiseGain, start + dur - 0.07);
    noiseGn.gain.linearRampToValueAtTime(0, start + dur);

    src.connect(filt);
    filt.connect(noiseGn);
    noiseGn.connect(dest);
    src.start(start);
    src.stop(start + dur + 0.12);

    // V.34 pilot tones (constant reference sinusoids every 600 Hz)
    [600, 1200, 1800, 2400, 3000].forEach((freq, idx) => {
      const s = start + idx * 0.10;
      const d = dur - idx * 0.10;
      if (d > 0.2) addTone(ctx, dest, [freq], s, d, p.pilotGain);
    });

    // AM-textured carrier segments
    const segDur = dur / 3;
    [1800, 2400, 1200].forEach((cf, idx) => {
      const s0  = start + idx * segDur;
      const osc = ctx.createOscillator();
      const amGn = ctx.createGain();
      osc.connect(amGn);
      amGn.connect(dest);
      osc.type = "sine";
      osc.frequency.value = cf;
      const steps = Math.max(1, Math.floor(segDur * 30));
      for (let s = 0; s < steps; s++) {
        amGn.gain.setValueAtTime(
          p.amGain * (0.3 + Math.random() * 1.4),
          s0 + s * (segDur / steps),
        );
      }
      amGn.gain.linearRampToValueAtTime(0, s0 + segDur);
      osc.start(s0);
      osc.stop(s0 + segDur + 0.01);
    });

    return dur;
  },

  "connected": (ctx, dest, p) => {
    const dur = p.duration / 1000;
    addNoise(ctx, dest, ctx.currentTime, dur, p.gain);
    return dur + 0.1;
  },

  "no-carrier": (ctx, dest, p) => {
    const start = ctx.currentTime;
    const d1 = p.dur1 / 1000;
    const d2 = p.dur2 / 1000;
    const d3 = p.dur3 / 1000;
    addTone(ctx, dest, [p.freq1], start,                d1, p.gain);
    addTone(ctx, dest, [p.freq2], start + d1 + 0.03,   d2, p.gain);
    addTone(ctx, dest, [p.freq3], start + d1 + d2 + 0.06, d3, p.gain);
    return d1 + d2 + d3 + 0.2;
  },
};

// ── Default state builders ─────────────────────────────────────────────────

function buildDefaultSliders(): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const phase of PHASES) {
    out[phase.id] = {};
    for (const s of phase.sliders) out[phase.id][s.id] = s.defaultValue;
  }
  return out;
}

function buildDefaultTexts(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const phase of PHASES) {
    if (phase.texts) {
      out[phase.id] = {};
      for (const t of phase.texts) out[phase.id][t.id] = t.defaultValue;
    }
  }
  return out;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ModemLabPage() {
  const navigate = useNavigate();

  const [phaseIdx, setPhaseIdx] = useState(5); // default to ANSam
  const [allSliders, setAllSliders] = useState(buildDefaultSliders);
  const [allTexts,   setAllTexts]   = useState(buildDefaultTexts);
  const [playing,    setPlaying]    = useState(false);
  const [looping,    setLooping]    = useState(false);
  const [statusMsg,  setStatusMsg]  = useState("Ready.");

  const ctxRef   = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopRef  = useRef(false);

  // Keep loopRef in sync
  useEffect(() => { loopRef.current = looping; }, [looping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      try { ctxRef.current?.close(); } catch { /* ignore */ }
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    try { ctxRef.current?.close(); } catch { /* ignore */ }
    ctxRef.current = null;
    setPlaying(false);
    setStatusMsg("Stopped.");
  }, []);

  const doPlay = useCallback((
    phase: PhaseConfig,
    sliders: Record<string, number>,
    texts: Record<string, string>,
  ) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    try { ctxRef.current?.close(); } catch { /* ignore */ }

    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    ctxRef.current = ctx;

    const fn = PLAY_FNS[phase.id];
    if (!fn) { setStatusMsg("No play function for this phase."); return; }

    const duration = fn(ctx, master, sliders, texts);
    setPlaying(true);
    setStatusMsg(`Playing: ${phase.label}  (${duration.toFixed(1)} s)`);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (loopRef.current) {
        doPlay(phase, sliders, texts);
      } else {
        setPlaying(false);
        setStatusMsg("Done.");
      }
    }, Math.round(duration * 1000) + 200);
  }, []);

  const handlePlay = useCallback(() => {
    const phase = PHASES[phaseIdx];
    doPlay(
      phase,
      allSliders[phase.id] ?? {},
      allTexts[phase.id] ?? {},
    );
  }, [phaseIdx, allSliders, allTexts, doPlay]);

  const handleSelectPhase = useCallback((idx: number) => {
    stopAudio();
    setPhaseIdx(idx);
    setStatusMsg("Ready.");
  }, [stopAudio]);

  const handleReset = useCallback(() => {
    const phase = PHASES[phaseIdx];
    const defaults: Record<string, number> = {};
    for (const s of phase.sliders) defaults[s.id] = s.defaultValue;
    setAllSliders((prev) => ({ ...prev, [phase.id]: defaults }));

    if (phase.texts) {
      const defTexts: Record<string, string> = {};
      for (const t of phase.texts) defTexts[t.id] = t.defaultValue;
      setAllTexts((prev) => ({ ...prev, [phase.id]: defTexts }));
    }
  }, [phaseIdx]);

  const phase   = PHASES[phaseIdx];
  const sliders = allSliders[phase.id] ?? {};
  const texts   = allTexts[phase.id] ?? {};

  return (
    <div className="mlab">
      {/* ── Title bar ── */}
      <div className="mlab__titlebar">
        <button className="mlab__back" onClick={() => { stopAudio(); navigate("/"); }}>
          ← NS Doors 97
        </button>
        <span className="mlab__title">🔬 NOAHSOFT MODEM DIAGNOSTICS v1.0</span>
        <span className="mlab__subtitle">Sound Lab — Internal Use Only</span>
      </div>

      <div className="mlab__body">
        {/* ── Phase list ── */}
        <div className="mlab__sidebar">
          <div className="mlab__sidebar-header">SOUND PHASES</div>
          {PHASES.map((ph, i) => (
            <button
              key={ph.id}
              className={`mlab__phase-btn${i === phaseIdx ? " mlab__phase-btn--active" : ""}`}
              onClick={() => handleSelectPhase(i)}
            >
              {ph.label}
            </button>
          ))}
        </div>

        {/* ── Main panel ── */}
        <div className="mlab__main">
          <div className="mlab__phase-header">
            <span className="mlab__phase-name">{phase.label}</span>
            <span className="mlab__phase-desc">{phase.desc}</span>
          </div>

          {/* Text inputs */}
          {phase.texts && phase.texts.map((t) => (
            <div key={t.id} className="mlab__text-row">
              <label className="mlab__text-label">{t.label}</label>
              <input
                className="mlab__text-input"
                type="text"
                value={texts[t.id] ?? t.defaultValue}
                onChange={(e) =>
                  setAllTexts((prev) => ({
                    ...prev,
                    [phase.id]: { ...(prev[phase.id] ?? {}), [t.id]: e.target.value },
                  }))
                }
              />
            </div>
          ))}

          {/* Sliders */}
          <div className="mlab__sliders">
            {phase.sliders.map((s) => {
              const val = sliders[s.id] ?? s.defaultValue;
              return (
                <div key={s.id} className="mlab__slider-row">
                  <label className="mlab__slider-label">{s.label}</label>
                  <input
                    className="mlab__slider"
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={val}
                    onChange={(e) =>
                      setAllSliders((prev) => ({
                        ...prev,
                        [phase.id]: { ...(prev[phase.id] ?? {}), [s.id]: Number(e.target.value) },
                      }))
                    }
                  />
                  <span className="mlab__slider-val">
                    {typeof val === "number" && s.step < 1
                      ? val.toFixed(3)
                      : Math.round(val)}
                    {s.unit && <span className="mlab__slider-unit"> {s.unit}</span>}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mlab__divider" />

          {/* Controls */}
          <div className="mlab__controls">
            <button
              className={`mlab__btn mlab__btn--play${playing ? " mlab__btn--active" : ""}`}
              onClick={playing ? stopAudio : handlePlay}
            >
              {playing ? "■ STOP" : "▶ PLAY"}
            </button>
            <label className="mlab__loop-label">
              <input
                type="checkbox"
                checked={looping}
                onChange={(e) => setLooping(e.target.checked)}
              />
              Loop
            </label>
            <button className="mlab__btn mlab__btn--reset" onClick={handleReset}>
              Reset
            </button>
            <div className="mlab__status">{statusMsg}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
