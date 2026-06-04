import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import "./SoundRecorder.css";

// Find Sound Recorder's FS folder by its known path
function getSoundDirId(): string | undefined {
  const node = fsStore.getNodeByPath("C:\\Programs\\Accessories\\Sound Recorder");
  return node?.kind === "folder" ? node.id : undefined;
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────────

const IDB_NAME = "ns97_sounds";
const IDB_STORE = "files";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE))
        req.result.createObjectStore(IDB_STORE, { keyPath: "name" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(name: string, samples: Float32Array, sr: number): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ name, sr, buf: samples.slice().buffer });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbLoad(name: string): Promise<{ samples: Float32Array; sr: number } | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(name);
    req.onsuccess = () => {
      db.close();
      if (!req.result) { resolve(null); return; }
      const r = req.result as { name: string; sr: number; buf: ArrayBuffer };
      resolve({ samples: new Float32Array(r.buf), sr: r.sr });
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function idbListNames(): Promise<string[]> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAllKeys();
    req.onsuccess = () => { db.close(); resolve(req.result as string[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ── Draft (auto-save) helpers ─────────────────────────────────────────────────

const DRAFT_KEY    = "__draft__";
const LS_DRAFT_TS  = "ns97_sound_draft_ts";

function saveDraftNow(samples: Float32Array, sr: number): void {
  if (samples.length === 0) return;
  localStorage.setItem(LS_DRAFT_TS, Date.now().toString());
  idbSave(DRAFT_KEY, samples, sr).catch(() => {});
}

async function clearDraft(): Promise<void> {
  localStorage.removeItem(LS_DRAFT_TS);
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(DRAFT_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function draftTimestamp(): string {
  const raw = localStorage.getItem(LS_DRAFT_TS);
  if (!raw) return "unknown time";
  const d = new Date(parseInt(raw, 10));
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── WAV export: 8-bit, 8 kHz, mono (authentic lo-fi) ─────────────────────────

function encodeWav(samples: Float32Array, inputSr: number): ArrayBuffer {
  const outSr = 8000;
  const ratio = inputSr / outSr;
  const outLen = Math.max(1, Math.floor(samples.length / ratio));
  const pcm = new Uint8Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = samples[Math.floor(i * ratio)] ?? 0;
    pcm[i] = Math.max(0, Math.min(255, Math.round((s + 1) * 127.5)));
  }
  const buf = new ArrayBuffer(44 + outLen);
  const v = new DataView(buf);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + outLen, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, outSr, true); v.setUint32(28, outSr, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  ws(36, "data"); v.setUint32(40, outLen, true);
  new Uint8Array(buf, 44).set(pcm);
  return buf;
}

function downloadWav(buf: ArrayBuffer, filename: string): void {
  const blob = new Blob([buf], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Effects (all-or-nothing on full buffer) ───────────────────────────────────

function runEffect(samples: Float32Array, sr: number, fx: string): Float32Array {
  if (samples.length === 0) return samples;
  switch (fx) {
    case "speed-up": {
      const out = new Float32Array(Math.floor(samples.length / 2));
      for (let i = 0; i < out.length; i++) out[i] = samples[i * 2];
      return out;
    }
    case "slow-down": {
      const out = new Float32Array(samples.length * 2);
      for (let i = 0; i < samples.length; i++) { out[i * 2] = samples[i]; out[i * 2 + 1] = samples[i]; }
      return out;
    }
    case "vol-up": {
      const out = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) out[i] = samples[i] * 1.5;
      return out;
    }
    case "vol-down": {
      const out = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) out[i] = samples[i] * 0.5;
      return out;
    }
    case "reverse": {
      const out = new Float32Array(samples);
      out.reverse();
      return out;
    }
    case "distortion": {
      const out = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) out[i] = Math.max(-1, Math.min(1, samples[i] * 4));
      return out;
    }
    case "normalize": {
      let peak = 0;
      for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
      if (peak < 1e-6) return samples;
      const out = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) out[i] = samples[i] / peak;
      return out;
    }
    case "echo": {
      const delay = Math.round(sr * 0.2);
      const out = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        out[i] = samples[i] + (i >= delay ? samples[i - delay] * 0.5 : 0);
      }
      return out;
    }
    case "fade-in": {
      const out = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) out[i] = samples[i] * (i / samples.length);
      return out;
    }
    case "fade-out": {
      const out = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) out[i] = samples[i] * (1 - i / samples.length);
      return out;
    }
    default: return samples;
  }
}

// ── Time formatting ───────────────────────────────────────────────────────────

function fmtTime(samplePos: number, sr: number): string {
  const secs = sr > 0 ? samplePos / sr : 0;
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  const ds = Math.floor((secs % 1) * 10).toString();
  return `${m}:${s}.${ds}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface SoundRecorderProps {
  fileName?: string;
  fileId?: string;       // FS file to write WAV data URL to when saving (for EGO/SOUNDS)
  fallbackUrl?: string;  // fetch from here if IDB has no audio (for bundled game sounds)
  onQuit?: () => void;
  onFileSaved?: (name: string) => void;
}

export default function SoundRecorder({
  fileName: initFileName,
  fileId: initFileId,
  fallbackUrl: initFallbackUrl,
  onQuit,
  onFileSaved,
}: SoundRecorderProps = {}) {

  // ── Audio refs (mutated directly for real-time performance) ───────────────
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const samplesRef     = useRef<Float32Array>(new Float32Array(0));
  const srRef          = useRef<number>(44100); // sample rate
  const playheadRef    = useRef<number>(0);     // position in samples
  const isPlayingRef   = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const priorLenRef    = useRef<number>(0);     // samples.length before recording started
  const recWriteRef    = useRef<number>(0);     // write position during recording

  // Playback refs
  const pbSourceRef    = useRef<AudioBufferSourceNode | null>(null);
  const pbStartCtxRef  = useRef<number>(0);  // audioCtx.currentTime when play started
  const pbStartSmpRef  = useRef<number>(0);  // sample index when play started

  // Recording refs
  const micStreamRef   = useRef<MediaStream | null>(null);
  const micSrcRef      = useRef<MediaStreamAudioSourceNode | null>(null);
  const spnRef         = useRef<ScriptProcessorNode | null>(null);
  const silencerRef    = useRef<GainNode | null>(null);

  // UI refs
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);
  const rwdTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const fwdTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const fileNameRef    = useRef<string>(initFileName ?? "Untitled.wav");
  const fileIdRef      = useRef<string | undefined>(initFileId);

  // ── React state (only for UI rendering) ──────────────────────────────────
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasSamples,  setHasSamples]  = useState(false);
  const [fileName,    setFileName]    = useState(initFileName ?? "Untitled.wav");
  const [statusMsg,   setStatusMsg]   = useState("Ready");
  const [displayPos,  setDisplayPos]  = useState(0);
  const [displayLen,  setDisplayLen]  = useState(0);
  const [showOpenDlg,    setShowOpenDlg]    = useState(false);
  const [openDlgFiles,   setOpenDlgFiles]   = useState<string[]>([]);
  const [showSaveDlg,    setShowSaveDlg]    = useState(false);
  const [saveDlgName,    setSaveDlgName]    = useState("Untitled.wav");
  const [showRestoreDlg, setShowRestoreDlg] = useState(false);
  const [draftTimeStr,   setDraftTimeStr]   = useState("");

  // Keep fileNameRef in sync so menu closures don't go stale
  useEffect(() => { fileNameRef.current = fileName; }, [fileName]);

  // ── AudioContext ──────────────────────────────────────────────────────────

  function ensureCtx(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      srRef.current = audioCtxRef.current.sampleRate;
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }

  // ── Canvas drawing ────────────────────────────────────────────────────────

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx2d.fillStyle = "#000000";
    ctx2d.fillRect(0, 0, W, H);

    const samples = samplesRef.current;

    if (samples.length === 0) {
      ctx2d.strokeStyle = "#003300";
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(0, H / 2);
      ctx2d.lineTo(W, H / 2);
      ctx2d.stroke();
    } else {
      const samplesPerPx = samples.length / W;
      ctx2d.strokeStyle = "#00bb00";
      ctx2d.lineWidth = 1;
      for (let x = 0; x < W; x++) {
        const s0 = Math.floor(x * samplesPerPx);
        const s1 = Math.min(samples.length - 1, Math.floor((x + 1) * samplesPerPx));
        let lo = 1, hi = -1;
        for (let i = s0; i <= s1; i++) {
          if (samples[i] < lo) lo = samples[i];
          if (samples[i] > hi) hi = samples[i];
        }
        const yHi = Math.round((1 - (hi + 1) * 0.5) * H);
        const yLo = Math.round((1 - (lo + 1) * 0.5) * H);
        ctx2d.beginPath();
        ctx2d.moveTo(x + 0.5, yHi);
        ctx2d.lineTo(x + 0.5, yLo + 1);
        ctx2d.stroke();
      }

      // Playhead
      const phX = Math.round((playheadRef.current / samples.length) * W);
      ctx2d.strokeStyle = "#ffffff";
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(phX + 0.5, 0);
      ctx2d.lineTo(phX + 0.5, H);
      ctx2d.stroke();
    }
  }, []);

  // ── RAF loop ──────────────────────────────────────────────────────────────

  const stopPlay = useCallback(() => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;
    setIsPlaying(false);
    try { pbSourceRef.current?.stop(); } catch { /* already stopped */ }
    pbSourceRef.current = null;
    setStatusMsg("Stopped");
  }, []);

  const startRAF = useCallback(() => {
    const tick = () => {
      if (isPlayingRef.current && audioCtxRef.current) {
        const elapsed = (audioCtxRef.current.currentTime - pbStartCtxRef.current) * srRef.current;
        playheadRef.current = pbStartSmpRef.current + elapsed;
        if (playheadRef.current >= samplesRef.current.length) {
          playheadRef.current = samplesRef.current.length;
          stopPlay();
        }
      } else if (isRecordingRef.current) {
        playheadRef.current = recWriteRef.current;
      }
      setDisplayPos(Math.round(playheadRef.current));
      setDisplayLen(samplesRef.current.length);
      drawCanvas();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [drawCanvas, stopPlay]);

  // ── Mount / unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    startRAF();
    return () => {
      cancelAnimationFrame(rafRef.current);
      try { pbSourceRef.current?.stop(); } catch { /* ok */ }
      spnRef.current?.disconnect();
      micSrcRef.current?.disconnect();
      silencerRef.current?.disconnect();
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      if (rwdTimerRef.current) clearInterval(rwdTimerRef.current);
      if (fwdTimerRef.current) clearInterval(fwdTimerRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [startRAF]);

  // ── Canvas resize ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    drawCanvas();
    const obs = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drawCanvas();
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [drawCanvas]);

  // ── Load file on mount (or check for draft) ──────────────────────────────

  useEffect(() => {
    if (initFileName) {
      // Opening a saved file — try IDB first, then fall back to bundled URL
      idbLoad(initFileName).then(result => {
        if (result) {
          samplesRef.current = result.samples;
          srRef.current = result.sr;
          playheadRef.current = 0;
          setHasSamples(true);
          setStatusMsg("File loaded");
        } else if (initFallbackUrl) {
          // Not in IDB yet — load from the bundled game asset
          fetch(initFallbackUrl)
            .then(r => r.arrayBuffer())
            .then(buf => ensureCtx().decodeAudioData(buf))
            .then(decoded => {
              const mono = new Float32Array(decoded.length);
              for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
                const d = decoded.getChannelData(ch);
                for (let i = 0; i < decoded.length; i++) mono[i] += d[i];
              }
              if (decoded.numberOfChannels > 1) {
                for (let i = 0; i < mono.length; i++) mono[i] /= decoded.numberOfChannels;
              }
              samplesRef.current = mono;
              srRef.current = decoded.sampleRate;
              playheadRef.current = 0;
              setHasSamples(true);
              setStatusMsg("File loaded");
              drawCanvas();
            })
            .catch(() => setStatusMsg("Could not load file"));
        }
      }).catch(() => setStatusMsg("Could not load file"));
    } else {
      // Fresh session — check for an auto-saved draft
      const ts = localStorage.getItem(LS_DRAFT_TS);
      if (ts) {
        setDraftTimeStr(draftTimestamp());
        setShowRestoreDlg(true);
      }
    }
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save draft every 5 seconds ──────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      if (samplesRef.current.length > 0) {
        saveDraftNow(samplesRef.current, srRef.current);
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Playback ──────────────────────────────────────────────────────────────

  function startPlay() {
    if (samplesRef.current.length === 0) return;
    const ctx = ensureCtx();
    const startSmp = Math.min(playheadRef.current, samplesRef.current.length - 1);
    const slice = samplesRef.current.subarray(startSmp);
    const ab = ctx.createBuffer(1, slice.length, srRef.current);
    ab.getChannelData(0).set(slice);
    const source = ctx.createBufferSource();
    source.buffer = ab;
    source.connect(ctx.destination);
    source.onended = () => { if (isPlayingRef.current) stopPlay(); };
    pbSourceRef.current = source;
    pbStartCtxRef.current = ctx.currentTime;
    pbStartSmpRef.current = startSmp;
    isPlayingRef.current = true;
    setIsPlaying(true);
    setStatusMsg("Playing...");
    source.start();
  }

  function togglePlayPause() {
    if (isPlayingRef.current) { stopPlay(); } else { startPlay(); }
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  function stopRecord() {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    const finalLen = Math.max(recWriteRef.current, priorLenRef.current);
    if (samplesRef.current.length > finalLen) {
      samplesRef.current = samplesRef.current.slice(0, finalLen);
    }
    playheadRef.current = recWriteRef.current;

    spnRef.current?.disconnect();
    micSrcRef.current?.disconnect();
    silencerRef.current?.disconnect();
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    spnRef.current = null; micSrcRef.current = null;
    silencerRef.current = null; micStreamRef.current = null;

    setIsRecording(false);
    setHasSamples(samplesRef.current.length > 0);
    setStatusMsg("Stopped");
    saveDraftNow(samplesRef.current, srRef.current);
  }

  async function startRecord() {
    if (isPlayingRef.current) stopPlay();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = ensureCtx();
      micStreamRef.current = stream;
      const src = ctx.createMediaStreamSource(stream);
      micSrcRef.current = src;
      const spn = ctx.createScriptProcessor(4096, 1, 1);
      spnRef.current = spn;
      // GainNode at 0 prevents microphone feedback through speakers
      const silence = ctx.createGain();
      silence.gain.value = 0;
      silencerRef.current = silence;
      src.connect(spn);
      spn.connect(silence);
      silence.connect(ctx.destination);

      priorLenRef.current = samplesRef.current.length;
      recWriteRef.current = Math.round(playheadRef.current);
      isRecordingRef.current = true;
      setIsRecording(true);
      setHasSamples(true);
      setStatusMsg("Recording...");

      spn.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!isRecordingRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        const writePos = recWriteRef.current;
        const needed = writePos + input.length;
        if (needed > samplesRef.current.length) {
          const newLen = Math.max(needed, samplesRef.current.length + srRef.current * 2);
          const grown = new Float32Array(newLen);
          grown.set(samplesRef.current);
          samplesRef.current = grown;
        }
        samplesRef.current.set(input, writePos);
        recWriteRef.current += input.length;
      };
    } catch {
      setStatusMsg("Mic access denied");
    }
  }

  function toggleRecord() {
    if (isRecordingRef.current) { stopRecord(); } else { startRecord().catch(() => {}); }
  }

  // ── Scrub (hold to move at ~4× speed) ────────────────────────────────────

  const scrubAmount = () => Math.round(srRef.current * 4 * 0.04); // 4× at 25 fps

  function startScrubRwd() {
    if (isPlayingRef.current) stopPlay();
    if (isRecordingRef.current) stopRecord();
    if (rwdTimerRef.current) return;
    rwdTimerRef.current = setInterval(() => {
      playheadRef.current = Math.max(0, playheadRef.current - scrubAmount());
      if (playheadRef.current === 0) stopScrubRwd();
    }, 40);
  }
  function stopScrubRwd() {
    if (rwdTimerRef.current) { clearInterval(rwdTimerRef.current); rwdTimerRef.current = null; }
  }

  function startScrubFwd() {
    if (isPlayingRef.current) stopPlay();
    if (isRecordingRef.current) stopRecord();
    if (fwdTimerRef.current) return;
    fwdTimerRef.current = setInterval(() => {
      const maxPos = samplesRef.current.length;
      playheadRef.current = Math.min(maxPos, playheadRef.current + scrubAmount());
      if (playheadRef.current >= maxPos) stopScrubFwd();
    }, 40);
  }
  function stopScrubFwd() {
    if (fwdTimerRef.current) { clearInterval(fwdTimerRef.current); fwdTimerRef.current = null; }
  }

  // ── Canvas click — reposition playhead ───────────────────────────────────

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || samplesRef.current.length === 0) return;
    if (isPlayingRef.current) stopPlay();
    const rect = canvas.getBoundingClientRect();
    playheadRef.current = Math.round(((e.clientX - rect.left) / rect.width) * samplesRef.current.length);
  }

  // ── File operations ───────────────────────────────────────────────────────

  function handleNewFile() {
    if (isPlayingRef.current) stopPlay();
    if (isRecordingRef.current) stopRecord();
    samplesRef.current = new Float32Array(0);
    playheadRef.current = 0;
    setFileName("Untitled.wav");
    fileNameRef.current = "Untitled.wav";
    setHasSamples(false);
    setStatusMsg("New file");
    drawCanvas();
    clearDraft().catch(() => {});
  }

  function handleOpenFile() {
    const soundDirId = getSoundDirId();
    if (soundDirId) {
      // List .wav files registered in the FS
      const wavNames = fsStore.getChildren(soundDirId)
        .filter((n) => n.kind === "file" && (n as { fileType: string }).fileType === "wav")
        .map((n) => n.name);
      setOpenDlgFiles(wavNames);
      setShowOpenDlg(true);
    } else {
      // Fallback: query IDB directly (no FS folder found)
      idbListNames().then(names => {
        setOpenDlgFiles(names.filter(n => !n.startsWith("__")));
        setShowOpenDlg(true);
      }).catch(() => setStatusMsg("Error reading saved files"));
    }
  }

  function handleOpenFileSelect(name: string) {
    setShowOpenDlg(false);
    idbLoad(name).then(result => {
      if (!result) { setStatusMsg("File not found"); return; }
      if (isPlayingRef.current) stopPlay();
      if (isRecordingRef.current) stopRecord();
      samplesRef.current = result.samples;
      srRef.current = result.sr;
      playheadRef.current = 0;
      setFileName(name);
      fileNameRef.current = name;
      setHasSamples(true);
      setStatusMsg("File loaded");
      drawCanvas();
    }).catch(() => setStatusMsg("Error loading file"));
  }

  function handleImportFile() {
    importInputRef.current?.click();
  }

  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.arrayBuffer().then(rawBuf => {
      const ctx = ensureCtx();
      return ctx.decodeAudioData(rawBuf);
    }).then(decoded => {
      // Mix down to mono
      const mono = new Float32Array(decoded.length);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const chData = decoded.getChannelData(ch);
        for (let i = 0; i < decoded.length; i++) mono[i] += chData[i];
      }
      if (decoded.numberOfChannels > 1) {
        for (let i = 0; i < mono.length; i++) mono[i] /= decoded.numberOfChannels;
      }
      if (isPlayingRef.current) stopPlay();
      if (isRecordingRef.current) stopRecord();
      samplesRef.current = mono;
      srRef.current = decoded.sampleRate;
      playheadRef.current = 0;
      const name = file.name.replace(/\.[^.]+$/, ".wav");
      setFileName(name);
      fileNameRef.current = name;
      setHasSamples(true);
      setStatusMsg("File imported");
      drawCanvas();
      saveDraftNow(mono, decoded.sampleRate);
    }).catch(() => setStatusMsg("Error importing file"));
    if (importInputRef.current) importInputRef.current.value = "";
  }

  function handleSaveFile() {
    setSaveDlgName(fileNameRef.current);
    setShowSaveDlg(true);
  }

  function confirmSave() {
    const name = saveDlgName.trim();
    if (!name) return;
    const saveName = name.endsWith(".wav") ? name : `${name}.wav`;
    setShowSaveDlg(false);
    idbSave(saveName, samplesRef.current, srRef.current).then(() => {
      if (fileIdRef.current) {
        // Saving a game asset override — write WAV data URL to the FS file
        const wavBuf = encodeWav(samplesRef.current, srRef.current);
        const uint8 = new Uint8Array(wavBuf);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        fsStore.writeFile(fileIdRef.current, `data:audio/wav;base64,${btoa(binary)}`);
        setFileName(saveName);
        fileNameRef.current = saveName;
        setStatusMsg("Saved to system");
        clearDraft().catch(() => {});
      } else {
        // Normal save to Sound Recorder library
        const soundDirId = getSoundDirId();
        if (soundDirId) {
          fsStore.ensureFile(soundDirId, saveName, { fileType: "wav", appId: "sound-recorder" });
        }
        setFileName(saveName);
        fileNameRef.current = saveName;
        setStatusMsg("Saved");
        onFileSaved?.(saveName);
        downloadWav(encodeWav(samplesRef.current, srRef.current), saveName);
        clearDraft().catch(() => {});
      }
    }).catch(() => setStatusMsg("Error saving"));
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  function applyFx(fx: string) {
    if (samplesRef.current.length === 0) return;
    if (isPlayingRef.current) stopPlay();
    if (isRecordingRef.current) stopRecord();
    samplesRef.current = runEffect(samplesRef.current, srRef.current, fx);
    playheadRef.current = 0;
    setStatusMsg(`Applied: ${fx}`);
    drawCanvas();
    saveDraftNow(samplesRef.current, srRef.current);
  }

  // ── Draft restore ─────────────────────────────────────────────────────────

  function handleRestoreDraft() {
    setShowRestoreDlg(false);
    idbLoad(DRAFT_KEY).then(result => {
      if (!result) { setStatusMsg("Draft not found"); return; }
      samplesRef.current = result.samples;
      srRef.current = result.sr;
      playheadRef.current = 0;
      setHasSamples(true);
      setStatusMsg("Session restored");
      drawCanvas();
    }).catch(() => setStatusMsg("Could not restore draft"));
  }

  function handleDiscardDraft() {
    setShowRestoreDlg(false);
    clearDraft().catch(() => {});
    setStatusMsg("Ready");
  }

  // ── Menus ─────────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "File",
      items: [
        { label: "New File",    onClick: handleNewFile },
        { separator: true },
        { label: "Open File",   onClick: handleOpenFile },
        { label: "Import File", onClick: handleImportFile },
        { separator: true },
        { label: "Save File",   onClick: handleSaveFile, disabled: !hasSamples },
        { separator: true },
        { label: "Exit",        onClick: onQuit },
      ],
    },
    {
      label: "Effects",
      items: [
        { label: "Speed ×2",    onClick: () => applyFx("speed-up"),   disabled: !hasSamples },
        { label: "Speed ÷2",    onClick: () => applyFx("slow-down"),  disabled: !hasSamples },
        { separator: true },
        { label: "Volume Up",   onClick: () => applyFx("vol-up"),     disabled: !hasSamples },
        { label: "Volume Down", onClick: () => applyFx("vol-down"),   disabled: !hasSamples },
        { separator: true },
        { label: "Reverse",     onClick: () => applyFx("reverse"),    disabled: !hasSamples },
        { label: "Distortion",  onClick: () => applyFx("distortion"), disabled: !hasSamples },
        { separator: true },
        { label: "Normalize",   onClick: () => applyFx("normalize"),  disabled: !hasSamples },
        { label: "Echo",        onClick: () => applyFx("echo"),       disabled: !hasSamples },
        { separator: true },
        { label: "Fade In",     onClick: () => applyFx("fade-in"),    disabled: !hasSamples },
        { label: "Fade Out",    onClick: () => applyFx("fade-out"),   disabled: !hasSamples },
      ],
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [hasSamples, onQuit]);

  useWindowMenus(menus);

  // ── Render ────────────────────────────────────────────────────────────────

  const sr = srRef.current;

  return (
    <div className="sr">
      {/* Hidden import input */}
      <input
        ref={importInputRef}
        type="file"
        accept="audio/*"
        style={{ display: "none" }}
        onChange={handleImportChange}
      />

      {/* Waveform display */}
      <div className="sr__display">
        <canvas
          ref={canvasRef}
          className="sr__canvas"
          onClick={handleCanvasClick}
          title="Click to move playhead"
        />
        {isRecording && <div className="sr__rec-badge">● REC</div>}
      </div>

      {/* Tape controls */}
      <div className="sr__controls">
        <button
          className="sr__btn"
          onPointerDown={startScrubRwd}
          onPointerUp={stopScrubRwd}
          onPointerLeave={stopScrubRwd}
          title="Hold to rewind"
        >
          ◀◀
        </button>
        <button
          className="sr__btn"
          onPointerDown={startScrubFwd}
          onPointerUp={stopScrubFwd}
          onPointerLeave={stopScrubFwd}
          title="Hold to fast-forward"
        >
          ▶▶
        </button>
        <button
          className={`sr__btn sr__btn--play${isPlaying ? " sr__btn--active" : ""}`}
          onClick={togglePlayPause}
          disabled={!hasSamples}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "‖" : "▶"}
        </button>
        <button
          className={`sr__btn sr__btn--rec${isRecording ? " sr__btn--active" : ""}`}
          onClick={toggleRecord}
          title={isRecording ? "Stop Recording" : "Record"}
        >
          ●
        </button>
      </div>

      {/* Status bar */}
      <div className="sr__status">
        <span className="sr__time">{fmtTime(displayPos, sr)} / {fmtTime(displayLen, sr)}</span>
        <span className="sr__filename">{fileName}</span>
        <span className="sr__msg">{statusMsg}</span>
      </div>

      {/* Draft restore dialog */}
      {showRestoreDlg && (
        <div className="sr__overlay">
          <div className="sr__dialog">
            <div className="sr__dialog-title">Restore Session</div>
            <div className="sr__dialog-body">
              <label className="sr__label">
                Unsaved work found from {draftTimeStr}.
              </label>
              <label className="sr__label" style={{ color: "#808080" }}>
                Restore it?
              </label>
            </div>
            <div className="sr__dialog-footer">
              <button className="sr__btn" onClick={handleRestoreDraft}>Restore</button>
              <button className="sr__btn" onClick={handleDiscardDraft}>Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* Open File dialog */}
      {showOpenDlg && (
        <div className="sr__overlay">
          <div className="sr__dialog">
            <div className="sr__dialog-title">Open Sound File</div>
            <div className="sr__dialog-list">
              {openDlgFiles.length === 0
                ? <div className="sr__dialog-empty">No saved files found.</div>
                : openDlgFiles.map(n => (
                  <div
                    key={n}
                    className="sr__dialog-item"
                    onClick={() => handleOpenFileSelect(n)}
                  >
                    🎵 {n}
                  </div>
                ))
              }
            </div>
            <div className="sr__dialog-footer">
              <button className="sr__btn" onClick={() => setShowOpenDlg(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Save File dialog */}
      {showSaveDlg && (
        <div className="sr__overlay">
          <div className="sr__dialog">
            <div className="sr__dialog-title">Save Sound File</div>
            <div className="sr__dialog-body">
              <label className="sr__label">File name:</label>
              <input
                className="sr__input"
                value={saveDlgName}
                onChange={e => setSaveDlgName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") confirmSave();
                  if (e.key === "Escape") setShowSaveDlg(false);
                }}
                autoFocus
              />
            </div>
            <div className="sr__dialog-footer">
              <button className="sr__btn" onClick={confirmSave}>Save</button>
              <button className="sr__btn" onClick={() => setShowSaveDlg(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
