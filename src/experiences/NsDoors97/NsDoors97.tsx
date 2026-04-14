import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { experiences, type Experience } from "../../data/experiences";
import { missingFeatureMessage } from "../../utils/missingFeatureMessage";
import DesktopIcon from "./DesktopIcon";
import Window from "./Window";
import Taskbar from "./Taskbar";
import "./NsDoors97.css";

// ── Icon mapping ──────────────────────────────────────────────────────────────

const EXPERIENCE_ICONS: Record<string, string> = {
  starfield: "⭐",
  fireworks: "🎆",
  "bouncing-shapes": "🔷",
  "typing-racer": "⌨️",
  "number-muncher": "🔢",
  "tic-tac-toe": "✖️",
  "word-whirlwind": "🌪️",
};

// Placeholder icons — non-functional, for vibes
const PLACEHOLDER_ICONS = [
  { id: "my-doors", title: "My Doors", icon: "🖥️" },
  { id: "recycle-bin", title: "Recycle Bin", icon: "🗑️" },
];

// ── Window state ──────────────────────────────────────────────────────────────

interface OpenWindow {
  id: string;
  title: string;
  icon: string;
  experience: Experience;
  zIndex: number;
  defaultPosition: { x: number; y: number };
}

let windowSeq = 0;
let maxZ = 100;

// ── App Launcher (content inside each window) ─────────────────────────────────

function AppLauncher({
  experience,
  onPlay,
}: {
  experience: Experience;
  onPlay: () => void;
}) {
  const icon = EXPERIENCE_ICONS[experience.id] ?? "🖥️";

  return (
    <div className="ns-launcher">
      <div className="ns-launcher__icon">{icon}</div>
      <h2 className="ns-launcher__title">{experience.title}</h2>
      <span className="ns-launcher__category">{experience.category}</span>
      <p className="ns-launcher__desc">{experience.description}</p>
      <div className="ns-launcher__rule" />
      <button className="ns-launcher__play" onClick={onPlay}>
        ▶ Play
      </button>
      <p className="ns-launcher__hint">
        Opens full-screen. Use browser back to return.
      </p>
    </div>
  );
}

// ── Main Desktop ──────────────────────────────────────────────────────────────

export default function NsDoors97() {
  const navigate = useNavigate();
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  const openWindow = useCallback((id: string) => {
    // Placeholder icons → funny error
    if (PLACEHOLDER_ICONS.some((p) => p.id === id)) {
      alert(missingFeatureMessage());
      return;
    }

    const experience = experiences.find((e) => e.id === id);
    if (!experience) return;

    setOpenWindows((prev) => {
      // Already open → just bring to front
      if (prev.some((w) => w.id === id)) {
        maxZ++;
        const z = maxZ;
        setActiveWindowId(id);
        return prev.map((w) => (w.id === id ? { ...w, zIndex: z } : w));
      }

      // Stagger each new window slightly
      const offset = (windowSeq % 8) * 32;
      windowSeq++;
      maxZ++;

      const newWin: OpenWindow = {
        id,
        title: experience.title,
        icon: EXPERIENCE_ICONS[id] ?? "🖥️",
        experience,
        zIndex: maxZ,
        defaultPosition: {
          x: 80 + offset,
          y: 48 + offset,
        },
      };

      setActiveWindowId(id);
      return [...prev, newWin];
    });
  }, []);

  const closeWindow = useCallback((id: string) => {
    setOpenWindows((prev) => prev.filter((w) => w.id !== id));
    setActiveWindowId((cur) => (cur === id ? null : cur));
  }, []);

  const focusWindow = useCallback((id: string) => {
    maxZ++;
    const z = maxZ;
    setOpenWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: z } : w))
    );
    setActiveWindowId(id);
  }, []);

  return (
    <div className="ns-desktop">
      {/* ── Icon grid ── */}
      <div className="ns-desktop__icons">
        {PLACEHOLDER_ICONS.map((p) => (
          <DesktopIcon
            key={p.id}
            id={p.id}
            title={p.title}
            icon={p.icon}
            onOpen={openWindow}
          />
        ))}
        {experiences.map((exp) => (
          <DesktopIcon
            key={exp.id}
            id={exp.id}
            title={exp.title}
            icon={EXPERIENCE_ICONS[exp.id] ?? "🖥️"}
            onOpen={openWindow}
          />
        ))}
      </div>

      {/* ── Branding watermark ── */}
      <div className="ns-desktop__brand" aria-hidden>
        <span className="ns-desktop__brand-name">
          <a
            className="ns-desktop__brand-link"
            href="https://noahwright.dev"
            target="_blank"
            rel="noreferrer"
          >
            Noahsoft
          </a>
        </span>
        <span className="ns-desktop__brand-sub">NS Doors 97</span>
      </div>

      {/* ── Open windows ── */}
      {openWindows.map((win) => (
        <Window
          key={win.id}
          id={win.id}
          title={win.title}
          icon={win.icon}
          zIndex={win.zIndex}
          defaultPosition={win.defaultPosition}
          onClose={closeWindow}
          onFocus={focusWindow}
        >
          <AppLauncher
            experience={win.experience}
            onPlay={() => navigate(win.experience.path)}
          />
        </Window>
      ))}

      {/* ── Taskbar ── */}
      <Taskbar
        windows={openWindows.map((w) => ({
          id: w.id,
          title: w.title,
          icon: w.icon,
        }))}
        activeWindowId={activeWindowId}
        onWindowFocus={focusWindow}
      />
    </div>
  );
}
