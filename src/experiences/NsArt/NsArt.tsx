import {
  useRef, useState, useEffect, useCallback,
  useLayoutEffect, forwardRef, useImperativeHandle, useMemo,
} from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import "./NsArt.css";

// ── Types ──────────────────────────────────────────────────────────────────

type Tool = "pencil" | "brush" | "spray" | "eraser" | "fill" | "line" | "rect" | "oval" | "zoom";
type FillMode = "outline" | "filled" | "both";
interface CanvasSize { w: number; h: number }

interface DialogButton { label: string; onClick: () => void; primary?: boolean }
interface ConfirmState { title: string; message: string; buttons: DialogButton[] }

export interface NsArtHandle {
  requestClose: (proceed: () => void) => void;
}

export interface NsArtProps {
  onBackupSaved?: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_PALETTE: string[] = [
  // Row 1 — dark / brand
  "#000000", "#7f7f7f", "#800000", "#cc4400",
  "#ff6b00", "#808000", "#005500", "#006060",
  "#000080", "#5b2d8e", "#7b3dbe", "#800080",
  "#8b4513", "#c0c0c0",
  // Row 2 — bright / light
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

const BRUSH_SIZES = [2, 5, 10] as const;
type BrushSize = typeof BRUSH_SIZES[number];

const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: "pencil", label: "✏️", title: "Pencil (1px)"                  },
  { id: "brush",  label: "🖌️", title: "Brush"                         },
  { id: "spray",  label: "🫧",  title: "Spray Can"                     },
  { id: "eraser", label: "🧼",  title: "Eraser"                        },
  { id: "fill",   label: "🪣",  title: "Fill"                          },
  { id: "line",   label: "╱",  title: "Line"                          },
  { id: "rect",   label: "▭",  title: "Rectangle"                     },
  { id: "oval",   label: "⬭",  title: "Oval"                          },
  { id: "zoom",   label: "🔍",  title: "Zoom — click cycles 1×→2×→4×→1×; right-click reverses" },
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
  if ((mode === "filled" || mode === "both")) {
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
  applyColor(ctx, color, 1);
  const radius = size * 5, density = size * 4;
  for (let i = 0; i < density; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r     = Math.random() * radius;
    ctx.fillRect(Math.round(x + Math.cos(angle)*r), Math.round(y + Math.sin(angle)*r), 1, 1);
  }
  resetCtx(ctx);
}

// ── Component ──────────────────────────────────────────────────────────────

const NsArt = forwardRef<NsArtHandle, NsArtProps>(function NsArt(
  { onBackupSaved }: NsArtProps,
  ref,
) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const primaryPickerRef   = useRef<HTMLInputElement>(null);
  const secondaryPickerRef = useRef<HTMLInputElement>(null);
  const swatchPickerRef    = useRef<HTMLInputElement>(null);

  const [tool,           setTool]          = useState<Tool>("pencil");
  const [palette,        setPalette]       = useState<string[]>(() => [...DEFAULT_PALETTE]);
  const [primaryColor,   setPrimaryColor]  = useState("#000000");
  const [secondaryColor, setSecondaryColor]= useState("#ffffff");
  const [brushSize,      setBrushSize]     = useState<BrushSize>(2);
  const [fillMode,       setFillMode]      = useState<FillMode>("outline");
  const [zoom,           setZoom]          = useState(1);
  const [canvasSize,     setCanvasSize]    = useState<CanvasSize>({ w: 640, h: 480 });
  const [status,         setStatus]        = useState("Ready");
  const [confirmState,   setConfirmState]  = useState<ConfirmState | null>(null);
  const [editingSwatchIdx, setEditingSwatchIdx] = useState<number | null>(null);

  const isDrawingRef        = useRef(false);
  const startRef            = useRef({ x: 0, y: 0 });
  const lastRef             = useRef({ x: 0, y: 0 });
  const snapshotRef         = useRef<ImageData | null>(null);
  const undoRef             = useRef<ImageData[]>([]);
  const sprayRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeColorRef      = useRef("#000000");
  const activeFillColorRef  = useRef("#ffffff");
  const activeSizeRef       = useRef<number>(1);
  const isDirtyRef          = useRef(false);
  const saveTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBackupSavedRef    = useRef(onBackupSaved);
  useEffect(() => { onBackupSavedRef.current = onBackupSaved; }, [onBackupSaved]);

  // ── Expose imperative handle for close confirmation ──────────────────

  const exportPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "ns-art.png";
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
            { label: "Save PNG", primary: true, onClick: () => { exportPng(); proceed(); setConfirmState(null); } },
            { label: "Close without saving",   onClick: () => { proceed();    setConfirmState(null); } },
            { label: "Cancel",                 onClick: () => setConfirmState(null) },
          ],
        });
      } else {
        proceed();
      }
    },
  }), [exportPng]);

  // ── Auto-size canvas to fit available space on mount ─────────────────

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

  // ── Initialise canvas to white when size changes ─────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    undoRef.current = [];
    isDirtyRef.current = false;
  }, [canvasSize]);

  // ── Load backup from localStorage after first canvas init ────────────

  useEffect(() => {
    const t = setTimeout(() => {
      const backup = localStorage.getItem(LS_KEY);
      if (!backup || !canvasRef.current) return;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        isDirtyRef.current = false;
      };
      img.src = backup;
    }, 80);
    return () => clearTimeout(t);
  }, []); // once on mount

  // ── Undo stack ────────────────────────────────────────────────────────

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
  }, []);

  // ── Auto-save to localStorage (debounced 2 s) ─────────────────────────

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        localStorage.setItem(LS_KEY, canvas.toDataURL("image/png"));
        onBackupSavedRef.current?.();
      } catch { /* storage full */ }
    }, 2000);
  }, []);

  // ── New canvas ────────────────────────────────────────────────────────

  const newCanvas = useCallback(() => {
    if (isDirtyRef.current) {
      setConfirmState({
        title: "NS Art — New",
        message: "Clear the canvas? This cannot be undone.",
        buttons: [
          { label: "Clear", primary: true, onClick: () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            pushUndo();
            const ctx = canvas.getContext("2d")!;
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            isDirtyRef.current = false;
            setConfirmState(null);
          }},
          { label: "Cancel", onClick: () => setConfirmState(null) },
        ],
      });
    } else {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [pushUndo]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo]);

  // ── beforeunload guard when dirty (standalone) ────────────────────────

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
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

  // ── Shared drawing core ───────────────────────────────────────────────

  const startDrawing = useCallback((x: number, y: number, isSecondary: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx   = canvas.getContext("2d")!;

    if (tool === "zoom") {
      // Cycle 1→2→4→1 forward, reverse for secondary
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
      return;
    }

    isDrawingRef.current       = true;
    startRef.current           = { x, y };
    lastRef.current            = { x, y };
    activeColorRef.current     = strokeColor;
    activeFillColorRef.current = secondaryColor;
    activeSizeRef.current      = tool === "pencil" ? 1 : brushSize;

    if (tool === "pencil" || tool === "brush" || tool === "eraser") {
      pushUndo();
      const ec = tool === "eraser" ? "transparent" : strokeColor;
      const es = tool === "pencil" ? 1 : brushSize;
      applyColor(ctx, ec, es);
      ctx.beginPath();
      ctx.arc(x, y, es / 2, 0, Math.PI * 2);
      ctx.fill();
      resetCtx(ctx);
    } else if (tool === "spray") {
      pushUndo();
      doSpray(canvas, x, y, strokeColor, brushSize);
      const cc = strokeColor, cs = brushSize;
      sprayRef.current = setInterval(() => {
        if (!isDrawingRef.current || !canvasRef.current) return;
        doSpray(canvasRef.current, lastRef.current.x, lastRef.current.y, cc, cs);
      }, 50);
    } else {
      // line / rect / oval — save snapshot for preview
      pushUndo();
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }, [tool, primaryColor, secondaryColor, brushSize, pushUndo, scheduleAutoSave]);

  const continueDrawing = useCallback((x: number, y: number) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx      = canvas.getContext("2d")!;
    const color    = activeColorRef.current;
    const fillCol  = activeFillColorRef.current;
    const size     = activeSizeRef.current;

    if (tool === "pencil" || tool === "brush") {
      strokeLine(ctx, lastRef.current.x, lastRef.current.y, x, y, color, size);
    } else if (tool === "eraser") {
      strokeLine(ctx, lastRef.current.x, lastRef.current.y, x, y, "transparent", brushSize);
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
  }, [tool, fillMode, scheduleAutoSave]);

  // ── Mouse handlers ────────────────────────────────────────────────────

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
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top)  / zoom);
    setStatus(`${x}, ${y}`);
    continueDrawing(x, y);
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

  // ── Touch handlers ────────────────────────────────────────────────────

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

  // ── Canvas size picker ────────────────────────────────────────────────

  const handleSizeSelect = useCallback((preset: CanvasSize) => {
    setCanvasSize(preset);
    setZoom(1);
  }, []);

  const artMenus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "File",
      items: [
        { label: "New",        onClick: newCanvas },
        { label: "Export PNG", onClick: exportPng },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", onClick: undo },
      ],
    },
    {
      label: "Format",
      items: CANVAS_PRESETS.map((p) => ({
        label: `${p.w}×${p.h}`,
        checked: canvasSize.w === p.w && canvasSize.h === p.h,
        onClick: () => handleSizeSelect(p),
      })),
    },
  ], [newCanvas, exportPng, undo, canvasSize, handleSizeSelect]);

  useWindowMenus(artMenus);

  const showFillMode = tool === "rect" || tool === "oval";

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
                <span className="ns-art__dot" style={{ width: s + 4, height: s + 4 }} />
              </button>
            ))}
          </div>

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
              className="ns-art__canvas"
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
          </div>
        </div>
      </div>

      {/* ── Bottom: color pickers + palette + status ── */}
      <div className="ns-art__bottom">

        {/* Primary / secondary swatches — click to open color picker */}
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
          {/* Hidden native color inputs */}
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

        {/* Palette — left-click=primary, right-click=secondary, double-click=edit slot */}
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
          {/* Transparent swatch */}
          <button
            className={`ns-art__pal-swatch ns-art__pal-swatch--transparent${primaryColor === "transparent" ? " ns-art__pal-swatch--pri" : ""}${secondaryColor === "transparent" ? " ns-art__pal-swatch--sec" : ""}`}
            title="Transparent / erases to alpha"
            onClick={() => setPrimaryColor("transparent")}
            onContextMenu={e => { e.preventDefault(); setSecondaryColor("transparent"); }}
          />
          {/* Hidden input for swatch editing */}
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
