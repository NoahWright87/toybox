import { useEffect, useRef } from "react";
import { type ScrollingTextSettings } from "../NsDoors97/screensaverSettings";
import { NS_CATCHPHRASES } from "../../utils/nsCatchphrases";

const DEFAULTS: ScrollingTextSettings = {
  textMode: "catchphrase",
  customText: "",
  speed: 4,
  color: "#ff9a44",
  fontSize: 40,
};

function pickCatchphrase(): string {
  return NS_CATCHPHRASES[Math.floor(Math.random() * NS_CATCHPHRASES.length)];
}

function formatDateTime(): string {
  const now = new Date();
  return now.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ScrollingText({ settings = DEFAULTS }: { settings?: ScrollingTextSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let rafId = 0;
    let lastTime = 0;

    // Bouncing state
    let x = 0, y = 0;
    let vx = 1, vy = 1;
    let displayText = "";
    let lastDateUpdate = 0;

    function initText() {
      const s = settingsRef.current;
      if (s.textMode === "datetime") {
        displayText = formatDateTime();
      } else if (s.textMode === "catchphrase") {
        displayText = pickCatchphrase();
      } else {
        displayText = s.customText || "NS DOORS 97";
      }
    }

    function measureText(): { w: number; h: number } {
      const s = settingsRef.current;
      ctx.font = `bold ${s.fontSize}px "Press Start 2P", monospace`;
      const m = ctx.measureText(displayText);
      return { w: m.width, h: s.fontSize };
    }

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;

      // Place text at a random starting position
      const { w, h } = measureText();
      x = Math.max(0, Math.random() * (W - w));
      y = h + Math.random() * Math.max(0, H - h * 2);

      const dir = () => (Math.random() > 0.5 ? 1 : -1);
      vx = dir();
      vy = dir();
    }

    function frame(ts: number) {
      if (ts - lastTime < 16) { rafId = requestAnimationFrame(frame); return; }
      lastTime = ts;

      const s = settingsRef.current;
      const speed = s.speed * 0.4 + 0.4;

      // Update datetime every second
      if (s.textMode === "datetime" && ts - lastDateUpdate > 1000) {
        displayText = formatDateTime();
        lastDateUpdate = ts;
      }

      ctx.font = `bold ${s.fontSize}px "Press Start 2P", monospace`;
      const tw = ctx.measureText(displayText).width;
      const th = s.fontSize;

      x += vx * speed;
      y += vy * speed;

      // Bounce off edges
      if (x <= 0) { x = 0; vx = Math.abs(vx); }
      if (x + tw >= W) { x = Math.max(0, W - tw); vx = -Math.abs(vx); }
      if (y - th <= 0) { y = th; vy = Math.abs(vy); }
      if (y >= H) { y = H; vy = -Math.abs(vy); }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = s.color;
      ctx.fillText(displayText, x, y);

      rafId = requestAnimationFrame(frame);
    }

    initText();
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
