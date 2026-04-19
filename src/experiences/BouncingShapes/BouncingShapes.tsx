import { useEffect, useRef } from "react";
import { type BouncingShapesSettings } from "../NsDoors97/screensaverSettings";

const DEFAULTS: BouncingShapesSettings = { shapeCount: 15, speed: 3 };

const MIN_SIZE = 30;
const MAX_SIZE = 70;
const COLORS = ["#ff4466", "#ff8844", "#ffdd22", "#44ff88", "#22ddff", "#aa44ff", "#ff44cc"];

type ShapeKind = "circle" | "square" | "triangle";

interface Shape {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  kind: ShapeKind;
}

function randomShape(w: number, h: number, speed: number): Shape {
  const kinds: ShapeKind[] = ["circle", "square", "triangle"];
  const size = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE);
  const s = speed * (0.5 + Math.random());
  const angle = Math.random() * Math.PI * 2;
  return {
    x: size + Math.random() * (w - size * 2),
    y: size + Math.random() * (h - size * 2),
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    size,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    kind: kinds[Math.floor(Math.random() * kinds.length)],
  };
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.fillStyle = s.color;
  ctx.beginPath();
  if (s.kind === "circle") {
    ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2);
  } else if (s.kind === "square") {
    ctx.rect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
  } else {
    const r = s.size / 2;
    ctx.moveTo(s.x, s.y - r);
    ctx.lineTo(s.x + r * Math.cos(Math.PI / 6), s.y + r * Math.sin(Math.PI / 6));
    ctx.lineTo(s.x - r * Math.cos(Math.PI / 6), s.y + r * Math.sin(Math.PI / 6));
    ctx.closePath();
  }
  ctx.fill();
}

export default function BouncingShapes({ settings = DEFAULTS }: { settings?: BouncingShapesSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let shapes: Shape[] = [];
    let rafId = 0;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const { shapeCount, speed } = settingsRef.current;
      shapes = Array.from({ length: shapeCount }, () => randomShape(W, H, speed));
    }

    function frame() {
      const { shapeCount, speed } = settingsRef.current;

      // Reconcile shape count
      while (shapes.length < shapeCount) shapes.push(randomShape(W, H, speed));
      if (shapes.length > shapeCount) shapes = shapes.slice(0, shapeCount);

      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, W, H);

      for (const s of shapes) {
        s.x += s.vx;
        s.y += s.vy;

        const r = s.size / 2;
        if (s.x - r < 0) { s.x = r; s.vx = Math.abs(s.vx); }
        if (s.x + r > W) { s.x = W - r; s.vx = -Math.abs(s.vx); }
        if (s.y - r < 0) { s.y = r; s.vy = Math.abs(s.vy); }
        if (s.y + r > H) { s.y = H - r; s.vy = -Math.abs(s.vy); }

        drawShape(ctx, s);
      }

      rafId = requestAnimationFrame(frame);
    }

    resize();
    rafId = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
