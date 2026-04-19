import { useEffect, useRef } from "react";
import { type BouncingPolygonsSettings } from "../NsDoors97/screensaverSettings";

const DEFAULTS: BouncingPolygonsSettings = { count: 3, vertices: 4, speed: 3, rounded: false };

interface PolyPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Polygon {
  points: PolyPoint[];
  hue: number;
  hueSpeed: number;
}

function makePolygon(vertexCount: number, speed: number, W: number, H: number): Polygon {
  const s = speed * 0.5;
  return {
    points: Array.from({ length: vertexCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * s * 2 + (Math.random() > 0.5 ? 0.5 : -0.5),
      vy: (Math.random() - 0.5) * s * 2 + (Math.random() > 0.5 ? 0.5 : -0.5),
    })),
    hue: Math.random() * 360,
    hueSpeed: 0.3 + Math.random() * 0.7,
  };
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  poly: Polygon,
  rounded: boolean,
  alpha: number
) {
  const { points, hue } = poly;
  const n = points.length;
  if (n < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${alpha})`;
  ctx.lineWidth = 2;

  if (rounded && n >= 3) {
    // Bezier curves through midpoints — same technique as the Windows "Mystify" blob variant
    const mid = (i: number, j: number) => ({
      x: (points[i].x + points[j].x) / 2,
      y: (points[i].y + points[j].y) / 2,
    });
    const mids = points.map((_, i) => mid(i, (i + 1) % n));
    ctx.moveTo(mids[n - 1].x, mids[n - 1].y);
    for (let i = 0; i < n; i++) {
      ctx.quadraticCurveTo(points[i].x, points[i].y, mids[i].x, mids[i].y);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
  }

  ctx.stroke();
}

export default function BouncingPolygons({ settings = DEFAULTS }: { settings?: BouncingPolygonsSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let polygons: Polygon[] = [];
    let rafId = 0;
    let lastTime = 0;

    // Trail: keep last N frames of point positions for each polygon
    const TRAIL_LEN = 20;
    type Trail = { points: { x: number; y: number }[]; hue: number }[];
    let trails: Trail[] = [];

    function buildPolygons() {
      const { count, vertices, speed } = settingsRef.current;
      polygons = Array.from({ length: count }, () => makePolygon(vertices, speed, W, H));
      trails = polygons.map(() => []);
    }

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      buildPolygons();
    }

    function frame(ts: number) {
      if (ts - lastTime < 16) { rafId = requestAnimationFrame(frame); return; }
      lastTime = ts;

      const { count, vertices, speed, rounded } = settingsRef.current;

      // Reconcile polygon count / vertex count
      if (polygons.length !== count || (polygons[0]?.points.length ?? 0) !== vertices) {
        buildPolygons();
      }

      // Fade background for trail effect
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, W, H);

      for (let pi = 0; pi < polygons.length; pi++) {
        const poly = polygons[pi];
        poly.hue = (poly.hue + poly.hueSpeed) % 360;

        // Move each point
        for (const p of poly.points) {
          p.x += p.vx * (speed * 0.4);
          p.y += p.vy * (speed * 0.4);
          if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
          if (p.x > W) { p.x = W; p.vx = -Math.abs(p.vx); }
          if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
          if (p.y > H) { p.y = H; p.vy = -Math.abs(p.vy); }
        }

        // Record trail snapshot
        const trail = trails[pi] ?? [];
        trail.push({ points: poly.points.map(p => ({ x: p.x, y: p.y })), hue: poly.hue });
        if (trail.length > TRAIL_LEN) trail.shift();
        trails[pi] = trail;

        // Draw trail (oldest = most transparent)
        for (let ti = 0; ti < trail.length; ti++) {
          const alpha = (ti / trail.length) * 0.6;
          const snap = trail[ti];
          const fakePoly: Polygon = { points: snap.points as PolyPoint[], hue: snap.hue, hueSpeed: 0 };
          drawPolygon(ctx, fakePoly, rounded, alpha);
        }

        // Draw current frame (full opacity)
        drawPolygon(ctx, poly, rounded, 0.9);
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
