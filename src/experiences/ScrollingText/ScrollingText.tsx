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
  return new Date().toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getNextText(s: ScrollingTextSettings): string {
  if (s.textMode === "datetime") return formatDateTime();
  if (s.textMode === "catchphrase") return pickCatchphrase();
  return s.customText || "NS DOORS 97";
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

    let x = 0;
    let y = 0;
    let displayText = "";
    let lastDateUpdate = 0;

    function setFont() {
      ctx.font = `bold ${settingsRef.current.fontSize}px "Press Start 2P", monospace`;
    }

    function startNewPass() {
      const s = settingsRef.current;
      displayText = getNextText(s);
      setFont();
      x = W; // just off right edge
      y = s.fontSize + Math.random() * Math.max(4, H - s.fontSize * 2.5);
    }

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      startNewPass();
    }

    function frame(ts: number) {
      if (ts - lastTime < 16) { rafId = requestAnimationFrame(frame); return; }
      lastTime = ts;

      const s = settingsRef.current;
      const speed = s.speed * 1.5 + 0.5;

      setFont();

      // For datetime mode update text every second (in-place — string may change length)
      if (s.textMode === "datetime" && ts - lastDateUpdate > 1000) {
        displayText = formatDateTime();
        lastDateUpdate = ts;
      }

      x -= speed;

      const tw = ctx.measureText(displayText).width;

      // Once text is fully off left edge, start a new pass
      if (x + tw < 0) {
        startNewPass();
      }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = s.color;
      ctx.fillText(displayText, x, y);

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
