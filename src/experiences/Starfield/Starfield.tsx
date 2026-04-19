import { useEffect, useRef } from "react";
import { type StarfieldSettings } from "../NsDoors97/screensaverSettings";

interface Star {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
}

const MAX_Z = 1000;
const TARGET_FPS = 60;
const FRAME_MS = 1000 / TARGET_FPS;

const DEFAULTS: StarfieldSettings = { speed: 4, starCount: 500 };

function randomStar(w: number, h: number): Star {
  const z = Math.random() * MAX_Z + 1;
  return {
    x: (Math.random() - 0.5) * w * 2,
    y: (Math.random() - 0.5) * h * 2,
    z,
    px: 0,
    py: 0,
    pz: z,
  };
}

export default function Starfield({ settings = DEFAULTS }: { settings?: StarfieldSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0, CX = 0, CY = 0;
    let stars: Star[] = [];
    let rafId = 0;
    let lastTime = 0;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      CX = W / 2;
      CY = H / 2;
      stars = Array.from({ length: settingsRef.current.starCount }, () => randomStar(W, H));
    }

    function project(x: number, y: number, z: number) {
      return {
        sx: CX + (x / z) * MAX_Z * 0.6,
        sy: CY + (y / z) * MAX_Z * 0.6,
        r: Math.max(0.3, (1 - z / MAX_Z) * 3.5),
      };
    }

    function frame(ts: number) {
      if (ts - lastTime < FRAME_MS) { rafId = requestAnimationFrame(frame); return; }
      lastTime = ts;

      const { speed, starCount } = settingsRef.current;

      // Reconcile star count without reinit
      while (stars.length < starCount) stars.push(randomStar(W, H));
      if (stars.length > starCount) stars = stars.slice(0, starCount);

      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, W, H);

      for (const s of stars) {
        s.pz = s.z;
        const prev = project(s.x, s.y, s.pz);
        s.px = prev.sx;
        s.py = prev.sy;

        s.z -= speed;

        if (s.z <= 0) {
          Object.assign(s, randomStar(W, H));
          continue;
        }

        const cur = project(s.x, s.y, s.z);

        if (cur.sx < 0 || cur.sx > W || cur.sy < 0 || cur.sy > H) {
          Object.assign(s, randomStar(W, H));
          continue;
        }

        const brightness = Math.floor((1 - s.z / MAX_Z) * 255);
        const alpha = 0.4 + (1 - s.z / MAX_Z) * 0.6;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${brightness},${Math.min(255, brightness + 10)},255,${alpha.toFixed(2)})`;
        ctx.lineWidth = cur.r;
        ctx.moveTo(s.px, s.py);
        ctx.lineTo(cur.sx, cur.sy);
        ctx.stroke();
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
