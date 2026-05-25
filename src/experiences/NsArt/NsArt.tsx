import {
  useRef, useState, useEffect, useCallback,
  useLayoutEffect, forwardRef, useImperativeHandle, useMemo,
} from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import "./NsArt.css";

// ── Types ──────────────────────────────────────────────────────────────────

type Tool = "brush" | "spray" | "eraser" | "fill" | "line" | "rect" | "oval" | "zoom";
type BrushShape = "square" | "round";
type FillMode = "outline" | "filled" | "both";
interface CanvasSize { w: number; h: number }

interface DialogButton { label: string; onClick: () => void; primary?: boolean }
interface ConfirmState { title: string; message: string; buttons: DialogButton[] }

type OnionOpacity = 0.25 | 0.5 | 0.75;
type OnionRange = 1 | 2;

interface Strip { name: string }

interface PendingRestore {
  strips: Strip[];
  frames: (ImageData | null)[][];
  frameCount: number;
  frameW: number;
  frameH: number;
}

export interface NsArtHandle {
  requestClose: (proceed: () => void) => void;
}

export interface NsArtProps {
  onBackupSaved?: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_PALETTE: string[] = [
  "#000000", "#7f7f7f", "#800000", "#cc4400",
  "#ff6b00", "#808000", "#005500", "#006060",
  "#000080", "#5b2d8e", "#7b3dbe", "#800080",
  "#8b4513", "#c0c0c0",
  "#ffffff", "#d4d0c8", "#ff4444", "#ff9933",
  "#ffdd00", "#00cc44", "#00cccc", "#4488ff",
  "#d0a0ff", "#ff44ff", "#ffcc88", "#aa66ff",
  "#ffffaa", "#aaddff",
];

const CANVAS_PRESETS: CanvasSize[] = [
  { w: 160, h: 120 },
  { w: 320, h: 240 },
  { w: 640, h: 480 },
  { w: 800, h: 600 },
];

const BRUSH_SIZES = [1, 3, 5, 8] as const;
type BrushSize = typeof BRUSH_SIZES[number];

const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: "brush",  label: "🖌️", title: "Brush — left=primary, right=secondary" },
  { id: "spray",  label: "🫧",  title: "Spray Can"                              },
  { id: "eraser", label: "🧼",  title: "Eraser"                                 },
  { id: "fill",   label: "🪣",  title: "Fill"                                   },
  { id: "line",   label: "╱",  title: "Line"                                   },
  { id: "rect",   label: "▭",  title: "Rectangle"                              },
  { id: "oval",   label: "⬭",  title: "Oval"                                   },
  { id: "zoom",   label: "🔍",  title: "Zoom — click cycles sizes; right-click reverses" },
];

const LS_KEY = "ns-art-backup";

// ── Canvas utilities ───────────────────────────────────────────────────────

function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, fillColor: string) {
  const canvas = ctx.canvas;
  const w = canvas.width, h = canvas.height;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const si = (sy * w + sx) * 4;
  const tR = d[si], tG = d[si+1], tB = d[si+2], tA = d[si+3];
  let fR: number, fG: number, fB: number, fA: number;
  if (fillColor === "transparent") {
    [fR, fG, fB, fA] = [0, 0, 0, 0];
  } else {
    const m = /^#(..)(..)(..)$/.exec(fillColor);
    if (!m) return;
    [fR, fG, fB, fA] = [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16), 255];
  }
  if (tR === fR && tG === fG && tB === fB && tA === fA) return;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [si];
  while (stack.length > 0) {
    const i = stack.pop()!;
    const pi = i >> 2;
    if (visited[pi]) continue;
    if (d[i] !== tR || d[i+1] !== tG || d[i+2] !== tB || d[i+3] !== tA) continue;
    visited[pi] = 1;
    d[i] = fR; d[i+1] = fG; d[i+2] = fB; d[i+3] = fA;
    const x = pi % w, y = Math.floor(pi / w);
    if (x > 0)     stack.push(i - 4);
    if (x < w - 1) stack.push(i + 4);
    if (y > 0)     stack.push(i - w * 4);
    if (y < h - 1) stack.push(i + w * 4);
  }
  ctx.putImageData(imageData, 0, 0);
}

// Hard-edged stamp at a single canvas pixel — no anti-aliasing
function stampPixel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: string, size: number, shape: BrushShape,
) {
  const half = Math.floor(size / 2);
  if (color === "transparent") {
    ctx.clearRect(x - half, y - half, size, size);
    return;
  }
  ctx.fillStyle = color;
  if (shape === "round" && size > 2) {
    const r = half;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + r * 0.5) ctx.fillRect(x + dx, y + dy, 1, 1);
      }
    }
  } else {
    ctx.fillRect(x - half, y - half, size, size);
  }
}

// Bresenham line — stamps hard pixels with no anti-aliasing
function bresenhamLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  color: string, size: number, shape: BrushShape,
) {
  let cx = Math.round(x0), cy = Math.round(y0);
  const ex = Math.round(x1), ey = Math.round(y1);
  const dx = Math.abs(ex - cx), dy = Math.abs(ey - cy);
  const sx = cx < ex ? 1 : -1, sy = cy < ey ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    stampPixel(ctx, cx, cy, color, size, shape);
    if (cx === ex && cy === ey) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx)  { err += dx; cy += sy; }
  }
}

function applyColor(ctx: CanvasRenderingContext2D, color: string, size: number) {
  if (color === "transparent") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.fillStyle   = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
  }
  ctx.lineWidth = size;
  ctx.lineCap   = "round";
  ctx.lineJoin  = "round";
}

function resetCtx(ctx: CanvasRenderingContext2D) {
  ctx.globalCompositeOperation = "source-over";
}

function strokeLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  color: string, size: number,
) {
  applyColor(ctx, color, size);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  resetCtx(ctx);
}

function strokeRect(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  outlineColor: string, fillColor: string,
  size: number, mode: FillMode,
) {
  const x = Math.min(x0,x1), y = Math.min(y0,y1);
  const w = Math.abs(x1-x0), h = Math.abs(y1-y0);
  if ((mode === "filled" || mode === "both") && w > 0 && h > 0) {
    applyColor(ctx, fillColor, size);
    ctx.fillRect(x, y, w, h);
  }
  if (mode === "outline" || mode === "both") {
    applyColor(ctx, outlineColor, size);
    ctx.strokeRect(x, y, w, h);
  }
  resetCtx(ctx);
}

function strokeOval(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  outlineColor: string, fillColor: string,
  size: number, mode: FillMode,
) {
  const cx = (x0+x1)/2, cy = (y0+y1)/2;
  const rx = Math.max(1, Math.abs(x1-x0)/2);
  const ry = Math.max(1, Math.abs(y1-y0)/2);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
  if (mode === "filled" || mode === "both") {
    applyColor(ctx, fillColor, size);
    ctx.fill();
  }
  if (mode === "outline" || mode === "both") {
    applyColor(ctx, outlineColor, size);
    ctx.stroke();
  }
  resetCtx(ctx);
}

function doSpray(canvas: HTMLCanvasElement, x: number, y: number, color: string, size: number) {
  const ctx = canvas.getContext("2d")!;
  const radius = size * 5, density = size * 4;
  if (color === "transparent") {
    for (let i = 0; i < density; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      ctx.clearRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
    }
  } else {
    ctx.fillStyle = color;
    for (let i = 0; i < density; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
    }
  }
}

// ── Component ──────────────────────────────────────────────────────────────

const NsArt = forwardRef<NsArtHandle, NsArtProps>(function NsArt(
  { onBackupSaved }: NsArtProps,
  ref,
) {
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef      = useRef<HTMLDivElement>(null);
  const onionCanvasRef     = useRef<HTMLCanvasElement>(null);
  const primaryPickerRef   = useRef<HTMLInputElement>(null);
  const secondaryPickerRef = useRef<HTMLInputElement>(null);
  const swatchPickerRef    = useRef<HTMLInputElement>(null);
  const stripRenameRef     = useRef<HTMLInputElement>(null);

  // Drawing state
  const [tool,           setTool]          = useState<Tool>("brush");
  const [palette,        setPalette]       = useState<string[]>(() => [...DEFAULT_PALETTE]);
  const [primaryColor,   setPrimaryColor]  = useState("#000000");
  const [secondaryColor, setSecondaryColor]= useState("#ffffff");
  const [brushSize,      setBrushSize]     = useState<BrushSize>(1);
  const [brushShape,     setBrushShape]    = useState<BrushShape>("square");
  const [fillMode,       setFillMode]      = useState<FillMode>("outline");
  const [zoom,           setZoom]          = useState(1);
  const [canvasSize,     setCanvasSize]    = useState<CanvasSize>({ w: 320, h: 240 });
  const [status,         setStatus]        = useState("Ready");
  const [confirmState,   setConfirmState]  = useState<ConfirmState | null>(null);
  const [editingSwatchIdx, setEditingSwatchIdx] = useState<number | null>(null);

  // Animation state
  const [strips,        setStrips]        = useState<Strip[]>([{ name: "Strip 1" }]);
  const [currentStrip,  setCurrentStrip]  = useState(0);
  const [currentFrame,  setCurrentFrame]  = useState(0);
  const [frameCount,    setFrameCount]    = useState(1);
  const [onionSkin,     setOnionSkin]     = useState(true);
  const [onionOpacity,  setOnionOpacity]  = useState<OnionOpacity>(0.5);
  const [onionRange,    setOnionRange]    = useState<OnionRange>(1);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [playFps,       setPlayFps]       = useState(8);
  const [renamingStrip, setRenamingStrip] = useState<number | null>(null);
  const [renameValue,   setRenameValue]   = useState("");

  // Drawing refs
  const isDrawingRef        = useRef(false);
  const startRef            = useRef({ x: 0, y: 0 });
  const lastRef             = useRef({ x: 0, y: 0 });
  const snapshotRef         = useRef<ImageData | null>(null);
  const undoRef             = useRef<ImageData[]>([]);
  const sprayRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeColorRef      = useRef("#000000");
  const activeFillColorRef  = useRef("#ffffff");
  const activeSizeRef       = useRef<number>(1);
  const activeBrushShapeRef = useRef<BrushShape>("square");
  const isDirtyRef          = useRef(false);
  const saveTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBackupSavedRef    = useRef(onBackupSaved);

  // Animation refs (stable, avoid stale closures)
  // framesDataRef[stripIdx][frameIdx] = ImageData | null  (null = blank white)
  const framesDataRef    = useRef<(ImageData | null)[][]>([[null]]);
  const currentStripRef  = useRef(0);
  const currentFrameRef  = useRef(0);
  const frameCountRef    = useRef(1);
  const stripsRef        = useRef<Strip[]>([{ name: "Strip 1" }]);
  const isPlayingRef     = useRef(false);
  const playIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const renderOnionRef      = useRef<() => void>(() => {});
  const saveFrameRef        = useRef<() => void>(() => {});
  const loadFrameRef        = useRef<(s: number, f: number) => void>(() => {});
  const scheduleAutoSaveRef = useRef<() => void>(() => {});
  const pendingRestoreRef   = useRef<PendingRestore | null>(null);

  useEffect(() => { onBackupSavedRef.current = onBackupSaved; }, [onBackupSaved]);
  useEffect(() => { currentStripRef.current  = currentStrip;  }, [currentStrip]);
  useEffect(() => { currentFrameRef.current  = currentFrame;  }, [currentFrame]);
  useEffect(() => { frameCountRef.current    = frameCount;    }, [frameCount]);
  useEffect(() => { stripsRef.current        = strips;        }, [strips]);
  useEffect(() => { isPlayingRef.current     = isPlaying;     }, [isPlaying]);

  // ── Frame data helpers ─────────────────────────────────────────────────

  const saveCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const si = currentStripRef.current;
    const fi = currentFrameRef.current;
    if (!framesDataRef.current[si]) framesDataRef.current[si] = [];
    framesDataRef.current[si][fi] = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const loadFrame = useCallback((stripIdx: number, frameIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const data = framesDataRef.current[stripIdx]?.[frameIdx];
    ctx.globalCompositeOperation = "source-over";
    if (data) {
      ctx.putImageData(data, 0, 0);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => { saveFrameRef.current = saveCurrentFrame; }, [saveCurrentFrame]);
  useEffect(() => { loadFrameRef.current = loadFrame;        }, [loadFrame]);

  // ── Expose imperative handle ───────────────────────────────────────────

  const exportCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `ns-art-s${currentStripRef.current + 1}-f${currentFrameRef.current + 1}.png`;
    a.click();
    isDirtyRef.current = false;
  }, []);

  useImperativeHandle(ref, () => ({
    requestClose: (proceed) => {
      if (isDirtyRef.current) {
        setConfirmState({
          title: "NS Art",
          message: "Your artwork has unsaved changes.",
          buttons: [
            { label: "Export PNG", primary: true, onClick: () => { exportCurrentFrame(); proceed(); setConfirmState(null); } },
            { label: "Close without saving",      onClick: () => { proceed(); setConfirmState(null); } },
            { label: "Cancel",                    onClick: () => setConfirmState(null) },
          ],
        });
      } else {
        proceed();
      }
    },
  }), [exportCurrentFrame]);

  // ── Auto-size canvas to fit space on mount ─────────────────────────────

  useLayoutEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const availW = el.clientWidth  - 16;
    const availH = el.clientHeight - 16;
    let best = CANVAS_PRESETS[0];
    for (const p of CANVAS_PRESETS) {
      if (p.w <= availW && p.h <= availH) best = p;
    }
    setCanvasSize(best);
  }, []);

  // ── Init canvas to white when size changes ─────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    undoRef.current = [];
    isDirtyRef.current = false;

    // Apply a pending full-restore if sizes now match
    const pending = pendingRestoreRef.current;
    if (pending && pending.frameW === canvas.width && pending.frameH === canvas.height) {
      pendingRestoreRef.current = null;
      framesDataRef.current      = pending.frames;
      stripsRef.current          = pending.strips;
      frameCountRef.current      = pending.frameCount;
      currentStripRef.current    = 0;
      currentFrameRef.current    = 0;
      setStrips(pending.strips);
      setFrameCount(pending.frameCount);
      setCurrentStrip(0);
      setCurrentFrame(0);
      const first = pending.frames[0]?.[0];
      if (first) ctx.putImageData(first, 0, 0);
      isDirtyRef.current = false;
    }
  }, [canvasSize]);

  // ── Load full backup from localStorage once on mount ──────────────────

  useEffect(() => {
    const t = setTimeout(() => {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw || !canvasRef.current) return;
      try {
        const backup = JSON.parse(raw);
        if (backup.version !== 2) return; // ignore old single-frame format
        const { frameW, frameH, strips: savedStrips, frames: savedUrls } = backup;
        if (!Array.isArray(savedStrips) || !Array.isArray(savedUrls)) return;
        const fc = (savedUrls[0] as unknown[])?.length ?? 1;

        const loadImg = (url: string | null, w: number, h: number): Promise<ImageData | null> => {
          if (!url) return Promise.resolve(null);
          return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
              const tmp = document.createElement("canvas");
              tmp.width = w; tmp.height = h;
              tmp.getContext("2d")!.drawImage(img, 0, 0);
              resolve(tmp.getContext("2d")!.getImageData(0, 0, w, h));
            };
            img.onerror = () => resolve(null);
            img.src = url;
          });
        };

        Promise.all(
          (savedUrls as (string | null)[][]).map(strip =>
            Promise.all(strip.map(url => loadImg(url, frameW, frameH)))
          )
        ).then(allFrames => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const pending: PendingRestore = {
            strips: savedStrips as Strip[],
            frames: allFrames,
            frameCount: fc,
            frameW,
            frameH,
          };
          if (canvas.width === frameW && canvas.height === frameH) {
            // Sizes match — apply now
            framesDataRef.current   = pending.frames;
            stripsRef.current       = pending.strips;
            frameCountRef.current   = pending.frameCount;
            currentStripRef.current = 0;
            currentFrameRef.current = 0;
            setStrips(pending.strips);
            setFrameCount(pending.frameCount);
            setCurrentStrip(0);
            setCurrentFrame(0);
            const first = pending.frames[0]?.[0];
            const ctx = canvas.getContext("2d")!;
            if (first) ctx.putImageData(first, 0, 0);
            else { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
            isDirtyRef.current = false;
            renderOnionRef.current();
          } else {
            // Sizes differ — trigger resize; canvasSize effect will apply restore
            pendingRestoreRef.current = pending;
            setCanvasSize({ w: frameW, h: frameH });
          }
        });
      } catch { /* corrupt backup — ignore */ }
    }, 100);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save all frames to localStorage ──────────────────────────────

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      saveFrameRef.current(); // ensure current frame is flushed to store

      const fw = canvas.width, fh = canvas.height;
      const tmp = document.createElement("canvas");
      tmp.width = fw; tmp.height = fh;
      const tmpCtx = tmp.getContext("2d")!;

      const framesUrls: (string | null)[][] = framesDataRef.current.map(strip =>
        strip.map(frame => {
          if (!frame) return null;
          tmpCtx.putImageData(frame, 0, 0);
          return tmp.toDataURL("image/png");
        })
      );

      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          version: 2,
          frameW: fw,
          frameH: fh,
          strips: stripsRef.current,
          frames: framesUrls,
        }));
        onBackupSavedRef.current?.();
      } catch { /* storage full — skip */ }
    }, 2000);
  }, []);

  useEffect(() => { scheduleAutoSaveRef.current = scheduleAutoSave; }, [scheduleAutoSave]);

  // ── Undo ──────────────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snap  = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    const stack = undoRef.current;
    undoRef.current = stack.length >= 5 ? [...stack.slice(1), snap] : [...stack, snap];
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoRef.current.length === 0) return;
    const prev = undoRef.current[undoRef.current.length - 1];
    undoRef.current = undoRef.current.slice(0, -1);
    canvas.getContext("2d")!.putImageData(prev, 0, 0);
    isDirtyRef.current = true;
    renderOnionRef.current();
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────

  const navigateTo = useCallback((stripIdx: number, frameIdx: number) => {
    saveFrameRef.current();
    const clampedStrip = Math.max(0, Math.min(stripsRef.current.length - 1, stripIdx));
    const clampedFrame = Math.max(0, Math.min(frameCountRef.current - 1, frameIdx));
    currentStripRef.current = clampedStrip;
    currentFrameRef.current = clampedFrame;
    setCurrentStrip(clampedStrip);
    setCurrentFrame(clampedFrame);
    loadFrameRef.current(clampedStrip, clampedFrame);
    undoRef.current = [];
    renderOnionRef.current();
  }, []);

  // ── Onion skin ────────────────────────────────────────────────────────

  const renderOnionSkin = useCallback(() => {
    const onionCanvas = onionCanvasRef.current;
    if (!onionCanvas) return;
    const ctx = onionCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, onionCanvas.width, onionCanvas.height);

    if (!onionSkin || isPlayingRef.current) return;

    const strip = currentStripRef.current;
    const frame = currentFrameRef.current;
    const fc    = frameCountRef.current;
    const fw    = onionCanvas.width;
    const fh    = onionCanvas.height;

    for (let delta = -onionRange; delta <= onionRange; delta++) {
      if (delta === 0) continue;
      const targetFrame = frame + delta;
      if (targetFrame < 0 || targetFrame >= fc) continue;

      const data = framesDataRef.current[strip]?.[targetFrame];
      if (!data) continue;

      const tinted = new ImageData(new Uint8ClampedArray(data.data), fw, fh);
      const d = tinted.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        // Treat near-white (background) as transparent so it doesn't bleed through
        if (r > 240 && g > 240 && b > 240) { d[i+3] = 0; continue; }
        if (delta < 0) {
          // Previous frame → red tint
          d[i+1] = Math.floor(g * 0.15);
          d[i+2] = Math.floor(b * 0.15);
        } else {
          // Next frame → blue/teal tint
          d[i]   = Math.floor(r * 0.15);
          d[i+1] = Math.floor(g * 0.6);
        }
      }

      const tmp = document.createElement("canvas");
      tmp.width = fw; tmp.height = fh;
      tmp.getContext("2d")!.putImageData(tinted, 0, 0);
      const fade = onionRange > 1 ? (onionRange - Math.abs(delta) + 1) / onionRange : 1;
      ctx.globalAlpha = onionOpacity * fade;
      ctx.drawImage(tmp, 0, 0);
    }
    ctx.globalAlpha = 1;
  }, [onionSkin, onionOpacity, onionRange]);

  useEffect(() => { renderOnionRef.current = renderOnionSkin; }, [renderOnionSkin]);
  useEffect(() => { renderOnionSkin(); }, [renderOnionSkin]);

  // ── Play / Stop ───────────────────────────────────────────────────────

  const stopPlay = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    renderOnionRef.current();
  }, []);

  const startPlay = useCallback(() => {
    saveFrameRef.current();
    setIsPlaying(true);
    isPlayingRef.current = true;
    playIntervalRef.current = setInterval(() => {
      const next = (currentFrameRef.current + 1) % frameCountRef.current;
      currentFrameRef.current = next;
      setCurrentFrame(next);
      loadFrameRef.current(currentStripRef.current, next);
    }, Math.max(16, Math.round(1000 / playFps)));
  }, [playFps]);

  useEffect(() => () => {
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
  }, []);

  // ── Frame / Strip management ───────────────────────────────────────────

  const addFrame = useCallback(() => {
    if (isPlayingRef.current) return;
    saveFrameRef.current();
    const newIdx   = frameCountRef.current;
    const newCount = frameCountRef.current + 1;
    for (const row of framesDataRef.current) row.push(null);
    frameCountRef.current  = newCount;
    currentFrameRef.current = newIdx;
    setFrameCount(newCount);
    setCurrentFrame(newIdx);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d")!;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    undoRef.current = [];
    isDirtyRef.current = true;
    scheduleAutoSaveRef.current();
    renderOnionRef.current();
  }, []);

  const deleteFrame = useCallback(() => {
    if (isPlayingRef.current || frameCountRef.current <= 1) return;
    const frame    = currentFrameRef.current;
    for (const row of framesDataRef.current) row.splice(frame, 1);
    const newCount = frameCountRef.current - 1;
    const newFrame = Math.min(frame, newCount - 1);
    frameCountRef.current  = newCount;
    currentFrameRef.current = newFrame;
    setFrameCount(newCount);
    setCurrentFrame(newFrame);
    loadFrameRef.current(currentStripRef.current, newFrame);
    undoRef.current = [];
    isDirtyRef.current = true;
    scheduleAutoSaveRef.current();
    renderOnionRef.current();
  }, []);

  const addStrip = useCallback(() => {
    if (isPlayingRef.current) return;
    saveFrameRef.current();
    const newIdx   = stripsRef.current.length;
    const newStrip: Strip = { name: `Strip ${newIdx + 1}` };
    const newRow: (ImageData | null)[] = new Array<ImageData | null>(frameCountRef.current).fill(null);
    framesDataRef.current.push(newRow);
    const newStrips = [...stripsRef.current, newStrip];
    stripsRef.current = newStrips;
    setStrips(newStrips);
    currentStripRef.current  = newIdx;
    currentFrameRef.current  = 0;
    setCurrentStrip(newIdx);
    setCurrentFrame(0);
    loadFrameRef.current(newIdx, 0);
    undoRef.current = [];
    isDirtyRef.current = true;
    scheduleAutoSaveRef.current();
    renderOnionRef.current();
  }, []);

  const deleteStrip = useCallback(() => {
    if (isPlayingRef.current || stripsRef.current.length <= 1) return;
    const strip     = currentStripRef.current;
    framesDataRef.current.splice(strip, 1);
    const newStrips = stripsRef.current.filter((_, i) => i !== strip);
    const newIdx    = Math.min(strip, newStrips.length - 1);
    stripsRef.current = newStrips;
    setStrips(newStrips);
    currentStripRef.current = newIdx;
    setCurrentStrip(newIdx);
    loadFrameRef.current(newIdx, currentFrameRef.current);
    undoRef.current = [];
    isDirtyRef.current = true;
    scheduleAutoSaveRef.current();
    renderOnionRef.current();
  }, []);

  // ── New ───────────────────────────────────────────────────────────────

  const newCanvas = useCallback(() => {
    const doNew = () => {
      framesDataRef.current   = [[null]];
      const fresh             = [{ name: "Strip 1" }];
      stripsRef.current       = fresh;
      frameCountRef.current   = 1;
      currentStripRef.current = 0;
      currentFrameRef.current = 0;
      setStrips(fresh);
      setFrameCount(1);
      setCurrentStrip(0);
      setCurrentFrame(0);
      undoRef.current = [];
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d")!;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      isDirtyRef.current = false;
      renderOnionRef.current();
    };

    if (isDirtyRef.current) {
      setConfirmState({
        title: "NS Art — New",
        message: "Clear all frames? This cannot be undone.",
        buttons: [
          { label: "Clear All", primary: true, onClick: () => { doNew(); setConfirmState(null); } },
          { label: "Cancel",                   onClick: () => setConfirmState(null) },
        ],
      });
    } else {
      doNew();
    }
  }, []);

  // ── Canvas size picker ─────────────────────────────────────────────────

  const handleSizeSelect = useCallback((preset: CanvasSize) => {
    const doResize = () => {
      const numStrips = framesDataRef.current.length;
      const numFrames = frameCountRef.current;
      for (let s = 0; s < numStrips; s++) {
        framesDataRef.current[s] = new Array<ImageData | null>(numFrames).fill(null);
      }
      setCanvasSize(preset);
      setZoom(1);
      undoRef.current = [];
      isDirtyRef.current = false;
    };

    if (preset.w === canvasSize.w && preset.h === canvasSize.h) return;

    if (isDirtyRef.current || frameCount > 1 || strips.length > 1) {
      setConfirmState({
        title: "Change Frame Size",
        message: "This will clear all frames. Continue?",
        buttons: [
          { label: "Continue", primary: true, onClick: () => { doResize(); setConfirmState(null); } },
          { label: "Cancel",                  onClick: () => setConfirmState(null) },
        ],
      });
    } else {
      doResize();
    }
  }, [canvasSize, frameCount, strips.length]);

  // ── Export ────────────────────────────────────────────────────────────

  const exportSpriteSheet = useCallback(() => {
    saveFrameRef.current();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fw        = canvas.width;
    const fh        = canvas.height;
    const numStrips = framesDataRef.current.length;
    const numFrames = frameCountRef.current;

    const sheet = document.createElement("canvas");
    sheet.width  = fw * numFrames;
    sheet.height = fh * numStrips;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sheet.width, sheet.height);

    for (let s = 0; s < numStrips; s++) {
      for (let f = 0; f < numFrames; f++) {
        const data = framesDataRef.current[s]?.[f];
        if (data) {
          const tmp = document.createElement("canvas");
          tmp.width = fw; tmp.height = fh;
          tmp.getContext("2d")!.putImageData(data, 0, 0);
          ctx.drawImage(tmp, f * fw, s * fh);
        }
      }
    }

    const a = document.createElement("a");
    a.href     = sheet.toDataURL("image/png");
    a.download = "sprite-sheet.png";
    a.click();
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      if (e.altKey && e.key === "ArrowLeft")  { e.preventDefault(); navigateTo(currentStripRef.current, currentFrameRef.current - 1); }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); navigateTo(currentStripRef.current, currentFrameRef.current + 1); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo, navigateTo]);

  // ── beforeunload guard ────────────────────────────────────────────────

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // ── Palette swatch editing ────────────────────────────────────────────

  function openSwatchEditor(idx: number) {
    setEditingSwatchIdx(idx);
    const input = swatchPickerRef.current;
    if (!input) return;
    input.value = palette[idx];
    input.click();
  }

  function onSwatchColorChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (editingSwatchIdx === null) return;
    const newColor = e.target.value;
    const oldColor = palette[editingSwatchIdx];
    setPalette(prev => prev.map((c, i) => i === editingSwatchIdx ? newColor : c));
    if (primaryColor   === oldColor) setPrimaryColor(newColor);
    if (secondaryColor === oldColor) setSecondaryColor(newColor);
  }

  // ── Drawing core ──────────────────────────────────────────────────────

  const startDrawing = useCallback((x: number, y: number, isSecondary: boolean) => {
    if (isPlayingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    if (tool === "zoom") {
      if (isSecondary) {
        setZoom(z => z === 1 ? 4 : z / 2);
      } else {
        setZoom(z => z === 4 ? 1 : z * 2);
      }
      return;
    }

    const strokeColor = isSecondary ? secondaryColor : primaryColor;

    if (tool === "fill") {
      pushUndo();
      floodFill(ctx, x, y, strokeColor);
      isDirtyRef.current = true;
      scheduleAutoSave();
      renderOnionRef.current();
      return;
    }

    isDrawingRef.current        = true;
    startRef.current            = { x, y };
    lastRef.current             = { x, y };
    activeColorRef.current      = strokeColor;
    activeFillColorRef.current  = isSecondary ? primaryColor : secondaryColor;
    activeSizeRef.current       = brushSize;
    activeBrushShapeRef.current = brushShape;

    if (tool === "brush" || tool === "eraser") {
      pushUndo();
      const ec = tool === "eraser" ? "transparent" : strokeColor;
      stampPixel(ctx, x, y, ec, brushSize, brushShape);
    } else if (tool === "spray") {
      pushUndo();
      doSpray(canvas, x, y, strokeColor, brushSize);
      const cc = strokeColor, cs = brushSize;
      sprayRef.current = setInterval(() => {
        if (!isDrawingRef.current || !canvasRef.current) return;
        doSpray(canvasRef.current, lastRef.current.x, lastRef.current.y, cc, cs);
      }, 50);
    } else {
      pushUndo();
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }, [tool, primaryColor, secondaryColor, brushSize, brushShape, pushUndo, scheduleAutoSave]);

  const continueDrawing = useCallback((x: number, y: number) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx     = canvas.getContext("2d")!;
    const color   = activeColorRef.current;
    const fillCol = activeFillColorRef.current;
    const size    = activeSizeRef.current;
    const shape   = activeBrushShapeRef.current;

    if (tool === "brush") {
      bresenhamLine(ctx, lastRef.current.x, lastRef.current.y, x, y, color, size, shape);
    } else if (tool === "eraser") {
      bresenhamLine(ctx, lastRef.current.x, lastRef.current.y, x, y, "transparent", size, shape);
    } else if (tool === "spray") {
      doSpray(canvas, x, y, color, brushSize);
    } else if (snapshotRef.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
      const { x: sx, y: sy } = startRef.current;
      if (tool === "line")      strokeLine(ctx, sx, sy, x, y, color, size);
      else if (tool === "rect") strokeRect(ctx, sx, sy, x, y, color, fillCol, size, fillMode);
      else if (tool === "oval") strokeOval(ctx, sx, sy, x, y, color, fillCol, size, fillMode);
    }
    lastRef.current = { x, y };
  }, [tool, brushSize, fillMode]);

  const endDrawing = useCallback((x: number, y: number) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (sprayRef.current) { clearInterval(sprayRef.current); sprayRef.current = null; }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx     = canvas.getContext("2d")!;
    const color   = activeColorRef.current;
    const fillCol = activeFillColorRef.current;
    const size    = activeSizeRef.current;

    if (snapshotRef.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
      const { x: sx, y: sy } = startRef.current;
      if (tool === "line")      strokeLine(ctx, sx, sy, x, y, color, size);
      else if (tool === "rect") strokeRect(ctx, sx, sy, x, y, color, fillCol, size, fillMode);
      else if (tool === "oval") strokeOval(ctx, sx, sy, x, y, color, fillCol, size, fillMode);
      snapshotRef.current = null;
    }

    isDirtyRef.current = true;
    scheduleAutoSave();
    renderOnionRef.current();
  }, [tool, fillMode, scheduleAutoSave]);

  // ── Mouse / Touch handlers ────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    startDrawing(
      Math.floor((e.clientX - rect.left) / zoom),
      Math.floor((e.clientY - rect.top)  / zoom),
      e.button === 2,
    );
  }, [startDrawing, zoom]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ax = Math.floor((e.clientX - rect.left) / zoom);
    const ay = Math.floor((e.clientY - rect.top)  / zoom);
    setStatus(`${ax}, ${ay}`);
    continueDrawing(ax, ay);
  }, [continueDrawing, zoom]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    endDrawing(
      Math.floor((e.clientX - rect.left) / zoom),
      Math.floor((e.clientY - rect.top)  / zoom),
    );
  }, [endDrawing, zoom]);

  const onMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setStatus("Ready");
    onMouseUp(e);
  }, [onMouseUp]);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const t    = e.touches[0];
    startDrawing(
      Math.floor((t.clientX - rect.left) / zoom),
      Math.floor((t.clientY - rect.top)  / zoom),
      false,
    );
  }, [startDrawing, zoom]);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const t    = e.touches[0];
    const x = Math.floor((t.clientX - rect.left) / zoom);
    const y = Math.floor((t.clientY - rect.top)  / zoom);
    setStatus(`${x}, ${y}`);
    continueDrawing(x, y);
  }, [continueDrawing, zoom]);

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const t    = e.changedTouches[0];
    endDrawing(
      Math.floor((t.clientX - rect.left) / zoom),
      Math.floor((t.clientY - rect.top)  / zoom),
    );
    setStatus("Ready");
  }, [endDrawing, zoom]);

  // ── Menu bar ──────────────────────────────────────────────────────────

  const artMenus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "File",
      items: [
        { label: "New", onClick: newCanvas },
        { separator: true },
        { label: "Export Current Frame", onClick: exportCurrentFrame },
        { label: "Export Sprite Sheet PNG", onClick: exportSpriteSheet },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo  Ctrl+Z", onClick: undo },
      ],
    },
    {
      label: "Format",
      items: CANVAS_PRESETS.map(p => ({
        label:   `${p.w}×${p.h}`,
        checked: canvasSize.w === p.w && canvasSize.h === p.h,
        onClick: () => handleSizeSelect(p),
      })),
    },
    {
      label: "Animation",
      items: [
        { label: "Add Frame",    onClick: addFrame },
        { label: "Delete Frame", onClick: deleteFrame, disabled: frameCount <= 1 },
        { separator: true },
        { label: "Add Strip",    onClick: addStrip },
        { label: "Delete Strip", onClick: deleteStrip, disabled: strips.length <= 1 },
        { label: "Rename Strip...", onClick: () => {
          setRenamingStrip(currentStrip);
          setRenameValue(strips[currentStrip]?.name ?? "");
          setTimeout(() => stripRenameRef.current?.focus(), 30);
        }},
        { separator: true },
        { label: "Onion Skin",      checked: onionSkin,            onClick: () => setOnionSkin(v => !v) },
        { label: "Opacity 25%",     checked: onionOpacity === 0.25, onClick: () => setOnionOpacity(0.25) },
        { label: "Opacity 50%",     checked: onionOpacity === 0.5,  onClick: () => setOnionOpacity(0.5)  },
        { label: "Opacity 75%",     checked: onionOpacity === 0.75, onClick: () => setOnionOpacity(0.75) },
        { label: "Range: 1 Frame",  checked: onionRange === 1,      onClick: () => setOnionRange(1) },
        { label: "Range: 2 Frames", checked: onionRange === 2,      onClick: () => setOnionRange(2) },
      ],
    },
  ], [
    newCanvas, exportCurrentFrame, exportSpriteSheet, undo,
    canvasSize, handleSizeSelect,
    addFrame, deleteFrame, frameCount,
    addStrip, deleteStrip, strips, currentStrip,
    onionSkin, onionOpacity, onionRange,
  ]);

  useWindowMenus(artMenus);

  const showFillMode   = tool === "rect" || tool === "oval";
  const showBrushShape = tool === "brush" || tool === "eraser";

  // ── Rename strip helpers ──────────────────────────────────────────────

  const commitRename = useCallback(() => {
    if (renamingStrip === null) return;
    const trimmed = renameValue.trim() || `Strip ${renamingStrip + 1}`;
    setStrips(prev => prev.map((s, i) => i === renamingStrip ? { ...s, name: trimmed } : s));
    stripsRef.current = stripsRef.current.map((s, i) => i === renamingStrip ? { ...s, name: trimmed } : s);
    setRenamingStrip(null);
  }, [renamingStrip, renameValue]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="ns-art">

      {/* ── Confirm dialog overlay ── */}
      {confirmState && (
        <div className="ns-art__overlay">
          <div className="ns-art__dialog">
            <div className="ns-art__dialog-titlebar">
              <span className="ns-art__dialog-icon">⚠️</span>
              <span>{confirmState.title}</span>
            </div>
            <div className="ns-art__dialog-body">{confirmState.message}</div>
            <div className="ns-art__dialog-btns">
              {confirmState.buttons.map(btn => (
                <button
                  key={btn.label}
                  className={`ns-art__dialog-btn${btn.primary ? " ns-art__dialog-btn--primary" : ""}`}
                  onClick={btn.onClick}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Strip tab bar ── */}
      <div className="ns-art__strip-bar">
        {strips.map((strip, i) => (
          <div
            key={i}
            className={`ns-art__strip-tab${currentStrip === i ? " ns-art__strip-tab--active" : ""}`}
            onClick={() => { if (renamingStrip !== i) navigateTo(i, currentFrame); }}
            onDoubleClick={() => {
              setRenamingStrip(i);
              setRenameValue(strip.name);
              setTimeout(() => stripRenameRef.current?.focus(), 20);
            }}
            title={`${strip.name}  (double-click to rename)`}
          >
            {renamingStrip === i ? (
              <input
                ref={stripRenameRef}
                className="ns-art__strip-rename"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === "Enter")  { e.preventDefault(); commitRename(); }
                  if (e.key === "Escape") { e.preventDefault(); setRenamingStrip(null); }
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              strip.name
            )}
          </div>
        ))}
        <button className="ns-art__strip-add" onClick={addStrip} title="Add strip">+</button>
      </div>

      {/* ── Workspace ── */}
      <div className="ns-art__workspace">

        {/* Tool palette */}
        <div className="ns-art__toolbox">
          <div className="ns-art__tool-grid">
            {TOOLS.map(t => (
              <button
                key={t.id}
                className={`ns-art__tool${tool === t.id ? " ns-art__tool--active" : ""}`}
                title={t.title}
                onClick={() => setTool(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="ns-art__toolbox-sep" />

          <div className="ns-art__size-dots">
            {BRUSH_SIZES.map(s => (
              <button
                key={s}
                className={`ns-art__size-dot-btn${brushSize === s ? " ns-art__size-dot-btn--active" : ""}`}
                title={`Size ${s}px`}
                onClick={() => setBrushSize(s)}
              >
                <span className="ns-art__dot" style={{ width: Math.min(s + 3, 14), height: Math.min(s + 3, 14) }} />
              </button>
            ))}
          </div>

          {showBrushShape && (
            <>
              <div className="ns-art__toolbox-sep" />
              <div className="ns-art__shape-btns">
                <button
                  className={`ns-art__shape-btn${brushShape === "square" ? " ns-art__shape-btn--active" : ""}`}
                  title="Square stamp" onClick={() => setBrushShape("square")}
                >□</button>
                <button
                  className={`ns-art__shape-btn${brushShape === "round" ? " ns-art__shape-btn--active" : ""}`}
                  title="Round stamp" onClick={() => setBrushShape("round")}
                >○</button>
              </div>
            </>
          )}

          {showFillMode && (
            <>
              <div className="ns-art__toolbox-sep" />
              <div className="ns-art__fill-modes">
                {(["outline", "filled", "both"] as FillMode[]).map(m => (
                  <button
                    key={m}
                    className={`ns-art__fill-btn${fillMode === m ? " ns-art__fill-btn--active" : ""}`}
                    title={`${m} — outline=primary, fill=secondary`}
                    onClick={() => setFillMode(m)}
                  >
                    {m === "outline" ? "□" : m === "filled" ? "■" : "▣"}
                  </button>
                ))}
              </div>
            </>
          )}

          {zoom > 1 && (
            <>
              <div className="ns-art__toolbox-sep" />
              <div className="ns-art__zoom-label">{zoom}×</div>
            </>
          )}
        </div>

        {/* Canvas scroll area */}
        <div className="ns-art__canvas-area" ref={canvasAreaRef}>
          <div
            className="ns-art__canvas-wrap"
            style={{ width: canvasSize.w * zoom, height: canvasSize.h * zoom }}
          >
            <canvas
              ref={canvasRef}
              className={`ns-art__canvas${isPlaying ? " ns-art__canvas--playing" : ""}`}
              width={canvasSize.w}
              height={canvasSize.h}
              style={{ width: canvasSize.w * zoom, height: canvasSize.h * zoom }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onContextMenu={e => e.preventDefault()}
            />
            {/* Onion skin overlay */}
            <canvas
              ref={onionCanvasRef}
              className="ns-art__onion-overlay"
              width={canvasSize.w}
              height={canvasSize.h}
              style={{ width: canvasSize.w * zoom, height: canvasSize.h * zoom }}
            />
          </div>
        </div>
      </div>

      {/* ── Frame nav bar — always visible ── */}
      <div className="ns-art__frame-nav">
        <button
          className="ns-art__frame-nav-btn"
          onClick={() => navigateTo(currentStrip, currentFrame - 1)}
          disabled={isPlaying || currentFrame === 0}
          title="Previous frame (Alt+←)"
        >◀</button>

        <span className="ns-art__frame-nav-label">
          Frame&nbsp;{currentFrame + 1}&nbsp;/&nbsp;{frameCount}
        </span>

        <button
          className="ns-art__frame-nav-btn"
          onClick={() => navigateTo(currentStrip, currentFrame + 1)}
          disabled={isPlaying || currentFrame === frameCount - 1}
          title="Next frame (Alt+→)"
        >▶</button>

        <button
          className="ns-art__frame-nav-btn ns-art__frame-nav-btn--add"
          onClick={addFrame}
          disabled={isPlaying}
          title="Add frame"
        >+</button>

        <div className="ns-art__frame-nav-sep" />

        <button
          className={`ns-art__frame-nav-btn ns-art__frame-nav-btn--play${isPlaying ? " ns-art__frame-nav-btn--stop" : ""}`}
          onClick={isPlaying ? stopPlay : startPlay}
          disabled={frameCount < 2}
          title={isPlaying ? "Stop playback" : "Play animation"}
        >{isPlaying ? "■" : "▶"}</button>

        <label className="ns-art__fps-label">
          fps
          <input
            className="ns-art__fps-input"
            type="number"
            min="1"
            max="60"
            value={playFps}
            onChange={e => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 1 && v <= 60) setPlayFps(v);
            }}
          />
        </label>

        {onionSkin && !isPlaying && (
          <span className="ns-art__frame-nav-onion">· onion</span>
        )}

        <span className="ns-art__frame-nav-info">
          {canvasSize.w}×{canvasSize.h}
        </span>
      </div>

      {/* ── Bottom: color pickers + palette + status ── */}
      <div className="ns-art__bottom">

        {/* Primary / secondary swatches */}
        <div className="ns-art__swatch-box">
          <div
            className="ns-art__swatch ns-art__swatch--secondary"
            style={secondaryColor !== "transparent" ? { background: secondaryColor } : undefined}
            data-transparent={secondaryColor === "transparent" || undefined}
            title="Secondary color — fills shapes, right-click palette to change"
            onClick={() => secondaryPickerRef.current?.click()}
          />
          <div
            className="ns-art__swatch ns-art__swatch--primary"
            style={primaryColor !== "transparent" ? { background: primaryColor } : undefined}
            data-transparent={primaryColor === "transparent" || undefined}
            title="Primary color — outlines & freehand, left-click palette to change"
            onClick={() => primaryPickerRef.current?.click()}
          />
          <input
            ref={primaryPickerRef}
            type="color"
            className="ns-art__hidden-picker"
            value={primaryColor !== "transparent" ? primaryColor : "#000000"}
            onChange={e => setPrimaryColor(e.target.value)}
          />
          <input
            ref={secondaryPickerRef}
            type="color"
            className="ns-art__hidden-picker"
            value={secondaryColor !== "transparent" ? secondaryColor : "#ffffff"}
            onChange={e => setSecondaryColor(e.target.value)}
          />
        </div>

        {/* Palette */}
        <div className="ns-art__palette">
          {palette.map((color, i) => (
            <button
              key={i}
              className={`ns-art__pal-swatch${color === primaryColor ? " ns-art__pal-swatch--pri" : ""}${color === secondaryColor ? " ns-art__pal-swatch--sec" : ""}`}
              style={{ background: color }}
              title={`${color}  (double-click to edit)`}
              onClick={() => setPrimaryColor(color)}
              onContextMenu={e => { e.preventDefault(); setSecondaryColor(color); }}
              onDoubleClick={() => openSwatchEditor(i)}
            />
          ))}
          <button
            className={`ns-art__pal-swatch ns-art__pal-swatch--transparent${primaryColor === "transparent" ? " ns-art__pal-swatch--pri" : ""}${secondaryColor === "transparent" ? " ns-art__pal-swatch--sec" : ""}`}
            title="Transparent / erases to alpha"
            onClick={() => setPrimaryColor("transparent")}
            onContextMenu={e => { e.preventDefault(); setSecondaryColor("transparent"); }}
          />
          <input
            ref={swatchPickerRef}
            type="color"
            className="ns-art__hidden-picker"
            onChange={onSwatchColorChange}
          />
        </div>

        <div className="ns-art__status">{status}</div>
      </div>
    </div>
  );
});

export default NsArt;
