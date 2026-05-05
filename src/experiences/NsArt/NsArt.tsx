import { useRef, useState, useEffect, useCallback } from "react";
import "./NsArt.css";

type Tool = "pencil" | "brush" | "spray" | "eraser" | "fill" | "line" | "rect" | "oval" | "zoom";
type FillMode = "outline" | "filled" | "both";

interface CanvasSize { w: number; h: number }

const PALETTE: string[] = [
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
  { id: "pencil", label: "✏",  title: "Pencil (1px)"     },
  { id: "brush",  label: "⬤",  title: "Brush"            },
  { id: "spray",  label: "∷",  title: "Spray Can"        },
  { id: "eraser", label: "◻",  title: "Eraser"           },
  { id: "fill",   label: "▤",  title: "Fill"             },
  { id: "line",   label: "╱",  title: "Line"             },
  { id: "rect",   label: "▭",  title: "Rectangle"        },
  { id: "oval",   label: "⬭",  title: "Oval"             },
  { id: "zoom",   label: "⊕",  title: "Zoom (right-click zooms out)" },
];

// ── Utilities ──────────────────────────────────────────────────────────────

function floodFill(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  fillColor: string,
) {
  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const byteIdx = (x: number, y: number) => (y * w + x) * 4;

  const si = byteIdx(sx, sy);
  const tR = d[si], tG = d[si + 1], tB = d[si + 2], tA = d[si + 3];

  let fR: number, fG: number, fB: number, fA: number;
  if (fillColor === "transparent") {
    [fR, fG, fB, fA] = [0, 0, 0, 0];
  } else {
    const m = /^#(..)(..)(..)$/.exec(fillColor);
    if (!m) return;
    [fR, fG, fB, fA] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 255];
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
    const x = pi % w;
    const y = Math.floor(pi / w);
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
  ctx.lineWidth  = size;
  ctx.lineCap    = "round";
  ctx.lineJoin   = "round";
}

function resetCtx(ctx: CanvasRenderingContext2D) {
  ctx.globalCompositeOperation = "source-over";
}

function strokeLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  x1: number, y1: number,
  color: string,
  size: number,
) {
  applyColor(ctx, color, size);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  resetCtx(ctx);
}

function strokeRect(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  x1: number, y1: number,
  color: string,
  size: number,
  mode: FillMode,
) {
  applyColor(ctx, color, size);
  const x = Math.min(x0, x1), y = Math.min(y0, y1);
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
  if (mode === "filled" || mode === "both") ctx.fillRect(x, y, w, h);
  if (mode === "outline" || mode === "both") ctx.strokeRect(x, y, w, h);
  resetCtx(ctx);
}

function strokeOval(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  x1: number, y1: number,
  color: string,
  size: number,
  mode: FillMode,
) {
  applyColor(ctx, color, size);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rx = Math.max(1, Math.abs(x1 - x0) / 2);
  const ry = Math.max(1, Math.abs(y1 - y0) / 2);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  if (mode === "filled" || mode === "both") ctx.fill();
  if (mode === "outline" || mode === "both") ctx.stroke();
  resetCtx(ctx);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function NsArt() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tool,            setTool]           = useState<Tool>("pencil");
  const [primaryColor,    setPrimaryColor]   = useState("#000000");
  const [secondaryColor,  setSecondaryColor] = useState("#ffffff");
  const [brushSize,       setBrushSize]      = useState<BrushSize>(2);
  const [fillMode,        setFillMode]       = useState<FillMode>("outline");
  const [zoom,            setZoom]           = useState(1);
  const [canvasSize,      setCanvasSize]     = useState<CanvasSize>({ w: 640, h: 480 });
  const [showSizeMenu,    setShowSizeMenu]   = useState(false);
  const [status,          setStatus]         = useState("Ready");

  const isDrawingRef        = useRef(false);
  const startRef            = useRef({ x: 0, y: 0 });
  const lastRef             = useRef({ x: 0, y: 0 });
  const snapshotRef         = useRef<ImageData | null>(null);
  const undoRef             = useRef<ImageData[]>([]);
  const sprayRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeColorRef      = useRef("#000000");
  const activeSizeRef       = useRef<number>(1);

  // White-fill whenever canvas size changes (creates new canvas element)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    undoRef.current = [];
  }, [canvasSize]);

  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const stack = undoRef.current;
    undoRef.current = stack.length >= 5 ? [...stack.slice(1), snap] : [...stack, snap];
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoRef.current.length === 0) return;
    const ctx = canvas.getContext("2d")!;
    const prev = undoRef.current[undoRef.current.length - 1];
    undoRef.current = undoRef.current.slice(0, -1);
    ctx.putImageData(prev, 0, 0);
  }, []);

  const newCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    pushUndo();
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [pushUndo]);

  const exportPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "ns-art.png";
    a.click();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo]);

  function sprayAt(x: number, y: number, color: string, size: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    applyColor(ctx, color, 1);
    const radius  = size * 5;
    const density = size * 4;
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.random() * radius;
      ctx.fillRect(
        Math.round(x + Math.cos(angle) * r),
        Math.round(y + Math.sin(angle) * r),
        1, 1,
      );
    }
    resetCtx(ctx);
  }

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx  = canvas.getContext("2d")!;
      const pos  = { x: Math.floor((e.clientX - canvas.getBoundingClientRect().left) / zoom),
                     y: Math.floor((e.clientY - canvas.getBoundingClientRect().top)  / zoom) };
      const color = e.button === 2 ? secondaryColor : primaryColor;

      if (tool === "zoom") {
        setZoom(z => e.button === 2 ? Math.max(1, z / 2) : Math.min(4, z * 2));
        return;
      }

      if (tool === "fill") {
        pushUndo();
        floodFill(ctx, pos.x, pos.y, color);
        return;
      }

      isDrawingRef.current   = true;
      startRef.current       = pos;
      lastRef.current        = pos;
      activeColorRef.current = color;
      activeSizeRef.current  = tool === "pencil" ? 1 : brushSize;

      if (tool === "pencil" || tool === "brush" || tool === "eraser") {
        pushUndo();
        const effectiveColor = tool === "eraser" ? "transparent" : color;
        const effectiveSize  = tool === "pencil" ? 1 : brushSize;
        // Draw initial dot
        applyColor(ctx, effectiveColor, effectiveSize);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, effectiveSize / 2, 0, Math.PI * 2);
        ctx.fill();
        resetCtx(ctx);
      } else if (tool === "spray") {
        pushUndo();
        sprayAt(pos.x, pos.y, color, brushSize);
        const capturedColor = color;
        const capturedSize  = brushSize;
        sprayRef.current = setInterval(() => {
          if (!isDrawingRef.current) return;
          sprayAt(lastRef.current.x, lastRef.current.y, capturedColor, capturedSize);
        }, 50);
      } else {
        // line / rect / oval — save snapshot for live preview
        pushUndo();
        snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    },
    [tool, primaryColor, secondaryColor, brushSize, pushUndo, zoom],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pos  = {
        x: Math.floor((e.clientX - rect.left) / zoom),
        y: Math.floor((e.clientY - rect.top)  / zoom),
      };
      setStatus(`${pos.x}, ${pos.y}`);

      if (!isDrawingRef.current) return;
      const ctx   = canvas.getContext("2d")!;
      const color = activeColorRef.current;
      const size  = activeSizeRef.current;

      if (tool === "pencil" || tool === "brush") {
        strokeLine(ctx, lastRef.current.x, lastRef.current.y, pos.x, pos.y, color, size);
      } else if (tool === "eraser") {
        strokeLine(ctx, lastRef.current.x, lastRef.current.y, pos.x, pos.y, "transparent", brushSize);
      } else if (tool === "spray") {
        sprayAt(pos.x, pos.y, color, brushSize);
      } else if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
        const { x: sx, y: sy } = startRef.current;
        if (tool === "line") strokeLine(ctx, sx, sy, pos.x, pos.y, color, size);
        else if (tool === "rect") strokeRect(ctx, sx, sy, pos.x, pos.y, color, size, fillMode);
        else if (tool === "oval") strokeOval(ctx, sx, sy, pos.x, pos.y, color, size, fillMode);
      }

      lastRef.current = pos;
    },
    [tool, brushSize, fillMode, zoom],
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      if (sprayRef.current) {
        clearInterval(sprayRef.current);
        sprayRef.current = null;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx   = canvas.getContext("2d")!;
      const rect  = canvas.getBoundingClientRect();
      const pos   = {
        x: Math.floor((e.clientX - rect.left) / zoom),
        y: Math.floor((e.clientY - rect.top)  / zoom),
      };
      const color = activeColorRef.current;
      const size  = activeSizeRef.current;

      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
        const { x: sx, y: sy } = startRef.current;
        if (tool === "line")      strokeLine(ctx, sx, sy, pos.x, pos.y, color, size);
        else if (tool === "rect") strokeRect(ctx, sx, sy, pos.x, pos.y, color, size, fillMode);
        else if (tool === "oval") strokeOval(ctx, sx, sy, pos.x, pos.y, color, size, fillMode);
        snapshotRef.current = null;
      }
    },
    [tool, fillMode, zoom],
  );

  const onMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setStatus("Ready");
      if (isDrawingRef.current) onMouseUp(e);
    },
    [onMouseUp],
  );

  const handleSizeSelect = useCallback((preset: CanvasSize) => {
    setCanvasSize(preset);
    setShowSizeMenu(false);
    setZoom(1);
  }, []);

  const showFillMode = tool === "rect" || tool === "oval";

  return (
    <div className="ns-art">
      {/* ── Action bar ── */}
      <div className="ns-art__actions">
        <button className="ns-art__action-btn" onClick={newCanvas}  title="New (clears canvas)">New</button>
        <button className="ns-art__action-btn" onClick={exportPng}  title="Export as PNG">Export PNG</button>
        <button className="ns-art__action-btn" onClick={undo}       title="Undo (Ctrl+Z)">Undo</button>
        <div className="ns-art__action-sep" />
        <div className="ns-art__size-picker">
          <button
            className="ns-art__action-btn"
            onClick={() => setShowSizeMenu(s => !s)}
            title="Change canvas size"
          >
            {canvasSize.w}×{canvasSize.h} ▾
          </button>
          {showSizeMenu && (
            <div className="ns-art__size-menu">
              {CANVAS_PRESETS.map(p => (
                <button
                  key={`${p.w}x${p.h}`}
                  className={`ns-art__size-item${canvasSize.w === p.w && canvasSize.h === p.h ? " ns-art__size-item--active" : ""}`}
                  onClick={() => handleSizeSelect(p)}
                >
                  {p.w}×{p.h}
                </button>
              ))}
            </div>
          )}
        </div>
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

          {/* Brush sizes */}
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

          {/* Fill mode (shapes only) */}
          {showFillMode && (
            <>
              <div className="ns-art__toolbox-sep" />
              <div className="ns-art__fill-modes">
                {(["outline", "filled", "both"] as FillMode[]).map(m => (
                  <button
                    key={m}
                    className={`ns-art__fill-btn${fillMode === m ? " ns-art__fill-btn--active" : ""}`}
                    title={m}
                    onClick={() => setFillMode(m)}
                  >
                    {m === "outline" ? "□" : m === "filled" ? "■" : "▣"}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Zoom indicator */}
          {zoom > 1 && (
            <>
              <div className="ns-art__toolbox-sep" />
              <div className="ns-art__zoom-label">{zoom}×</div>
            </>
          )}
        </div>

        {/* Canvas scroll area */}
        <div className="ns-art__canvas-area">
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
              onContextMenu={e => e.preventDefault()}
            />
          </div>
        </div>
      </div>

      {/* ── Bottom: color swatches + palette + status ── */}
      <div className="ns-art__bottom">
        {/* Active color display */}
        <div className="ns-art__swatch-box">
          <div
            className="ns-art__swatch ns-art__swatch--secondary"
            style={secondaryColor !== "transparent" ? { background: secondaryColor } : undefined}
            data-transparent={secondaryColor === "transparent" || undefined}
            title="Secondary color (right-click palette)"
          />
          <div
            className="ns-art__swatch ns-art__swatch--primary"
            style={primaryColor !== "transparent" ? { background: primaryColor } : undefined}
            data-transparent={primaryColor === "transparent" || undefined}
            title="Primary color (left-click palette)"
          />
        </div>

        {/* Palette */}
        <div className="ns-art__palette">
          {PALETTE.map((color, i) => (
            <button
              key={i}
              className={`ns-art__pal-swatch${color === primaryColor ? " ns-art__pal-swatch--pri" : ""}${color === secondaryColor ? " ns-art__pal-swatch--sec" : ""}`}
              style={{ background: color }}
              title={color}
              onClick={() => setPrimaryColor(color)}
              onContextMenu={e => { e.preventDefault(); setSecondaryColor(color); }}
            />
          ))}
          {/* Transparent swatch */}
          <button
            className={`ns-art__pal-swatch ns-art__pal-swatch--transparent${primaryColor === "transparent" ? " ns-art__pal-swatch--pri" : ""}${secondaryColor === "transparent" ? " ns-art__pal-swatch--sec" : ""}`}
            title="Transparent / Eraser"
            onClick={() => setPrimaryColor("transparent")}
            onContextMenu={e => { e.preventDefault(); setSecondaryColor("transparent"); }}
          />
        </div>

        <div className="ns-art__status">{status}</div>
      </div>
    </div>
  );
}
