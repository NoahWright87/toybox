// Synthesizes V.90 dial-up handshake sounds using Web Audio API.
// Based on ITU-T V.8 / V.34 / V.90 procedures and PSTN signaling standards.

export type DialType = "touchtone" | "pulse";

const DTMF_MAP: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
  "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
  "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
};

const DTMF_ON_SEC       = 0.100;
const DTMF_GAP_SEC      = 0.050;
const PULSE_ON_SEC      = 0.033; // line break (audible click)
const PULSE_CYCLE_SEC   = 0.100; // full pulse cycle
const PULSE_DIGIT_GAP_SEC = 0.600;

/** Returns the wall-clock duration (ms) of dialing a digit string. */
export function getDialDuration(digits: string, dialType: DialType): number {
  if (dialType === "pulse") {
    let total = 0;
    for (const ch of digits) {
      const n = ch === "0" ? 10 : parseInt(ch, 10);
      if (!isNaN(n)) total += n * PULSE_CYCLE_SEC + PULSE_DIGIT_GAP_SEC;
    }
    return Math.round(total * 1000);
  }
  const count = digits.split("").filter((ch) => ch in DTMF_MAP).length;
  return Math.round(count * (DTMF_ON_SEC + DTMF_GAP_SEC) * 1000);
}

export class ModemSounds {
  private ctx: AudioContext;
  private master: GainNode;

  constructor(volume = 0.65) {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = volume;
    this.master.connect(this.ctx.destination);
  }

  private now(): number {
    return this.ctx.currentTime;
  }

  private tone(
    freqs: number[],
    start: number,
    dur: number,
    gain = 0.25,
    type: OscillatorType = "sine",
  ): void {
    const fi = 0.004;
    const fo = 0.008;
    for (const freq of freqs) {
      const osc = this.ctx.createOscillator();
      const gn  = this.ctx.createGain();
      osc.connect(gn);
      gn.connect(this.master);
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

  private noise(
    start: number,
    dur: number,
    gain = 0.2,
    filterFreq?: number,
    filterQ = 1.0,
  ): void {
    const ctx = this.ctx;
    const len = Math.ceil(ctx.sampleRate * (dur + 0.06));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0, start);
    gn.gain.linearRampToValueAtTime(gain, start + 0.005);
    gn.gain.setValueAtTime(gain, start + dur - 0.012);
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
    gn.connect(this.master);
    src.start(start);
    src.stop(start + dur + 0.06);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  playOffHook(): void {
    this.noise(this.now() + 0.04, 0.016, 0.45);
  }

  /** Standard PSTN dial tone: 350 Hz + 440 Hz. */
  playDialTone(dur: number): void {
    this.tone([350, 440], this.now(), dur, 0.18);
  }

  playDTMF(digits: string): void {
    let off = 0;
    const t = this.now();
    for (const ch of digits) {
      const freqs = DTMF_MAP[ch];
      if (freqs) {
        this.tone(freqs, t + off, DTMF_ON_SEC, 0.22);
        off += DTMF_ON_SEC + DTMF_GAP_SEC;
      }
    }
  }

  /** Rotary-style pulse dialing: series of line-break clicks per digit. */
  playPulseDial(digits: string): void {
    let off = 0;
    const t = this.now();
    for (const ch of digits) {
      const n = ch === "0" ? 10 : parseInt(ch, 10);
      if (isNaN(n)) continue;
      for (let p = 0; p < n; p++) {
        this.noise(t + off, PULSE_ON_SEC, 0.32);
        off += PULSE_CYCLE_SEC;
      }
      off += PULSE_DIGIT_GAP_SEC;
    }
  }

  /** Standard ringback: 440 Hz + 480 Hz, 2 s on / 4 s off per ring. */
  playRingback(rings: number): void {
    const t = this.now();
    for (let i = 0; i < rings; i++) {
      this.tone([440, 480], t + i * 6.0, 2.0, 0.15);
    }
  }

  /** Busy signal: 480 Hz + 620 Hz, 0.5 s on / 0.5 s off. */
  playBusy(cycles = 6): void {
    const t = this.now();
    for (let i = 0; i < cycles; i++) {
      this.tone([480, 620], t + i * 1.0, 0.5, 0.20);
    }
  }

  /**
   * ANSam tone: 2100 Hz carrier with 180° phase reversals every 450 ms.
   * Phase reversals are implemented as instantaneous gain sign flips, which
   * produce the characteristic ANSam warble (ITU-T V.25 / V.8 §7.2.1).
   * Sidebands at fc ± 15 Hz approximate the 15 Hz envelope modulation.
   */
  playANSam(dur: number): void {
    const ctx = this.ctx;
    const t   = this.now();

    const osc = ctx.createOscillator();
    const gn  = ctx.createGain();
    osc.connect(gn);
    gn.connect(this.master);
    osc.type = "sine";
    osc.frequency.value = 2100;

    const interval = 0.45;
    const steps    = Math.floor(dur / interval);
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(0.22, t + 0.05);
    for (let i = 1; i <= steps; i++) {
      gn.gain.setValueAtTime(i % 2 === 0 ? 0.22 : -0.22, t + i * interval);
    }
    gn.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);

    this.tone([2085, 2115], t, dur, 0.035);
  }

  /**
   * V.8 negotiation: rapid alternation of 1300 Hz (calling modem CI) and
   * 2100 Hz (answering modem) bursts with FSK-like sub-bursts for menu data.
   */
  playNegotiation(dur: number): void {
    const t   = this.now();
    let off   = 0;
    let step  = 0;

    while (off < dur) {
      const isCI  = step % 3 !== 2;
      const base  = isCI ? 1300 : 2100;
      const bLen  = 0.068 + Math.random() * 0.052;

      if (Math.random() < 0.38) {
        const h = bLen / 2;
        this.tone([base - 80], t + off,     h, 0.18);
        this.tone([base + 80], t + off + h, h, 0.18);
      } else {
        this.tone([base], t + off, bLen, 0.19);
      }

      off  += bLen + 0.008 + Math.random() * 0.02;
      step += 1;
      if (off >= dur) break;
    }
  }

  /**
   * Channel equalization training: swept bandpass-filtered noise + pilot tones
   * + choppy AM carriers, producing the "roaring waterfall" that characterises
   * the V.34 / V.90 QAM training sequence.
   */
  playTraining(dur: number): void {
    const ctx = this.ctx;
    const t   = this.now();

    // Swept noise layer
    const len = Math.ceil(ctx.sampleRate * (dur + 0.12));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const dat = buf.getChannelData(0);
    for (let i = 0; i < len; i++) dat[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type  = "bandpass";
    filt.Q.value = 0.8;

    filt.frequency.setValueAtTime(400,  t);
    filt.frequency.linearRampToValueAtTime(2800, t + dur * 0.25);
    filt.frequency.linearRampToValueAtTime(900,  t + dur * 0.45);
    filt.frequency.linearRampToValueAtTime(2500, t + dur * 0.65);
    filt.frequency.linearRampToValueAtTime(1600, t + dur * 0.85);
    filt.frequency.linearRampToValueAtTime(2100, t + dur);

    const noiseGn = ctx.createGain();
    noiseGn.gain.setValueAtTime(0, t);
    noiseGn.gain.linearRampToValueAtTime(0.16, t + 0.09);
    noiseGn.gain.setValueAtTime(0.16, t + dur - 0.07);
    noiseGn.gain.linearRampToValueAtTime(0, t + dur);

    src.connect(filt);
    filt.connect(noiseGn);
    noiseGn.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.12);

    // V.34 pilot tones: constant reference sinusoids spaced 600 Hz apart
    const pilots = [600, 1200, 1800, 2400, 3000];
    pilots.forEach((freq, idx) => {
      const s = t + idx * 0.11;
      const d = dur - idx * 0.11;
      if (d > 0.15) this.tone([freq], s, d, 0.028);
    });

    // AM-textured carriers: choppy gain envelope mimics QAM symbol bursts
    const segDur  = dur / 3;
    const cFreqs  = [1800, 2400, 1200];
    cFreqs.forEach((cf, idx) => {
      const s0  = t + idx * segDur;
      const osc = ctx.createOscillator();
      const amGn = ctx.createGain();
      osc.connect(amGn);
      amGn.connect(this.master);
      osc.type = "sine";
      osc.frequency.value = cf;
      const steps = Math.floor(segDur * 20);
      for (let s = 0; s < steps; s++) {
        amGn.gain.setValueAtTime(
          0.022 + Math.random() * 0.052,
          s0 + s * (segDur / steps),
        );
      }
      amGn.gain.linearRampToValueAtTime(0, s0 + segDur);
      osc.start(s0);
      osc.stop(s0 + segDur + 0.01);
    });
  }

  /** Brief click: the carrier locking onto the line. */
  playConnected(): void {
    this.noise(this.now(), 0.012, 0.38);
  }

  /** Three descending tones — classic NO CARRIER error indicator. */
  playNoCarrier(): void {
    const t = this.now();
    this.tone([1400], t,        0.15, 0.28);
    this.tone([1100], t + 0.18, 0.15, 0.28);
    this.tone([820],  t + 0.36, 0.32, 0.28);
  }

  stop(): void {
    try { this.ctx.close(); } catch { /* ignore */ }
  }
}
