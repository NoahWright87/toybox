import { useEffect, useRef } from "react";
import { type RainingEmojisSettings } from "../NsDoors97/screensaverSettings";

const DEFAULTS: RainingEmojisSettings = {
  density: 40,
  speedMultiplier: 3,
  customEmojis: "",
  minSize: 14,
  maxSize: 60,
};

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
  size: number;
  speed: number;
  drift: number;
  driftPhase: number;
}

function makeDrop(
  W: number,
  emojis: string[],
  minSize: number,
  maxSize: number,
  staggerY = false,
  totalH = 800
): Drop {
  const size = minSize + Math.random() * Math.max(0, maxSize - minSize);
  const sizeRange = Math.max(1, maxSize - minSize);
  return {
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    x: Math.random() * W,
    y: staggerY ? -Math.random() * totalH : -size - Math.random() * 60,
    size,
    // Bigger = closer = faster (parallax)
    speed: 0.4 + ((size - minSize) / sizeRange) * 1.6,
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
    let frameCount = 0;

    function buildDrops(stagger: boolean) {
      const { density, customEmojis, minSize, maxSize } = settingsRef.current;
      const emojis = parseEmojis(customEmojis);
      const lo = Math.min(minSize, maxSize);
      const hi = Math.max(minSize, maxSize);
      drops = Array.from({ length: density }, () => makeDrop(W, emojis, lo, hi, stagger, H));
    }

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      buildDrops(true);
    }

    function frame(ts: number) {
      if (ts - lastTime < 16) { rafId = requestAnimationFrame(frame); return; }
      lastTime = ts;
      frameCount++;

      const { density, speedMultiplier, customEmojis, minSize, maxSize } = settingsRef.current;
      const emojis = parseEmojis(customEmojis);
      const lo = Math.min(minSize, maxSize);
      const hi = Math.max(minSize, maxSize);

      // Reconcile drop count
      while (drops.length < density) drops.push(makeDrop(W, emojis, lo, hi));
      if (drops.length > density) drops = drops.slice(0, density);

      // Solid black background — no trail/fade
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      const spd = speedMultiplier * 0.5;

      for (const d of drops) {
        d.y += d.speed * spd;
        d.x += Math.sin(d.driftPhase + frameCount * 0.02) * d.drift;

        if (d.y - d.size > H) {
          d.y = -d.size - Math.random() * 40;
          d.x = Math.random() * W;
          d.emoji = emojis[Math.floor(Math.random() * emojis.length)];
          // Randomize size again on wrap
          d.size = lo + Math.random() * Math.max(0, hi - lo);
          const sizeRange = Math.max(1, hi - lo);
          d.speed = 0.4 + ((d.size - lo) / sizeRange) * 1.6;
        }

        ctx.globalAlpha = 1;
        ctx.font = `${d.size}px serif`;
        ctx.fillText(d.emoji, d.x, d.y);
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
      style={{ display: "block", width: "100%", height: "100%", background: "#000" }}
    />
  );
}
