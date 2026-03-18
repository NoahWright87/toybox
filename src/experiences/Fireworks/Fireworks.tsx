import { useEffect, useRef } from "react";

const PARTICLES_PER_BURST = 60;
const GRAVITY = 0.08;
const FRICTION = 0.99;

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

function createBurst(cx: number, cy: number): Particle[] {
  const hue = Math.floor(Math.random() * 360);
  return Array.from({ length: PARTICLES_PER_BURST }, () => {
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

export default function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let particles: Particle[] = [];
    let rafId = 0;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function frame() {
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

    function spawnBurst(x: number, y: number) {
      particles.push(...createBurst(x, y));
    }

    function onClick(e: MouseEvent) {
      spawnBurst(e.clientX, e.clientY);
    }

    function onTouch(e: TouchEvent) {
      for (let i = 0; i < e.touches.length; i++) {
        spawnBurst(e.touches[i].clientX, e.touches[i].clientY);
      }
    }

    resize();
    rafId = requestAnimationFrame(frame);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchstart", onTouch);
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
        cursor: "crosshair",
      }}
      title="Click to launch fireworks"
    />
  );
}
