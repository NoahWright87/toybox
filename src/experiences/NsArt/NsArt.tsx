import {
  useRef, useState, useEffect, useCallback,
  forwardRef, useImperativeHandle, useMemo,
} from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { NS_ART_BACKUP_ID } from "../NsDoors97/filesystem/types";
import "./NsArt.css";

// ── Types ──────────────────────────────────────────────────────────────────

type Tool = "brush" | "spray" | "eraser" | "fill" | "line" | "rect" | "oval" | "select";
type SelectPhase = "idle" | "selecting" | "selected" | "moving";
type ZoomLevel = 1 | 2 | 4 | 8 | 16;
type BrushShape = "square" | "round";
type FillMode = "outline" | "filled" | "both";
type AnimPanelMode = "all" | "current" | "hidden";
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
  fileId?: string;   // FS file to persist PNG data URL to on every auto-save
  fileUrl?: string;  // initial image URL to load when opening a sprite file
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
  { w:  64, h:  64 },
  { w: 100, h: 100 },
  { w: 128, h: 128 },
  { w: 200, h: 200 },
  { w: 320, h: 240 },
];

const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: "brush",  label: "🖌️", title: "Brush — left=primary, right=secondary" },
  { id: "spray",  label: "🫧",  title: "Spray Can"                              },
  { id: "eraser", label: "🧼",  title: "Eraser"                                 },
  { id: "fill",   label: "🪣",  title: "Fill"                                   },
  { id: "line",   label: "╱",  title: "Line"                                   },
  { id: "rect",   label: "▭",  title: "Rectangle"                              },
  { id: "oval",   label: "⬭",  title: "Oval"                                   },
  { id: "select", label: "⬚",  title: "Select — drag to select, then drag to move, Delete to clear" },
];

const ZOOM_IN:  Record<number, ZoomLevel> = { 1: 2, 2: 4, 4: 8,  8: 16, 16: 16 };
const ZOOM_OUT: Record<number, ZoomLevel> = { 1: 1, 2: 1, 4: 2,  8: 4,  16: 8  };
const ZOOM_LEVELS: ZoomLevel[] = [16, 8, 4, 2, 1];

const LS_KEY = "ns-art-backup";

const MINIMAP_MAX_W = 120;
const MINIMAP_MAX_H = 72;

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

function applyColor(
  ctx: CanvasRenderingContext2D,
  color: string, size: number,
  lineJoin: CanvasLineJoin = "round",
) {
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
  ctx.lineCap   = lineJoin === "miter" ? "butt" : "round";
  ctx.lineJoin  = lineJoin;
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
  const off = size === 1 ? 0.5 : 0;
  ctx.beginPath(); ctx.moveTo(x0 + off, y0 + off); ctx.lineTo(x1 + off, y1 + off); ctx.stroke();
  resetCtx(ctx);
}

function snapTo45(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } {
  const dx = x1 - x0, dy = y1 - y0;
  const angle = Math.atan2(dy, dx);
  const snap  = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const dist  = Math.sqrt(dx * dx + dy * dy);
  return { x: Math.round(x0 + dist * Math.cos(snap)), y: Math.round(y0 + dist * Math.sin(snap)) };
}

function snapToSquare(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } {
  const dx = x1 - x0, dy = y1 - y0;
  const side = Math.sign(dx) * Math.min(Math.abs(dx), Math.abs(dy));
  return { x: x0 + side, y: y0 + Math.sign(dy) * Math.abs(side) };
}

function strokeRect(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  outlineColor: string, fillColor: string,
  size: number, mode: FillMode, roundCorners: boolean,
) {
  const x = Math.min(x0, x1), y = Math.min(y0, y1);
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
  if (w <= 0 || h <= 0) return;

  if (mode === "filled" || mode === "both") {
    if (fillColor === "transparent") ctx.clearRect(x, y, w, h);
    else { ctx.fillStyle = fillColor; ctx.fillRect(x, y, w, h); }
  }

  if (mode === "outline" || mode === "both") {
    if (roundCorners) {
      applyColor(ctx, outlineColor, size, "round");
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      resetCtx(ctx);
    } else {
      const sw = size;
      const plotR = (px: number, py: number, pw: number, ph: number) => {
        if (pw <= 0 || ph <= 0) return;
        if (outlineColor === "transparent") ctx.clearRect(px, py, pw, ph);
        else { ctx.fillStyle = outlineColor; ctx.fillRect(px, py, pw, ph); }
      };
      plotR(x, y, w, sw);
      plotR(x, y + h - sw, w, sw);
      const innerH = h - 2 * sw;
      if (innerH > 0) {
        plotR(x, y + sw, sw, innerH);
        plotR(x + w - sw, y + sw, sw, innerH);
      }
    }
  }
}

function strokeOval(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  outlineColor: string, fillColor: string,
  size: number, mode: FillMode,
) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;

  if (rx < 0.5 && ry < 0.5) {
    stampPixel(ctx, Math.round(cx), Math.round(cy), outlineColor, size, "square");
    return;
  }

  const ryI = Math.max(1, Math.round(ry));
  const rxI = Math.max(1, Math.round(rx));

  if (mode === "filled" || mode === "both") {
    for (let dy = -ryI; dy <= ryI; dy++) {
      const t = ry > 0 ? dy / ry : 0;
      if (t * t > 1) continue;
      const dx = rx * Math.sqrt(1 - t * t);
      const xl = Math.round(cx - dx), xr = Math.round(cx + dx);
      const fw = xr - xl + 1;
      if (fw <= 0) continue;
      const py = Math.round(cy + dy);
      if (fillColor === "transparent") ctx.clearRect(xl, py, fw, 1);
      else { ctx.fillStyle = fillColor; ctx.fillRect(xl, py, fw, 1); }
    }
  }

  if (mode === "outline" || mode === "both") {
    for (let dy = -ryI; dy <= ryI; dy++) {
      const t = ry > 0 ? dy / ry : 0;
      if (t * t > 1) continue;
      const dx = rx * Math.sqrt(1 - t * t);
      const lx = Math.round(cx - dx), rx2 = Math.round(cx + dx);
      const py = Math.round(cy + dy);
      stampPixel(ctx, lx, py, outlineColor, size, "square");
      if (rx2 !== lx) stampPixel(ctx, rx2, py, outlineColor, size, "square");
    }
    for (let dx = -rxI; dx <= rxI; dx++) {
      const t = rx > 0 ? dx / rx : 0;
      if (t * t > 1) continue;
      const dy = ry * Math.sqrt(1 - t * t);
      const px = Math.round(cx + dx);
      const ty = Math.round(cy - dy), by = Math.round(cy + dy);
      stampPixel(ctx, px, ty, outlineColor, size, "square");
      if (by !== ty) stampPixel(ctx, px, by, outlineColor, size, "square");
    }
  }
}

// ── FrameThumbnail ─────────────────────────────────────────────────────────

function FrameThumbnail({
  data, frameW, frameH, active, onClick,
}: {
  data: ImageData | null;
  frameW: number;
  frameH: number;
  active: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const THUMB_H = 40;
  const thumbW = Math.max(1, Math.round((frameW / frameH) * THUMB_H));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (data) {
      const tmp = document.createElement("canvas");
      tmp.width = frameW; tmp.height = frameH;
      tmp.getContext("2d")!.putImageData(data, 0, 0);
      ctx.clearRect(0, 0, thumbW, THUMB_H);
      ctx.drawImage(tmp, 0, 0, thumbW, THUMB_H);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, thumbW, THUMB_H);
    }
  }, [data, frameW, frameH, thumbW]);

  return (
    <canvas
      ref={ref}
      className={`ns-art__thumb${active ? " ns-art__thumb--active" : ""}`}
      width={thumbW}
      height={THUMB_H}
      onClick={onClick}
      title={`Frame${active ? " (current)" : ""}`}
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────

const NsArt = forwardRef<NsArtHandle, NsArtProps>(function NsArt(
  { onBackupSaved, fileId, fileUrl }: NsArtProps,
  ref,
) {
  // DOM refs
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const onionCanvasRef     = useRef<HTMLCanvasElement>(null);
  const primaryPickerRef   = useRef<HTMLInputElement>(null);
  const secondaryPickerRef = useRef<HTMLInputElement>(null);
  const swatchPickerRef    = useRef<HTMLInputElement>(null);
  const stripRenameRef     = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef   = useRef<HTMLCanvasElement>(null);
  const toolLauncherRef    = useRef<HTMLDivElement>(null);

  // Drawing state
  const [tool,           setTool]          = useState<Tool>("brush");
  const [palette,        setPalette]       = useState<string[]>(() => [...DEFAULT_PALETTE]);
  const [primaryColor,   setPrimaryColor]  = useState("#000000");
  const [secondaryColor, setSecondaryColor]= useState("#ffffff");
  const [brushSize,      setBrushSize]     = useState(1);
  const [brushShape,     setBrushShape]    = useState<BrushShape>("square");
  const [fillMode,       setFillMode]      = useState<FillMode>("outline");
  const [roundCorners,   setRoundCorners]  = useState(false);
  const [zoom,           setZoom]          = useState<ZoomLevel>(1);
  const [selectRect,     setSelectRect]    = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectPhase,    setSelectPhase]   = useState<SelectPhase>("idle");
  const [canvasSize,     setCanvasSize]    = useState<CanvasSize>({ w: 100, h: 100 });
  const [confirmState,   setConfirmState]  = useState<ConfirmState | null>(null);
  const [editingSwatchIdx, setEditingSwatchIdx] = useState<number | null>(null);

  // UI state
  const [animPanelMode,   setAnimPanelMode]   = useState<AnimPanelMode>("all");
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false);
  const [dragOverStripIdx, setDragOverStripIdx] = useState<number | null>(null);
  const [showPaletteDlg, setShowPaletteDlg] = useState(false);
  const [paletteTarget, setPaletteTarget] = useState<"primary" | "secondary" | null>(null);
  const [spriteSaved, setSpriteSaved] = useState(false);

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
  const [showGrid,      setShowGrid]      = useState(false);
  const [thumbRevision, setThumbRevision] = useState(0);
  const [showSizeDlg,   setShowSizeDlg]  = useState(false);
  const [sizeInputW,    setSizeInputW]   = useState(100);
  const [sizeInputH,    setSizeInputH]   = useState(100);
  const [renamingStrip, setRenamingStrip] = useState<number | null>(null);
  const [renameValue,   setRenameValue]   = useState("");

  // Drawing refs
  const isDrawingRef        = useRef(false);
  const startRef            = useRef({ x: 0, y: 0 });
  const lastRef             = useRef({ x: 0, y: 0 });
  const snapshotRef         = useRef<ImageData | null>(null);
  const undoRef             = useRef<ImageData[]>([]);
  const sprayRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeColorRef        = useRef("#000000");
  const activeFillColorRef    = useRef("#ffffff");
  const activeSizeRef         = useRef<number>(1);
  const activeBrushShapeRef   = useRef<BrushShape>("square");
  const activeRoundCornersRef = useRef(false);
  const shiftKeyRef           = useRef(false);

  // Selection tool refs
  const selectPhaseRef       = useRef<SelectPhase>("idle");
  const selectRectRef        = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const selectionDataRef     = useRef<ImageData | null>(null);
  const preSelectionSnapRef  = useRef<ImageData | null>(null);
  const moveOffsetRef        = useRef({ x: 0, y: 0 });
  const isDirtyRef          = useRef(false);
  const saveTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spriteSaveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBackupSavedRef    = useRef(onBackupSaved);

  // Animation refs
  const framesDataRef    = useRef<(ImageData | null)[][]>([[null]]);
  const currentStripRef  = useRef(0);
  const currentFrameRef  = useRef(0);
  const frameCountRef    = useRef(1);
  const stripsRef        = useRef<Strip[]>([{ name: "Strip 1" }]);
  const isPlayingRef     = useRef(false);
  const playIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const renderOnionRef        = useRef<() => void>(() => {});
  const saveFrameRef          = useRef<() => void>(() => {});
  const loadFrameRef          = useRef<(s: number, f: number) => void>(() => {});
  const scheduleAutoSaveRef   = useRef<() => void>(() => {});
  const continueDrawingRef    = useRef<(x: number, y: number) => void>(() => {});
  const bumpThumbRef          = useRef<() => void>(() => {});
  const pendingRestoreRef     = useRef<PendingRestore | null>(null);

  // New navigation/minimap refs
  const minimapDraggingRef      = useRef(false);
  const minimapDragOffsetRef    = useRef({ x: 0, y: 0 });
  const zoomRef                 = useRef<ZoomLevel>(1);
  const pendingScrollAdjustRef  = useRef<{ canvasX: number; canvasY: number; cursorX: number; cursorY: number } | null>(null);
  const containerSizeRef        = useRef({ w: 0, h: 0 });
  const renderMinimapRef        = useRef<() => void>(() => {});

  const fileIdRef = useRef(fileId);
  useEffect(() => { onBackupSavedRef.current = onBackupSaved; }, [onBackupSaved]);
  useEffect(() => { fileIdRef.current = fileId; }, [fileId]);
  useEffect(() => { currentStripRef.current  = currentStrip;  }, [currentStrip]);
  useEffect(() => { currentFrameRef.current  = currentFrame;  }, [currentFrame]);
  useEffect(() => { frameCountRef.current    = frameCount;    }, [frameCount]);
  useEffect(() => { stripsRef.current        = strips;        }, [strips]);
  useEffect(() => { isPlayingRef.current     = isPlaying;     }, [isPlaying]);
  useEffect(() => { zoomRef.current          = zoom;          }, [zoom]);

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

  // ── Export helpers ─────────────────────────────────────────────────────

  const exportCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    saveFrameRef.current();
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `ns-art-s${currentStripRef.current + 1}-f${currentFrameRef.current + 1}.png`;
    a.click();
    isDirtyRef.current = false;
  }, []);

  useImperativeHandle(ref, () => ({
    requestClose: (proceed) => {
      if (isDirtyRef.current) {
        if (fileIdRef.current) {
          // Sprite edit mode: save directly to FS file
          setConfirmState({
            title: "NS Art",
            message: "Save changes to this sprite?",
            buttons: [
              { label: "Save", primary: true, onClick: () => {
                const canvas = canvasRef.current;
                if (canvas) {
                  saveFrameRef.current();
                  const frame = framesDataRef.current[currentStripRef.current]?.[currentFrameRef.current];
                  if (frame) {
                    const tmp = document.createElement("canvas");
                    tmp.width = canvas.width; tmp.height = canvas.height;
                    tmp.getContext("2d")!.putImageData(frame, 0, 0);
                    fsStore.writeFile(fileIdRef.current!, tmp.toDataURL("image/png"));
                  }
                }
                proceed(); setConfirmState(null);
              }},
              { label: "Discard changes", onClick: () => { proceed(); setConfirmState(null); } },
              { label: "Cancel",          onClick: () => setConfirmState(null) },
            ],
          });
        } else {
          setConfirmState({
            title: "NS Art",
            message: "Your artwork has unsaved changes.",
            buttons: [
              { label: "Export PNG", primary: true, onClick: () => { exportCurrentFrame(); proceed(); setConfirmState(null); } },
              { label: "Close without saving",      onClick: () => { proceed(); setConfirmState(null); } },
              { label: "Cancel",                    onClick: () => setConfirmState(null) },
            ],
          });
        }
      } else {
        proceed();
      }
    },
  }), [exportCurrentFrame]);

  // ── Init canvas ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    undoRef.current = [];
    isDirtyRef.current = false;

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

  // ── Load backup / sprite file ───────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => {
      if (fileId) {
        // Sprite edit mode: load from FS file content (user's override) or bundled URL
        const fsContent = fsStore.getFile(fileId)?.content;
        const sourceUrl = fsContent || fileUrl;
        if (!sourceUrl || !canvasRef.current) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const w = img.naturalWidth || 64;
          const h = img.naturalHeight || 64;
          const tmp = document.createElement("canvas");
          tmp.width = w; tmp.height = h;
          const tmpCtx = tmp.getContext("2d")!;
          tmpCtx.drawImage(img, 0, 0);
          const imageData = tmpCtx.getImageData(0, 0, w, h);
          const canvas = canvasRef.current;
          if (!canvas) return;
          const pending: PendingRestore = {
            strips: [{ name: "Sprite" }],
            frames: [[imageData]],
            frameCount: 1,
            frameW: w,
            frameH: h,
          };
          if (canvas.width === w && canvas.height === h) {
            framesDataRef.current      = [[imageData]];
            stripsRef.current          = [{ name: "Sprite" }];
            frameCountRef.current      = 1;
            currentStripRef.current    = 0;
            currentFrameRef.current    = 0;
            setStrips([{ name: "Sprite" }]);
            setFrameCount(1);
            setCurrentStrip(0);
            setCurrentFrame(0);
            canvas.getContext("2d")!.putImageData(imageData, 0, 0);
            isDirtyRef.current = false;
            renderOnionRef.current();
          } else {
            pendingRestoreRef.current = pending;
            setCanvasSize({ w, h });
          }
        };
        img.onerror = () => {};
        img.src = sourceUrl;
        return;
      }

      // Normal backup mode: prefer FS backup; fall back to legacy localStorage
      const fsContent = fsStore.getFile(NS_ART_BACKUP_ID)?.content;
      const legacy = !fsContent ? localStorage.getItem(LS_KEY) : null;
      if (legacy) {
        fsStore.writeFile(NS_ART_BACKUP_ID, legacy);
        localStorage.removeItem(LS_KEY);
      }
      const raw = fsContent || legacy;
      if (!raw || !canvasRef.current) return;
      try {
        const backup = JSON.parse(raw);
        if (backup.version !== 2) return;
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
            pendingRestoreRef.current = pending;
            setCanvasSize({ w: frameW, h: frameH });
          }
        });
      } catch { /* corrupt */ }
    }, 100);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save ──────────────────────────────────────────────────────────

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      saveFrameRef.current();

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

      // Save current frame as PNG data URL to the target FS file (sprite edit mode)
      if (fileIdRef.current) {
        const currentUrl = framesUrls[currentStripRef.current]?.[currentFrameRef.current];
        if (currentUrl) {
          fsStore.writeFile(fileIdRef.current, currentUrl);
          isDirtyRef.current = false; // auto-save is complete
          if (spriteSaveTimerRef.current) clearTimeout(spriteSaveTimerRef.current);
          setSpriteSaved(true);
          spriteSaveTimerRef.current = setTimeout(() => setSpriteSaved(false), 2500);
        }
      }

      try {
        fsStore.writeFile(NS_ART_BACKUP_ID, JSON.stringify({
          version: 2,
          frameW: fw,
          frameH: fh,
          strips: stripsRef.current,
          frames: framesUrls,
        }));
        onBackupSavedRef.current?.();
      } catch { /* storage full */ }
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
    renderMinimapRef.current();
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
    bumpThumbRef.current();
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
        if (r > 240 && g > 240 && b > 240) { d[i+3] = 0; continue; }
        if (delta < 0) {
          d[i+1] = Math.floor(g * 0.15);
          d[i+2] = Math.floor(b * 0.15);
        } else {
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

  const insertFrame = useCallback((afterIdx: number) => {
    if (isPlayingRef.current) return;
    saveFrameRef.current();
    const insertAt = afterIdx + 1;
    const newCount = frameCountRef.current + 1;
    for (const row of framesDataRef.current) row.splice(insertAt, 0, null);
    frameCountRef.current  = newCount;
    currentFrameRef.current = insertAt;
    setFrameCount(newCount);
    setCurrentFrame(insertAt);
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

  const deleteFrame = useCallback((frameIdxParam?: number) => {
    if (isPlayingRef.current || frameCountRef.current <= 1) return;
    const frame    = frameIdxParam ?? currentFrameRef.current;
    for (const row of framesDataRef.current) row.splice(frame, 1);
    const newCount = frameCountRef.current - 1;
    const newFrame = Math.min(currentFrameRef.current, newCount - 1);
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

  const deleteStrip = useCallback((stripIdxParam?: number) => {
    if (isPlayingRef.current || stripsRef.current.length <= 1) return;
    const strip     = stripIdxParam ?? currentStripRef.current;
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

  const reorderStrip = useCallback((from: number, to: number) => {
    if (from === to) return;
    saveFrameRef.current();
    const ns = [...stripsRef.current];
    const nf = [...framesDataRef.current];
    const [ms] = ns.splice(from, 1);
    const [mf] = nf.splice(from, 1);
    ns.splice(to, 0, ms);
    nf.splice(to, 0, mf);
    stripsRef.current = ns;
    framesDataRef.current = nf;
    setStrips(ns);
    const curr = currentStripRef.current;
    let newCurr = curr;
    if (curr === from) newCurr = to;
    else if (from < curr && curr <= to) newCurr = curr - 1;
    else if (to <= curr && curr < from) newCurr = curr + 1;
    currentStripRef.current = newCurr;
    setCurrentStrip(newCurr);
    isDirtyRef.current = true;
    scheduleAutoSaveRef.current();
  }, []);

  // ── New canvas ─────────────────────────────────────────────────────────

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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Shift") {
        shiftKeyRef.current = true;
        if (isDrawingRef.current) continueDrawingRef.current(lastRef.current.x, lastRef.current.y);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      if (e.altKey && e.key === "ArrowLeft")  { e.preventDefault(); navigateTo(currentStripRef.current, currentFrameRef.current - 1); }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); navigateTo(currentStripRef.current, currentFrameRef.current + 1); }

      if ((e.key === "Delete" || e.key === "Backspace") && selectPhaseRef.current === "selected") {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || !selectRectRef.current) return;
        const sel = selectRectRef.current;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(sel.x, sel.y, sel.w, sel.h);
        selectionDataRef.current   = null;
        preSelectionSnapRef.current = null;
        selectRectRef.current  = null;
        selectPhaseRef.current = "idle";
        setSelectRect(null);
        setSelectPhase("idle");
        isDirtyRef.current = true;
      }
      if (e.key === "Escape") {
        const phase = selectPhaseRef.current;
        if (phase === "moving" && preSelectionSnapRef.current && selectionDataRef.current) {
          e.preventDefault();
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.getContext("2d")!.putImageData(preSelectionSnapRef.current, 0, 0);
          selectPhaseRef.current = "selected";
          setSelectPhase("selected");
        } else if (phase === "selected") {
          e.preventDefault();
          selectRectRef.current  = null;
          selectPhaseRef.current = "idle";
          setSelectRect(null);
          setSelectPhase("idle");
          selectionDataRef.current   = null;
          preSelectionSnapRef.current = null;
        }
        setIsToolPickerOpen(false);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift") {
        shiftKeyRef.current = false;
        if (isDrawingRef.current) continueDrawingRef.current(lastRef.current.x, lastRef.current.y);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
    };
  }, [undo, navigateTo]);

  // ── Before-unload guard ───────────────────────────────────────────────

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) { e.preventDefault(); }
    };
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

    const strokeColor = isSecondary ? secondaryColor : primaryColor;

    if (tool === "fill") {
      pushUndo();
      floodFill(ctx, x, y, strokeColor);
      isDirtyRef.current = true;
      scheduleAutoSave();
      renderOnionRef.current();
      renderMinimapRef.current();
      return;
    }

    if (tool === "select") {
      const sel = selectRectRef.current;
      const phase = selectPhaseRef.current;
      if (phase === "selected" && sel && x >= sel.x && x < sel.x + sel.w && y >= sel.y && y < sel.y + sel.h) {
        selectPhaseRef.current = "moving";
        setSelectPhase("moving");
        moveOffsetRef.current = { x: x - sel.x, y: y - sel.y };
        isDrawingRef.current = true;
        startRef.current = { x, y };
        lastRef.current  = { x, y };
        if (!selectionDataRef.current) {
          selectionDataRef.current = ctx.getImageData(sel.x, sel.y, sel.w, sel.h);
        }
        ctx.clearRect(sel.x, sel.y, sel.w, sel.h);
        preSelectionSnapRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } else {
        if (phase === "moving" || phase === "selected") {
          const prevSel = selectRectRef.current;
          if (phase === "moving" && selectionDataRef.current && prevSel) {
            ctx.putImageData(selectionDataRef.current, prevSel.x, prevSel.y);
          }
          selectionDataRef.current   = null;
          preSelectionSnapRef.current = null;
          selectRectRef.current  = null;
          selectPhaseRef.current = "idle";
          setSelectRect(null);
          setSelectPhase("idle");
          isDirtyRef.current = true;
          scheduleAutoSave();
          renderOnionRef.current();
        }
        pushUndo();
        isDrawingRef.current = true;
        selectPhaseRef.current = "selecting";
        setSelectPhase("selecting");
        startRef.current = { x, y };
        lastRef.current  = { x, y };
        selectRectRef.current = null;
        setSelectRect(null);
      }
      return;
    }

    pushUndo();
    isDrawingRef.current = true;
    startRef.current = { x, y };
    lastRef.current  = { x, y };

    if (tool !== "line" && tool !== "rect" && tool !== "oval") {
      snapshotRef.current = null;
    } else {
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    if (tool === "brush") {
      stampPixel(ctx, x, y, strokeColor, brushSize, brushShape);
    } else if (tool === "eraser") {
      stampPixel(ctx, x, y, "transparent", brushSize, brushShape);
    } else if (tool === "spray") {
      activeColorRef.current = strokeColor;
      activeSizeRef.current  = brushSize;
      const doSpray = (canvas: HTMLCanvasElement, cx: number, cy: number, color: string, radius: number) => {
        const ctx = canvas.getContext("2d")!;
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * 2 * Math.PI;
          const r = Math.random() * radius;
          stampPixel(ctx, Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), color, 1, "square");
        }
      };
      sprayRef.current = setInterval(() => {
        doSpray(canvas, lastRef.current.x, lastRef.current.y, activeColorRef.current, activeSizeRef.current);
      }, 50);
    }

    activeColorRef.current        = strokeColor;
    activeFillColorRef.current    = isSecondary ? primaryColor : secondaryColor;
    activeSizeRef.current         = brushSize;
    activeBrushShapeRef.current   = brushShape;
    activeRoundCornersRef.current = roundCorners;
  }, [tool, brushSize, brushShape, primaryColor, secondaryColor, roundCorners, fillMode, pushUndo, scheduleAutoSave]);

  const doSpray = useCallback((canvas: HTMLCanvasElement, cx: number, cy: number, color: string, radius: number) => {
    const ctx = canvas.getContext("2d")!;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 2 * Math.PI;
      const r = Math.random() * radius;
      stampPixel(ctx, Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), color, 1, "square");
    }
  }, []);

  const continueDrawing = useCallback((x: number, y: number) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx   = canvas.getContext("2d")!;
    const color = activeColorRef.current;
    const size  = activeSizeRef.current;
    const shape = activeBrushShapeRef.current;
    const rc    = activeRoundCornersRef.current;
    const fillCol = activeFillColorRef.current;

    if (tool === "select") {
      const phase = selectPhaseRef.current;
      if (phase === "selecting") {
        const { x: sx, y: sy } = startRef.current;
        const rx = Math.min(sx, x), ry = Math.min(sy, y);
        const rw = Math.abs(x - sx), rh = Math.abs(y - sy);
        selectRectRef.current = { x: rx, y: ry, w: rw, h: rh };
        setSelectRect({ x: rx, y: ry, w: rw, h: rh });
      } else if (phase === "moving" && selectionDataRef.current && preSelectionSnapRef.current && selectRectRef.current) {
        const off = moveOffsetRef.current;
        const sel = selectRectRef.current;
        const nx = x - off.x, ny = y - off.y;
        ctx.putImageData(preSelectionSnapRef.current, 0, 0);
        ctx.putImageData(selectionDataRef.current, nx, ny);
        selectRectRef.current = { ...sel, x: nx, y: ny };
        setSelectRect({ ...sel, x: nx, y: ny });
      }
      lastRef.current = { x, y };
      return;
    }

    if (tool === "brush") {
      bresenhamLine(ctx, lastRef.current.x, lastRef.current.y, x, y, color, size, shape);
    } else if (tool === "eraser") {
      bresenhamLine(ctx, lastRef.current.x, lastRef.current.y, x, y, "transparent", size, shape);
    } else if (tool === "spray") {
      doSpray(canvas, x, y, color, brushSize);
    } else if (snapshotRef.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
      const { x: sx, y: sy } = startRef.current;
      const shift = shiftKeyRef.current;
      let ex = x, ey = y;
      if (shift && tool === "line") { const s = snapTo45(sx, sy, x, y); ex = s.x; ey = s.y; }
      if (shift && tool === "rect") { const s = snapToSquare(sx, sy, x, y); ex = s.x; ey = s.y; }
      if (tool === "line")      strokeLine(ctx, sx, sy, ex, ey, color, size);
      else if (tool === "rect") strokeRect(ctx, sx, sy, ex, ey, color, fillCol, size, fillMode, rc);
      else if (tool === "oval") strokeOval(ctx, sx, sy, ex, ey, color, fillCol, size, fillMode);
    }
    lastRef.current = { x, y };
  }, [tool, brushSize, fillMode, doSpray]);

  useEffect(() => { continueDrawingRef.current = continueDrawing; }, [continueDrawing]);
  useEffect(() => { bumpThumbRef.current = () => setThumbRevision(v => v + 1); }, []);

  const endDrawing = useCallback((x: number, y: number) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (sprayRef.current) { clearInterval(sprayRef.current); sprayRef.current = null; }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx     = canvas.getContext("2d")!;

    if (tool === "select") {
      const phase = selectPhaseRef.current;
      if (phase === "selecting") {
        const { x: sx, y: sy } = startRef.current;
        const rx = Math.min(sx, x), ry = Math.min(sy, y);
        const rw = Math.abs(x - sx), rh = Math.abs(y - sy);
        if (rw > 0 && rh > 0) {
          const finalRect = { x: rx, y: ry, w: rw, h: rh };
          selectRectRef.current  = finalRect;
          selectPhaseRef.current = "selected";
          setSelectRect(finalRect);
          setSelectPhase("selected");
          selectionDataRef.current   = ctx.getImageData(rx, ry, rw, rh);
          preSelectionSnapRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } else {
          selectRectRef.current  = null;
          selectPhaseRef.current = "idle";
          setSelectRect(null);
          setSelectPhase("idle");
        }
      } else if (phase === "moving") {
        selectPhaseRef.current = "selected";
        setSelectPhase("selected");
        preSelectionSnapRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        isDirtyRef.current = true;
        scheduleAutoSave();
        renderOnionRef.current();
      }
      return;
    }

    const color   = activeColorRef.current;
    const fillCol = activeFillColorRef.current;
    const size    = activeSizeRef.current;
    const rc      = activeRoundCornersRef.current;

    if (snapshotRef.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
      const { x: sx, y: sy } = startRef.current;
      const shift = shiftKeyRef.current;
      let ex = x, ey = y;
      if (shift && tool === "line") { const s = snapTo45(sx, sy, x, y); ex = s.x; ey = s.y; }
      if (shift && tool === "rect") { const s = snapToSquare(sx, sy, x, y); ex = s.x; ey = s.y; }
      if (tool === "line")      strokeLine(ctx, sx, sy, ex, ey, color, size);
      else if (tool === "rect") strokeRect(ctx, sx, sy, ex, ey, color, fillCol, size, fillMode, rc);
      else if (tool === "oval") strokeOval(ctx, sx, sy, ex, ey, color, fillCol, size, fillMode);
      snapshotRef.current = null;
    }

    isDirtyRef.current = true;
    scheduleAutoSave();
    renderOnionRef.current();
    saveFrameRef.current();
    bumpThumbRef.current();
    renderMinimapRef.current();
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
    continueDrawing(
      Math.floor((t.clientX - rect.left) / zoom),
      Math.floor((t.clientY - rect.top)  / zoom),
    );
  }, [continueDrawing, zoom]);

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const t    = e.changedTouches[0];
    endDrawing(
      Math.floor((t.clientX - rect.left) / zoom),
      Math.floor((t.clientY - rect.top)  / zoom),
    );
  }, [endDrawing, zoom]);

  // ── Mini-map ──────────────────────────────────────────────────────────

  const renderMinimap = useCallback(() => {
    const mmCanvas = minimapCanvasRef.current;
    const mainCanvas = canvasRef.current;
    const container = scrollContainerRef.current;
    if (!mmCanvas || !mainCanvas || !container) return;

    const fw = canvasSize.w, fh = canvasSize.h;
    const mmScale = Math.min(MINIMAP_MAX_W / fw, MINIMAP_MAX_H / fh);
    const mmW = Math.max(1, Math.round(fw * mmScale));
    const mmH = Math.max(1, Math.round(fh * mmScale));

    if (mmCanvas.width !== mmW || mmCanvas.height !== mmH) {
      mmCanvas.width = mmW;
      mmCanvas.height = mmH;
    }

    const ctx = mmCanvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, mmW, mmH);
    ctx.drawImage(mainCanvas, 0, 0, mmW, mmH);

    // Draw orange viewport rect only when scrollable
    const cW = container.clientWidth, cH = container.clientHeight;
    if (fw * zoom > cW || fh * zoom > cH) {
      const rx = (container.scrollLeft / zoom) * mmScale;
      const ry = (container.scrollTop  / zoom) * mmScale;
      const rw = (cW / zoom) * mmScale;
      const rh = (cH / zoom) * mmScale;
      ctx.strokeStyle = "#ff6b00";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.max(0, rx) + 0.5,
        Math.max(0, ry) + 0.5,
        Math.min(rw - 1, mmW - Math.max(0, rx) - 1),
        Math.min(rh - 1, mmH - Math.max(0, ry) - 1),
      );
    }
  }, [canvasSize, zoom]);

  useEffect(() => { renderMinimapRef.current = renderMinimap; }, [renderMinimap]);
  useEffect(() => { renderMinimapRef.current(); }, [renderMinimap]);

  // ── Wheel zoom (ctrl/meta = zoom, plain = pan) ────────────────────────

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const oldZoom = zoomRef.current;
        const newZoom = e.deltaY < 0 ? ZOOM_IN[oldZoom] : ZOOM_OUT[oldZoom];
        if (newZoom === oldZoom) return;
        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const canvasX = (container.scrollLeft + cursorX) / oldZoom;
        const canvasY = (container.scrollTop  + cursorY) / oldZoom;
        pendingScrollAdjustRef.current = { canvasX, canvasY, cursorX, cursorY };
        setZoom(newZoom);
      }
    };
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cursor-centered scroll adjust after zoom state settles
  useEffect(() => {
    const container = scrollContainerRef.current;
    const adj = pendingScrollAdjustRef.current;
    if (!container || !adj) return;
    pendingScrollAdjustRef.current = null;
    container.scrollLeft = Math.max(0, adj.canvasX * zoom - adj.cursorX);
    container.scrollTop  = Math.max(0, adj.canvasY * zoom - adj.cursorY);
  }, [zoom]);

  // Scroll events → update minimap viewport rect
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handler = () => renderMinimapRef.current();
    container.addEventListener("scroll", handler, { passive: true });
    return () => container.removeEventListener("scroll", handler);
  }, []);

  // Container size changes (for fit-zoom)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      containerSizeRef.current = { w: width, h: height };
      renderMinimapRef.current();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const fitCanvas = useCallback(() => {
    const { w: cw, h: ch } = containerSizeRef.current;
    if (!cw || !ch) return;
    const best = ZOOM_LEVELS.find(z => canvasSize.w * z <= cw && canvasSize.h * z <= ch) ?? 1;
    setZoom(best);
    const container = scrollContainerRef.current;
    if (container) { container.scrollLeft = 0; container.scrollTop = 0; }
  }, [canvasSize]);

  // ── Mini-map pointer (drag to pan) ────────────────────────────────────

  const scrollToMinimapPoint = useCallback((clientX: number, clientY: number) => {
    const mmCanvas = minimapCanvasRef.current;
    const container = scrollContainerRef.current;
    if (!mmCanvas || !container || !mmCanvas.width) return;
    const rect = mmCanvas.getBoundingClientRect();
    const mx = ((clientX - rect.left) / rect.width) * mmCanvas.width;
    const my = ((clientY - rect.top)  / rect.height) * mmCanvas.height;
    const mmScale = mmCanvas.width / canvasSize.w;
    const canvasX = mx / mmScale - minimapDragOffsetRef.current.x;
    const canvasY = my / mmScale - minimapDragOffsetRef.current.y;
    const viewW = container.clientWidth  / zoom;
    const viewH = container.clientHeight / zoom;
    container.scrollLeft = Math.max(0, (canvasX - viewW / 2) * zoom);
    container.scrollTop  = Math.max(0, (canvasY - viewH / 2) * zoom);
  }, [canvasSize, zoom]);

  const handleMinimapPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    minimapDraggingRef.current = true;
    // Compute offset so dragging moves the viewport rect, not snapping its center
    const mmCanvas = minimapCanvasRef.current;
    const container = scrollContainerRef.current;
    if (mmCanvas && container && mmCanvas.width) {
      const rect = mmCanvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * mmCanvas.width;
      const my = ((e.clientY - rect.top)  / rect.height) * mmCanvas.height;
      const mmScale = mmCanvas.width / canvasSize.w;
      const clickCanvasX = mx / mmScale;
      const clickCanvasY = my / mmScale;
      const viewCenterX = (container.scrollLeft + container.clientWidth  / 2) / zoom;
      const viewCenterY = (container.scrollTop  + container.clientHeight / 2) / zoom;
      minimapDragOffsetRef.current = {
        x: clickCanvasX - viewCenterX,
        y: clickCanvasY - viewCenterY,
      };
    } else {
      minimapDragOffsetRef.current = { x: 0, y: 0 };
    }
    scrollToMinimapPoint(e.clientX, e.clientY);
  }, [scrollToMinimapPoint, canvasSize, zoom]);

  const handleMinimapPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!minimapDraggingRef.current) return;
    scrollToMinimapPoint(e.clientX, e.clientY);
  }, [scrollToMinimapPoint]);

  const handleMinimapPointerUp = useCallback(() => {
    minimapDraggingRef.current = false;
  }, []);

  // ── Tool picker close on outside click ────────────────────────────────

  useEffect(() => {
    if (!isToolPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (!toolLauncherRef.current?.contains(e.target as Node)) {
        setIsToolPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isToolPickerOpen]);

  // ── Menu bar ──────────────────────────────────────────────────────────

  const artMenus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "File",
      items: [
        { label: "New", onClick: newCanvas },
        { separator: true },
        { label: "Export Current Frame",    onClick: exportCurrentFrame },
        { label: "Export Sprite Sheet PNG", onClick: exportSpriteSheet  },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo  Ctrl+Z", onClick: undo },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Fit Canvas", onClick: fitCanvas },
        { separator: true },
        { label: "Zoom In",  onClick: () => setZoom(z => ZOOM_IN[z]),  disabled: zoom >= 16 },
        { label: "Zoom Out", onClick: () => setZoom(z => ZOOM_OUT[z]), disabled: zoom <= 1  },
        { separator: true },
        { label: "Pixel Grid", checked: showGrid, onClick: () => setShowGrid(v => !v) },
      ],
    },
    {
      label: "Format",
      items: [
        { label: "Canvas Size...", onClick: () => { setSizeInputW(canvasSize.w); setSizeInputH(canvasSize.h); setShowSizeDlg(true); } },
      ],
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
        { separator: true },
        { label: "FPS: 4",  checked: playFps === 4,  onClick: () => setPlayFps(4)  },
        { label: "FPS: 8",  checked: playFps === 8,  onClick: () => setPlayFps(8)  },
        { label: "FPS: 12", checked: playFps === 12, onClick: () => setPlayFps(12) },
        { label: "FPS: 15", checked: playFps === 15, onClick: () => setPlayFps(15) },
        { label: "FPS: 24", checked: playFps === 24, onClick: () => setPlayFps(24) },
        { separator: true },
        { label: "Show: All Strips",    checked: animPanelMode === "all",     onClick: () => setAnimPanelMode("all")     },
        { label: "Show: Current Strip", checked: animPanelMode === "current", onClick: () => setAnimPanelMode("current") },
        { label: "Show: None",          checked: animPanelMode === "hidden",  onClick: () => setAnimPanelMode("hidden")  },
      ],
    },
  ], [
    newCanvas, exportCurrentFrame, exportSpriteSheet, undo,
    fitCanvas, zoom, showGrid,
    addFrame, deleteFrame, frameCount,
    addStrip, deleteStrip, strips, currentStrip,
    onionSkin, onionOpacity, onionRange,
    playFps, animPanelMode,
  ]);

  useWindowMenus(artMenus);

  const showFillMode    = tool === "rect" || tool === "oval";
  const showBrushShape  = tool === "brush" || tool === "eraser";
  const showRoundCorner = tool === "rect";
  const gridActive      = showGrid && zoom >= 4;
  const currentToolDef  = TOOLS.find(t => t.id === tool)!;

  // ── Rename strip helpers ──────────────────────────────────────────────

  const commitRename = useCallback(() => {
    if (renamingStrip === null) return;
    const trimmed = renameValue.trim() || `Strip ${renamingStrip + 1}`;
    const updated = stripsRef.current.map((s, i) => i === renamingStrip ? { ...s, name: trimmed } : s);
    setStrips(updated);
    stripsRef.current = updated;
    setRenamingStrip(null);
  }, [renamingStrip, renameValue]);

  // ── Displayed strips in anim panel ────────────────────────────────────

  const displayedStrips: [number, Strip][] = animPanelMode === "all"
    ? strips.map((s, i) => [i, s] as [number, Strip])
    : strips[currentStrip] ? [[currentStrip, strips[currentStrip]] as [number, Strip]] : [];

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

      {/* ── Canvas size dialog ── */}
      {showSizeDlg && (
        <div className="ns-art__overlay">
          <div className="ns-art__dialog ns-art__dialog--size">
            <div className="ns-art__dialog-titlebar"><span>Canvas Size</span></div>
            <div className="ns-art__dialog-body">
              <div className="ns-art__size-presets">
                {CANVAS_PRESETS.map(p => (
                  <button
                    key={`${p.w}x${p.h}`}
                    className={`ns-art__size-preset${sizeInputW === p.w && sizeInputH === p.h ? " ns-art__size-preset--active" : ""}`}
                    onClick={() => { setSizeInputW(p.w); setSizeInputH(p.h); }}
                  >{p.w}×{p.h}</button>
                ))}
              </div>
              <div className="ns-art__size-custom">
                <label className="ns-art__size-label">W
                  <input className="ns-art__size-input" type="number" min="1" max="2048"
                    value={sizeInputW}
                    onChange={e => setSizeInputW(Math.max(1, Math.min(2048, parseInt(e.target.value) || 1)))}
                  />
                </label>
                <label className="ns-art__size-label">H
                  <input className="ns-art__size-input" type="number" min="1" max="2048"
                    value={sizeInputH}
                    onChange={e => setSizeInputH(Math.max(1, Math.min(2048, parseInt(e.target.value) || 1)))}
                  />
                </label>
              </div>
            </div>
            <div className="ns-art__dialog-btns">
              <button className="ns-art__dialog-btn ns-art__dialog-btn--primary"
                onClick={() => { setShowSizeDlg(false); handleSizeSelect({ w: sizeInputW, h: sizeInputH }); }}>OK</button>
              <button className="ns-art__dialog-btn" onClick={() => setShowSizeDlg(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Palette picker dialog ── */}
      {showPaletteDlg && (
        <div className="ns-art__overlay" onClick={() => setShowPaletteDlg(false)}>
          <div className="ns-art__dialog ns-art__palette-dlg" onClick={e => e.stopPropagation()}>
            <div className="ns-art__dialog-titlebar">
              <span className="ns-art__dialog-icon">🎨</span>
              <span>Choose Colors</span>
            </div>
            <div className="ns-art__dialog-body">

              {/* Primary / Secondary slots */}
              <p className="ns-art__pal-hint">Tap a slot, then pick a color below</p>
              <div className="ns-art__pal-active-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                <button
                  className={`ns-art__pal-active-cell ns-art__pal-active-cell--labeled${paletteTarget === "primary" ? " ns-art__pal-active-cell--sel" : ""}`}
                  style={primaryColor !== "transparent" ? { background: primaryColor } : undefined}
                  data-transparent={primaryColor === "transparent" || undefined}
                  onClick={() => setPaletteTarget(t => t === "primary" ? null : "primary")}
                  title="Primary color (1)"
                ><span className="ns-art__pal-slot-label">1</span></button>
                <button
                  className={`ns-art__pal-active-cell ns-art__pal-active-cell--labeled${paletteTarget === "secondary" ? " ns-art__pal-active-cell--sel" : ""}`}
                  style={secondaryColor !== "transparent" ? { background: secondaryColor } : undefined}
                  data-transparent={secondaryColor === "transparent" || undefined}
                  onClick={() => setPaletteTarget(t => t === "secondary" ? null : "secondary")}
                  title="Secondary color (2)"
                ><span className="ns-art__pal-slot-label">2</span></button>
              </div>

              {/* Full palette */}
              <p className="ns-art__pal-hint">{paletteTarget !== null ? "Tap a color to assign" : "Tap a slot above first"}{"\n"}(double-tap any color to edit it)</p>
              <div className="ns-art__pal-full-grid">
                {palette.map((color, i) => (
                  <button
                    key={i}
                    className={`ns-art__pal-full-cell${paletteTarget !== null ? " ns-art__pal-full-cell--assignable" : ""}`}
                    style={{ background: color }}
                    onClick={() => {
                      if (paletteTarget === null) return;
                      if (paletteTarget === "primary") setPrimaryColor(color);
                      else setSecondaryColor(color);
                      setPaletteTarget(null);
                    }}
                    onDoubleClick={() => openSwatchEditor(i)}
                    title={`${color}${paletteTarget !== null ? " — tap to assign" : ""}\ndouble-tap to edit`}
                  />
                ))}
                <button
                  className={`ns-art__pal-full-cell ns-art__pal-full-cell--transparent${paletteTarget !== null ? " ns-art__pal-full-cell--assignable" : ""}`}
                  onClick={() => {
                    if (paletteTarget === null) return;
                    if (paletteTarget === "primary") setPrimaryColor("transparent");
                    else setSecondaryColor("transparent");
                    setPaletteTarget(null);
                  }}
                  title="Transparent"
                />
              </div>

            </div>
            <div className="ns-art__dialog-btns">
              <button className="ns-art__dialog-btn ns-art__dialog-btn--primary" onClick={() => setShowPaletteDlg(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Animation panel ── */}
      <div className="ns-art__anim-panel">
        <div className="ns-art__anim-body" data-rev={thumbRevision}>

          {/* Strips area — hidden when animPanelMode === "hidden" */}
          {animPanelMode !== "hidden" && (
            <div className="ns-art__anim-strips">
              {displayedStrips.map(([si, strip]) => {
                const isFirstRow = si === displayedStrips[0]?.[0];
                return (
                  <div
                    key={si}
                    className={`ns-art__strip-row${dragOverStripIdx === si ? " ns-art__strip-row--over" : ""}`}
                    onDragOver={animPanelMode === "all" ? (e) => { e.preventDefault(); setDragOverStripIdx(si); } : undefined}
                    onDragLeave={animPanelMode === "all" ? () => setDragOverStripIdx(null) : undefined}
                    onDrop={animPanelMode === "all" ? (e) => {
                      e.preventDefault();
                      const from = parseInt(e.dataTransfer.getData("strip-idx"));
                      if (!isNaN(from)) reorderStrip(from, si);
                      setDragOverStripIdx(null);
                    } : undefined}
                  >
                    {animPanelMode === "all" && (
                      <div
                        className="ns-art__strip-handle"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("strip-idx", String(si))}
                        title="Drag to reorder"
                      >⠿</div>
                    )}

                    <div className="ns-art__strip-name-cell">
                      {renamingStrip === si ? (
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
                        <span
                          className={`ns-art__strip-name${currentStrip === si ? " ns-art__strip-name--active" : ""}`}
                          onClick={() => navigateTo(si, currentFrame)}
                          onDoubleClick={() => {
                            setRenamingStrip(si);
                            setRenameValue(strip.name);
                            setTimeout(() => stripRenameRef.current?.focus(), 20);
                          }}
                          title={`${strip.name} · double-click to rename`}
                        >{strip.name}</span>
                      )}
                    </div>

                    <div className="ns-art__strip-frames">
                      {Array.from({ length: frameCount }, (_, fi) => (
                        <span key={fi} className={`ns-art__frame-slot${isFirstRow ? " ns-art__frame-slot--top" : ""}`}>
                          {isFirstRow && frameCount > 1 && (
                            <button
                              className="ns-art__del-frame-btn"
                              onClick={() => deleteFrame(fi)}
                              disabled={isPlaying}
                              title={`Delete frame ${fi + 1} (all strips)`}
                            >−</button>
                          )}
                          <div className="ns-art__frame-thumb-row">
                            <FrameThumbnail
                              data={framesDataRef.current[si]?.[fi] ?? null}
                              frameW={canvasSize.w}
                              frameH={canvasSize.h}
                              active={currentStrip === si && currentFrame === fi}
                              onClick={() => navigateTo(si, fi)}
                            />
                            {fi < frameCount - 1 && (
                              <div className="ns-art__frame-insert">
                                <button
                                  className="ns-art__frame-insert-btn"
                                  onClick={() => insertFrame(fi)}
                                  title="Insert frame here"
                                >+</button>
                              </div>
                            )}
                          </div>
                        </span>
                      ))}
                      <button
                        className="ns-art__add-frame-end"
                        onClick={addFrame}
                        disabled={isPlaying}
                        title="Add frame at end"
                      >+</button>
                    </div>

                    {/* Delete strip */}
                    <button
                      className="ns-art__del-strip-btn"
                      onClick={() => deleteStrip(si)}
                      disabled={isPlaying || strips.length <= 1}
                      title={`Delete strip "${strip.name}"`}
                    >−</button>
                  </div>
                );
              })}

              {animPanelMode === "all" && (
                <button className="ns-art__add-strip-btn" onClick={addStrip} disabled={isPlaying}>
                  + Add Strip
                </button>
              )}
            </div>
          )}

          {/* Right sidebar: play + collapse */}
          <div className="ns-art__anim-sidebar">
            <button
              className={`ns-art__anim-play${isPlaying ? " ns-art__anim-play--stop" : ""}`}
              onClick={isPlaying ? stopPlay : startPlay}
              disabled={frameCount < 2}
              title={isPlaying ? "Stop" : "Play animation"}
            >{isPlaying ? "■" : "▶"}</button>
            <button
              className="ns-art__anim-collapse"
              onClick={() => setAnimPanelMode(m => m === "all" ? "current" : m === "current" ? "hidden" : "all")}
              title={`Strip view: ${animPanelMode}`}
            >{animPanelMode === "all" ? "≡" : animPanelMode === "current" ? "─" : "·"}</button>
          </div>

        </div>
      </div>

      {/* ── Canvas (scrollable) ── */}
      <div ref={scrollContainerRef} className="ns-art__canvas-area">
        <div
          className={`ns-art__canvas-wrap${gridActive ? " ns-art__canvas-wrap--grid" : ""}`}
          style={{
            width: canvasSize.w * zoom,
            height: canvasSize.h * zoom,
            ...(gridActive ? { "--grid-cell": `${zoom}px` } as React.CSSProperties : {}),
          }}
        >
          <canvas
            ref={canvasRef}
            className={`ns-art__canvas${isPlaying ? " ns-art__canvas--playing" : ""}`}
            width={canvasSize.w}
            height={canvasSize.h}
            style={{ width: canvasSize.w * zoom, height: canvasSize.h * zoom, cursor: tool === "select" ? "crosshair" : undefined }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onContextMenu={e => e.preventDefault()}
          />
          <canvas
            ref={onionCanvasRef}
            className="ns-art__onion-overlay"
            width={canvasSize.w}
            height={canvasSize.h}
            style={{ width: canvasSize.w * zoom, height: canvasSize.h * zoom }}
          />
          {selectRect && selectRect.w > 0 && selectRect.h > 0 && (
            <div
              className="ns-art__marquee"
              style={{
                left:   selectRect.x * zoom,
                top:    selectRect.y * zoom,
                width:  selectRect.w * zoom,
                height: selectRect.h * zoom,
                cursor: selectPhase === "selected" ? "move" : "crosshair",
              }}
            />
          )}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="ns-art__bottom">

        {/* 🎨 palette picker button — far left */}
        <button
          className="ns-art__palette-btn"
          onClick={() => { setShowPaletteDlg(true); setPaletteTarget(null); }}
          title="Choose colors"
        >🎨</button>

        {/* Primary (1) + Secondary (2) color slots, stacked */}
        <div className="ns-art__color-stack">
          <button
            className="ns-art__color-slot"
            style={primaryColor !== "transparent" ? { background: primaryColor } : undefined}
            data-transparent={primaryColor === "transparent" || undefined}
            onClick={() => primaryPickerRef.current?.click()}
            title="Primary color — tap for custom picker"
          ><span className="ns-art__color-slot-label">1</span></button>
          <button
            className="ns-art__color-slot"
            style={secondaryColor !== "transparent" ? { background: secondaryColor } : undefined}
            data-transparent={secondaryColor === "transparent" || undefined}
            onClick={() => secondaryPickerRef.current?.click()}
            title="Secondary color — tap for custom picker"
          ><span className="ns-art__color-slot-label">2</span></button>
          <input ref={primaryPickerRef}   type="color" className="ns-art__hidden-picker"
            value={primaryColor   !== "transparent" ? primaryColor   : "#000000"}
            onChange={e => setPrimaryColor(e.target.value)} />
          <input ref={secondaryPickerRef} type="color" className="ns-art__hidden-picker"
            value={secondaryColor !== "transparent" ? secondaryColor : "#ffffff"}
            onChange={e => setSecondaryColor(e.target.value)} />
        </div>

        {/* Undo */}
        <button className="ns-art__bottom-undo" onClick={undo} title="Undo (Ctrl+Z)">↩</button>

        {/* Sprite save status — only visible in sprite edit mode */}
        {fileId && (
          <span className={`ns-art__sprite-status${spriteSaved ? " ns-art__sprite-status--visible" : ""}`}>
            ✓ Saved
          </span>
        )}

        {/* Minimap + zoom — grows to fill center */}
        <div className="ns-art__bottom-map">
          <canvas
            ref={minimapCanvasRef}
            className="ns-art__minimap"
            onPointerDown={handleMinimapPointerDown}
            onPointerMove={handleMinimapPointerMove}
            onPointerUp={handleMinimapPointerUp}
            title="Mini-map — drag to pan"
          />
          <div className="ns-art__zoom-btns">
            <button className="ns-art__zoom-btn" onClick={() => setZoom(z => ZOOM_OUT[z])} disabled={zoom === 1}  title="Zoom out">−</button>
            <button className="ns-art__zoom-btn" onClick={() => setZoom(z => ZOOM_IN[z])}  disabled={zoom === 16} title="Zoom in">+</button>
          </div>
        </div>

        {/* Tool options — size always shown; shape/fill/corner stacked below */}
        <div className="ns-art__tool-opts">
          <div className="ns-art__size-spin" title={`Brush size: ${brushSize}px`}>
            <button className="ns-art__spin-btn" onClick={() => setBrushSize(s => Math.max(1, s - 1))}>−</button>
            <span className="ns-art__spin-val">{brushSize}</span>
            <button className="ns-art__spin-btn" onClick={() => setBrushSize(s => Math.min(20, s + 1))}>+</button>
          </div>
          {(showFillMode || showBrushShape || showRoundCorner) && (
            <div className="ns-art__opts-row">
              {showFillMode && (
                <button className="ns-art__opt-btn"
                  onClick={() => setFillMode(m => m === "outline" ? "filled" : m === "filled" ? "both" : "outline")}
                  title={`Fill mode: ${fillMode}`}
                >{fillMode === "outline" ? "□" : fillMode === "filled" ? "■" : "▣"}</button>
              )}
              {showBrushShape && (
                <button className="ns-art__opt-btn"
                  onClick={() => setBrushShape(s => s === "square" ? "round" : "square")}
                  title={`Brush tip: ${brushShape}`}
                >{brushShape === "square" ? "□" : "○"}</button>
              )}
              {showRoundCorner && (
                <button
                  className={`ns-art__opt-btn${roundCorners ? " ns-art__opt-btn--active" : ""}`}
                  onClick={() => setRoundCorners(v => !v)}
                  title="Round corners"
                >◱</button>
              )}
            </div>
          )}
        </div>

        {/* Tool picker — far right */}
        <div ref={toolLauncherRef} className="ns-art__tool-launcher">
          {isToolPickerOpen && (
            <div className="ns-art__tool-popup">
              {TOOLS.map(t => (
                <button
                  key={t.id}
                  className={`ns-art__tool-option${tool === t.id ? " ns-art__tool-option--active" : ""}`}
                  title={t.title}
                  onClick={() => { setTool(t.id); setIsToolPickerOpen(false); }}
                >{t.label}</button>
              ))}
            </div>
          )}
          <button
            className={`ns-art__tool-current${isToolPickerOpen ? " ns-art__tool-current--open" : ""}`}
            onClick={() => setIsToolPickerOpen(v => !v)}
            title={currentToolDef.title}
          >{currentToolDef.label}</button>
        </div>

      </div>

      {/* Always-rendered hidden pickers */}
      <input ref={swatchPickerRef} type="color" className="ns-art__hidden-picker" onChange={onSwatchColorChange} />
    </div>
  );
});

export default NsArt;
