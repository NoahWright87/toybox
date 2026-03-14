import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
}

const NUM_STARS = 500;
const MAX_Z = 1000;
const TARGET_FPS = 60;
const FRAME_MS = 1000 / TARGET_FPS;

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

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(4);
  const boostRef = useRef(0);

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

      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, W, H);

      const dz = speedRef.current + boostRef.current;
      if (boostRef.current > 0) {
        boostRef.current = Math.max(0, boostRef.current - 0.5);
      }

      for (const s of stars) {
        s.pz = s.z;
        const prev = project(s.x, s.y, s.pz);
        s.px = prev.sx;
        s.py = prev.sy;

        s.z -= dz;

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

    function triggerBoost() {
      boostRef.current = Math.min(boostRef.current + 18, 60);
    }

    function onWheel(e: WheelEvent) {
      speedRef.current = Math.max(1, Math.min(30, speedRef.current + (e.deltaY > 0 ? 1 : -1)));
    }

    resize();
    stars = Array.from({ length: NUM_STARS }, () => randomStar(W, H));
    rafId = requestAnimationFrame(frame);

    canvas.addEventListener("click", triggerBoost);
    canvas.addEventListener("touchstart", triggerBoost, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("click", triggerBoost);
      canvas.removeEventListener("touchstart", triggerBoost);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        cursor: "pointer",
      }}
      title="Click to boost · scroll to adjust speed"
    />
  );
}
