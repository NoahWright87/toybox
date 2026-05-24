// Minimal SF2 2.04 soundfont parser for melodic playback. No external deps.
// Source: TimGM6mb.sf2 — MIT license (Tim Brechbill, 2004)
// SHA-256: c5378b62028c920cb11e4803327983fee2f2cdff5dc89c708e39da417e51c854

// Generator opcodes used for basic melodic playback
const GEN_KEY_RANGE    = 43;  // lo/hi byte: MIDI key range
const GEN_VEL_RANGE    = 44;  // lo/hi byte: velocity range
const GEN_ATTENUATION  = 48;  // signed16, centibels (10 = –1 dB)
const GEN_SAMPLE_ID    = 53;  // instrument zone only: index into shdr
const GEN_SAMPLE_MODES = 54;  // bit 0 = loop while held
const GEN_SCALE_TUNING = 56;  // signed16, cents per semitone (default 100)
const GEN_INSTRUMENT   = 41;  // preset zone only: index into inst
const GEN_ROOT_KEY     = 58;  // signed16, –1 = use sample's originalPitch

// sampleModes values
const LOOP_CONTINUES = 1;
const LOOP_UNTIL_OFF = 3;

interface SampleHeader {
  start: number; end: number;
  loopStart: number; loopEnd: number;
  sampleRate: number;
  originalPitch: number;
  pitchCorrection: number; // cents
  sampleType: number;      // 0 = EOS terminal, 1 = mono, 2 = right, 4 = left, 32768 = ROM
}

interface Zone {
  keyLo: number; keyHi: number;
  velLo: number; velHi: number;
  sampleId: number;
  attenuation: number;   // centibels
  loopMode: number;
  scaleTuning: number;   // cents/key
  overrideRootKey: number; // –1 means use originalPitch
}

interface LoadedFont {
  sampleData: Int16Array;
  samples: SampleHeader[];
  programs: Map<number, Zone[]>; // GM program 0–127
}

let _font: LoadedFont | null = null;
let _loading: Promise<LoadedFont> | null = null;

// Per-sample AudioBuffer cache (keyed by sample index)
const _bufCache = new Map<number, AudioBuffer>();
let _bufCacheCtx: AudioContext | null = null;

export function isSoundFontReady(): boolean { return _font !== null; }

export async function loadSoundFont(url: string): Promise<void> {
  if (_font) return;
  if (!_loading) _loading = fetchAndParse(url);
  _font = await _loading;
}

async function fetchAndParse(url: string): Promise<LoadedFont> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SF2 fetch failed: ${res.status}`);
  return parse(await res.arrayBuffer());
}

// ── RIFF helpers ──────────────────────────────────────────────────────────────

function cc4(v: DataView, p: number): string {
  return String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3));
}

function findChunk(v: DataView, offset: number, size: number, name: string): { at: number; sz: number } | null {
  const end = offset + size;
  let p = offset;
  while (p + 8 <= end) {
    const t = cc4(v, p);
    const s = v.getUint32(p + 4, true);
    if (t === name) return { at: p + 8, sz: s };
    p += 8 + s + (s & 1); // RIFF pads to even boundary
  }
  return null;
}

function findList(v: DataView, offset: number, size: number, inner: string): { at: number; sz: number } | null {
  const end = offset + size;
  let p = offset;
  while (p + 12 <= end) {
    const t = cc4(v, p);
    const s = v.getUint32(p + 4, true);
    const it = cc4(v, p + 8);
    if (t === 'LIST' && it === inner) return { at: p + 12, sz: s - 4 };
    p += 8 + s + (s & 1);
  }
  return null;
}

// ── Parser ────────────────────────────────────────────────────────────────────

type GenRecord = { oper: number; lo: number; hi: number; val: number };

function readGens(v: DataView, offset: number, count: number): GenRecord[] {
  const out: GenRecord[] = [];
  for (let i = 0; i < count; i++) {
    const b = offset + i * 4;
    out.push({ oper: v.getUint16(b, true), lo: v.getUint8(b + 2), hi: v.getUint8(b + 3), val: v.getInt16(b + 2, true) });
  }
  return out;
}

function parse(buffer: ArrayBuffer): LoadedFont {
  const v = new DataView(buffer);

  if (cc4(v, 0) !== 'RIFF' || cc4(v, 8) !== 'sfbk')
    throw new Error('Not a valid SF2 file');

  const bodyAt = 12;
  const bodyLen = buffer.byteLength - 12;

  const sdta = findList(v, bodyAt, bodyLen, 'sdta');
  const pdta = findList(v, bodyAt, bodyLen, 'pdta');
  if (!sdta || !pdta) throw new Error('SF2 missing sdta or pdta LIST chunk');

  const req = (name: string, parent: { at: number; sz: number }) => {
    const c = findChunk(v, parent.at, parent.sz, name);
    if (!c) throw new Error(`SF2 missing required chunk: ${name}`);
    return c;
  };

  // smpl: 16-bit PCM. Copy into a new typed array (avoids alignment issues).
  const smpl = req('smpl', sdta);
  const sampleData = new Int16Array(smpl.sz >> 1);
  for (let i = 0; i < sampleData.length; i++)
    sampleData[i] = v.getInt16(smpl.at + i * 2, true);

  const phdrCk = req('phdr', pdta);
  const pbagCk = req('pbag', pdta);
  const pgenCk = req('pgen', pdta);
  const instCk = req('inst', pdta);
  const ibagCk = req('ibag', pdta);
  const igenCk = req('igen', pdta);
  const shdrCk = req('shdr', pdta);

  // shdr: 46 bytes each — sample headers
  const shdrN = Math.floor(shdrCk.sz / 46);
  const samples: SampleHeader[] = [];
  for (let i = 0; i < shdrN; i++) {
    const b = shdrCk.at + i * 46;
    samples.push({
      start:           v.getUint32(b + 20, true),
      end:             v.getUint32(b + 24, true),
      loopStart:       v.getUint32(b + 28, true),
      loopEnd:         v.getUint32(b + 32, true),
      sampleRate:      v.getUint32(b + 36, true),
      originalPitch:   v.getUint8(b + 40),
      pitchCorrection: v.getInt8(b + 41),
      sampleType:      v.getUint16(b + 44, true),
    });
  }

  // ibag: 4 bytes each — instrument bag genNdx values
  const ibagN = Math.floor(ibagCk.sz / 4);
  const ibag: number[] = [];
  for (let i = 0; i < ibagN; i++) ibag.push(v.getUint16(ibagCk.at + i * 4, true));

  // igen: 4 bytes each — instrument generators
  const igenN  = Math.floor(igenCk.sz / 4);
  const igen = readGens(v, igenCk.at, igenN);

  // inst: 22 bytes each — instrument headers (name[20] + bagIdx[2])
  const instN = Math.floor(instCk.sz / 22);
  const instBagIdx: number[] = [];
  for (let i = 0; i < instN; i++)
    instBagIdx.push(v.getUint16(instCk.at + i * 22 + 20, true));

  function buildZones(instIdx: number): Zone[] {
    if (instIdx + 1 >= instN) return [];
    const bagS = instBagIdx[instIdx];
    const bagE = instBagIdx[instIdx + 1];

    // Default values (from global zone, if present)
    let gKeyLo = 0, gKeyHi = 127, gVelLo = 0, gVelHi = 127;
    let gAtten = 0, gLoop = 0, gScale = 100, gRoot = -1;
    let firstIsSample = false;

    if (bagS < bagE) {
      const gS = ibag[bagS] ?? 0;
      const gE = ibag[bagS + 1] ?? igenN;
      for (let g = gS; g < gE; g++) {
        const { oper, lo, hi, val } = igen[g];
        if (oper === GEN_SAMPLE_ID) { firstIsSample = true; break; }
        switch (oper) {
          case GEN_KEY_RANGE:    gKeyLo = lo; gKeyHi = hi; break;
          case GEN_VEL_RANGE:    gVelLo = lo; gVelHi = hi; break;
          case GEN_ATTENUATION:  gAtten = val; break;
          case GEN_SAMPLE_MODES: gLoop  = val & 3; break;
          case GEN_SCALE_TUNING: gScale = val; break;
          case GEN_ROOT_KEY:     gRoot  = (val >= 0 && val <= 127) ? val : -1; break;
        }
      }
    }

    const start = firstIsSample ? bagS : bagS + 1;
    const zones: Zone[] = [];

    for (let b = start; b < bagE; b++) {
      const gS = ibag[b] ?? 0;
      const gE = ibag[b + 1] ?? igenN;

      let keyLo = gKeyLo, keyHi = gKeyHi, velLo = gVelLo, velHi = gVelHi;
      let atten = gAtten, loop = gLoop, scale = gScale, root = gRoot;
      let sampleId = -1;

      for (let g = gS; g < gE; g++) {
        const { oper, lo, hi, val } = igen[g];
        switch (oper) {
          case GEN_KEY_RANGE:    keyLo = lo; keyHi = hi; break;
          case GEN_VEL_RANGE:    velLo = lo; velHi = hi; break;
          case GEN_ATTENUATION:  atten = val; break;
          case GEN_SAMPLE_MODES: loop  = val & 3; break;
          case GEN_SCALE_TUNING: scale = val; break;
          case GEN_ROOT_KEY:     root  = (val >= 0 && val <= 127) ? val : -1; break;
          case GEN_SAMPLE_ID:    sampleId = val & 0xffff; break;
        }
      }

      if (sampleId >= 0)
        zones.push({ keyLo, keyHi, velLo, velHi, sampleId, attenuation: atten, loopMode: loop, scaleTuning: scale, overrideRootKey: root });
    }

    return zones;
  }

  // pbag & pgen
  const pbagN = Math.floor(pbagCk.sz / 4);
  const pbag: number[] = [];
  for (let i = 0; i < pbagN; i++) pbag.push(v.getUint16(pbagCk.at + i * 4, true));

  const pgenN = Math.floor(pgenCk.sz / 4);
  const pgen  = readGens(v, pgenCk.at, pgenN);

  // phdr: 38 bytes each
  const phdrN = Math.floor(phdrCk.sz / 38);
  const programs = new Map<number, Zone[]>();

  for (let i = 0; i < phdrN - 1; i++) {
    const b    = phdrCk.at + i * 38;
    const prog = v.getUint16(b + 20, true);
    const bank = v.getUint16(b + 22, true);
    const bagS = v.getUint16(b + 24, true);
    const bagE = v.getUint16(phdrCk.at + (i + 1) * 38 + 24, true);

    if (bank !== 0) continue; // GM bank 0 only

    const zones: Zone[] = [];
    for (let pb = bagS; pb < bagE; pb++) {
      const gS = pbag[pb] ?? 0;
      const gE = pbag[pb + 1] ?? pgenN;
      for (let g = gS; g < gE; g++) {
        if (pgen[g].oper === GEN_INSTRUMENT) {
          zones.push(...buildZones(pgen[g].val & 0xffff));
          break;
        }
      }
    }

    if (zones.length > 0) programs.set(prog, zones);
  }

  return { sampleData, samples, programs };
}

// ── Playback ──────────────────────────────────────────────────────────────────

function getBuffer(sampleIdx: number, ctx: AudioContext): AudioBuffer | null {
  if (_bufCacheCtx !== ctx) { _bufCache.clear(); _bufCacheCtx = ctx; }

  const hit = _bufCache.get(sampleIdx);
  if (hit) return hit;

  if (!_font) return null;
  const sh = _font.samples[sampleIdx];
  if (!sh || sh.sampleType === 0 || sh.start >= sh.end) return null;

  const len = sh.end - sh.start;
  const ab  = ctx.createBuffer(1, len, sh.sampleRate);
  const ch  = ab.getChannelData(0);
  const src = _font.sampleData;
  for (let i = 0; i < len; i++) ch[i] = (src[sh.start + i] ?? 0) / 32768;

  _bufCache.set(sampleIdx, ab);
  return ab;
}

export function playSfNote(
  program: number,
  pitch: number,
  velocity: number,
  durationSec: number,
  ctx: AudioContext,
  when: number,
  gain: number,
): boolean {
  if (!_font) return false;

  const zones = _font.programs.get(program);
  if (!zones) return false;

  let zone: Zone | undefined;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (pitch >= z.keyLo && pitch <= z.keyHi && velocity >= z.velLo && velocity <= z.velHi) {
      zone = z;
      break;
    }
  }
  if (!zone) return false;

  const sh = _font.samples[zone.sampleId];
  if (!sh || sh.sampleType === 0 || sh.start >= sh.end) return false;

  const ab = getBuffer(zone.sampleId, ctx);
  if (!ab) return false;

  const source = ctx.createBufferSource();
  source.buffer = ab;

  // Pitch shift via playbackRate
  const rootKey = zone.overrideRootKey >= 0 ? zone.overrideRootKey : sh.originalPitch;
  const cents   = (pitch - rootKey) * zone.scaleTuning + sh.pitchCorrection;
  source.playbackRate.value = Math.pow(2, cents / 1200);

  // Loop
  const looping = zone.loopMode === LOOP_CONTINUES || zone.loopMode === LOOP_UNTIL_OFF;
  if (looping) {
    const loopLen = sh.loopEnd - sh.loopStart;
    if (loopLen > 0) {
      source.loop      = true;
      source.loopStart = (sh.loopStart - sh.start) / sh.sampleRate;
      source.loopEnd   = (sh.loopEnd   - sh.start) / sh.sampleRate;
    }
  }

  // Volume with SF2 attenuation (centibels: 10 cb = –1 dB)
  const attDb  = zone.attenuation / 10;
  const attLin = Math.pow(10, -attDb / 20);
  const vol    = (velocity / 127) * 0.7 * Math.max(0, Math.min(1, gain)) * attLin;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(vol, when);

  // Fade out at note-off
  const relDur = Math.min(0.08, durationSec * 0.15);
  gainNode.gain.setValueAtTime(vol, when + durationSec);
  gainNode.gain.linearRampToValueAtTime(0, when + durationSec + relDur);
  source.stop(when + durationSec + relDur + 0.01);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start(when);

  return true;
}
