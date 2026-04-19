import { useEffect, useRef } from "react";
import { type RainingEmojisSettings } from "../NsDoors97/screensaverSettings";

const DEFAULTS: RainingEmojisSettings = { density: 40, speedMultiplier: 3, customEmojis: "" };

const DEFAULT_EMOJIS = [
  "😀", "🎉", "⭐", "🚀", "🌟", "💥", "🎆", "🌈", "🦄", "🍕",
  "🎮", "💻", "🔥", "✨", "🎸", "🏆", "🎯", "💎", "🌺", "🍦",
  "🦊", "🐸", "🍉", "🎭", "🌙", "☀️", "❄️", "🎪", "🦋", "🍄",
];

function parseEmojis(custom: string): string[] {
  if (!custom.trim()) return DEFAULT_EMOJIS;
  const parsed = custom.split(",").map((s) => s.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_EMOJIS;
}

interface Drop {
  emoji: string;
  x: number;
  y: number;
  size: number;   // px
  speed: number;  // px per frame (before multiplier)
  opacity: number;
  drift: number;  // slight horizontal sway
  driftPhase: number;
}

function makeDrop(W: number, emojis: string[], staggerY = false, totalH = 800): Drop {
  const size = 14 + Math.random() * 46; // 14–60px: bigger = closer = faster
  return {
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    x: Math.random() * W,
    y: staggerY ? -Math.random() * totalH : -size - Math.random() * 60,
    size,
    speed: 0.4 + (size / 60) * 1.6,
    opacity: 0.25 + (size / 60) * 0.75,
    drift: (Math.random() - 0.5) * 0.4,
    driftPhase: Math.random() * Math.PI * 2,
  };
}

export default function RainingEmojis({ settings = DEFAULTS }: { settings?: RainingEmojisSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let drops: Drop[] = [];
    let rafId = 0;
    let lastTime = 0;
    let frame_count = 0;

    function buildDrops(stagger: boolean) {
      const { density, customEmojis } = settingsRef.current;
      const emojis = parseEmojis(customEmojis);
      drops = Array.from({ length: density }, () => makeDrop(W, emojis, stagger, H));
    }

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      buildDrops(true);
    }

    function frame(ts: number) {
      if (ts - lastTime < 16) { rafId = requestAnimationFrame(frame); return; }
      lastTime = ts;
      frame_count++;

      const { density, speedMultiplier, customEmojis } = settingsRef.current;
      const emojis = parseEmojis(customEmojis);

      // Reconcile drop count
      while (drops.length < density) drops.push(makeDrop(W, emojis));
      if (drops.length > density) drops = drops.slice(0, density);

      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, 0, W, H);

      const spd = speedMultiplier * 0.5;

      for (const d of drops) {
        d.y += d.speed * spd;
        d.x += Math.sin(d.driftPhase + frame_count * 0.02) * d.drift;

        // Wrap around when off-screen
        if (d.y - d.size > H) {
          d.y = -d.size - Math.random() * 40;
          d.x = Math.random() * W;
          d.emoji = emojis[Math.floor(Math.random() * emojis.length)];
        }

        ctx.globalAlpha = d.opacity;
        ctx.font = `${d.size}px serif`;
        ctx.fillText(d.emoji, d.x, d.y);
      }

      ctx.globalAlpha = 1;
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
      style={{ display: "block", width: "100%", height: "100%", background: "#000" }}
    />
  );
}
