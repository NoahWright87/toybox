import { useEffect, useRef } from "react";
import { type FireworksSettings } from "../NsDoors97/screensaverSettings";

const GRAVITY = 0.08;
const FRICTION = 0.99;

const DEFAULTS: FireworksSettings = { particlesPerBurst: 60, burstRate: 30 };

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  hue: number;
  lightness: number;
  size: number;
}

function createBurst(cx: number, cy: number, count: number): Particle[] {
  const hue = Math.floor(Math.random() * 360);
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.7 + Math.random() * 0.3,
      decay: 0.012 + Math.random() * 0.008,
      hue: hue + Math.random() * 40 - 20,
      lightness: 55 + Math.random() * 20,
      size: 2 + Math.random() * 3,
    };
  });
}

export default function Fireworks({ settings = DEFAULTS }: { settings?: FireworksSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let particles: Particle[] = [];
    let rafId = 0;
    let lastBurst = 0;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function spawnBurst() {
      const { particlesPerBurst } = settingsRef.current;
      const x = Math.random() * W;
      const y = Math.random() * H * 0.75; // bias toward upper 3/4
      particles.push(...createBurst(x, y, particlesPerBurst));
    }

    function frame(ts: number) {
      // Auto-fire based on burstRate
      const { burstRate } = settingsRef.current;
      const msPerBurst = 60000 / burstRate;
      if (lastBurst === 0 || ts - lastBurst >= msPerBurst) {
        spawnBurst();
        lastBurst = ts;
      }

      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, W, H);

      const alive: Particle[] = [];
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITY;
        p.vx *= FRICTION;
        p.vy *= FRICTION;
        p.life -= p.decay;

        if (p.life > 0) {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = `hsl(${p.hue},100%,${p.lightness}%)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          alive.push(p);
        }
      }
      ctx.globalAlpha = 1;
      particles = alive;

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
