import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { experiences, type Experience } from "../../data/experiences";
import { missingFeatureMessage } from "../../utils/missingFeatureMessage";
import DesktopIcon from "./DesktopIcon";
import Window from "./Window";
import Taskbar from "./Taskbar";
import ScreensaverApp from "./ScreensaverApp";
import ScreensaverOverlay, { type ScreensaverId } from "./ScreensaverOverlay";
import "./NsDoors97.css";

// ── Icon config ───────────────────────────────────────────────────────────────

const EXPERIENCE_ICONS: Record<string, string> = {
  starfield: "⭐",
  fireworks: "🎆",
  "bouncing-shapes": "🔷",
  "typing-racer": "⌨️",
  "number-muncher": "🔢",
  "tic-tac-toe": "✖️",
  "word-whirlwind": "🌪️",
  "ns-doors-97": "🚪",
};

type DesktopIconAction = "placeholder" | "experience" | "screensavers";

interface DesktopIconDef {
  id: string;
  title: string;
  icon: string;
  action: DesktopIconAction;
}

const STATIC_ICONS: DesktopIconDef[] = [
  { id: "my-doors",     title: "My Doors",    icon: "🖥️", action: "placeholder"  },
  { id: "recycle-bin",  title: "Recycle Bin", icon: "🗑️", action: "placeholder"  },
  { id: "screensavers", title: "Screensavers", icon: "💤", action: "screensavers" },
];

const EXPERIENCE_ICON_DEFS: DesktopIconDef[] = experiences
  // Don't show the NS Doors 97 card inside itself
  .filter((e) => e.id !== "ns-doors-97")
  .map((e) => ({
    id: e.id,
    title: e.title,
    icon: EXPERIENCE_ICONS[e.id] ?? "🖥️",
    action: "experience" as const,
  }));

const ALL_DESKTOP_ICONS = [...STATIC_ICONS, ...EXPERIENCE_ICON_DEFS];

// ── Window content types ──────────────────────────────────────────────────────

type WindowContent =
  | { type: "app-launcher"; experience: Experience }
  | { type: "screensaver-settings" };

interface OpenWindow {
  id: string;
  title: string;
  icon: string;
  content: WindowContent;
  zIndex: number;
  defaultPosition: { x: number; y: number };
}

let windowSeq = 0;
let maxZ = 100;

// ── App Launcher card (inside experience windows) ─────────────────────────────

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
      <p className="ns-launcher__hint">Opens full-screen. Use browser back to return.</p>
    </div>
  );
}

// ── Main Desktop ──────────────────────────────────────────────────────────────

export default function NsDoors97() {
  const navigate = useNavigate();
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  // Screensaver state
  const [screensaverConfig, setScreensaverConfig] = useState<{
    screensaver: ScreensaverId | null;
    waitMinutes: number;
  }>({ screensaver: null, waitMinutes: 1 });
  const [activeScreensaver, setActiveScreensaver] = useState<ScreensaverId | null>(null);

  // ── Idle detection ──────────────────────────────────────────────────────────
  const screensaverConfigRef = useRef(screensaverConfig);
  useEffect(() => {
    screensaverConfigRef.current = screensaverConfig;
  }, [screensaverConfig]);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    const { screensaver, waitMinutes } = screensaverConfigRef.current;
    if (screensaver) {
      idleTimerRef.current = setTimeout(() => {
        setActiveScreensaver(screensaver);
      }, waitMinutes * 60 * 1000);
    }
  }, []);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart"] as const;
    events.forEach((e) => document.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach((e) => document.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // ── Window management ───────────────────────────────────────────────────────

  const openWindow = useCallback((id: string) => {
    const iconDef = ALL_DESKTOP_ICONS.find((d) => d.id === id);
    if (!iconDef) return;

    if (iconDef.action === "placeholder") {
      alert(missingFeatureMessage());
      return;
    }

    setOpenWindows((prev) => {
      // Already open → bring to front
      if (prev.some((w) => w.id === id)) {
        maxZ++;
        const z = maxZ;
        setActiveWindowId(id);
        return prev.map((w) => (w.id === id ? { ...w, zIndex: z } : w));
      }

      const offset = (windowSeq % 8) * 32;
      windowSeq++;
      maxZ++;

      let content: WindowContent;
      if (iconDef.action === "screensavers") {
        content = { type: "screensaver-settings" };
      } else {
        const experience = experiences.find((e) => e.id === id)!;
        content = { type: "app-launcher", experience };
      }

      const newWin: OpenWindow = {
        id,
        title: iconDef.title,
        icon: iconDef.icon,
        content,
        zIndex: maxZ,
        defaultPosition: { x: 80 + offset, y: 48 + offset },
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
        {ALL_DESKTOP_ICONS.map((def) => (
          <DesktopIcon
            key={def.id}
            id={def.id}
            title={def.title}
            icon={def.icon}
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
          {win.content.type === "app-launcher" && (
            <AppLauncher
              experience={win.content.experience}
              onPlay={() => navigate((win.content as { type: "app-launcher"; experience: Experience }).experience.path)}
            />
          )}
          {win.content.type === "screensaver-settings" && (
            <ScreensaverApp
              currentScreensaver={screensaverConfig.screensaver}
              waitMinutes={screensaverConfig.waitMinutes}
              onSave={(screensaver, waitMinutes) => {
                setScreensaverConfig({ screensaver, waitMinutes });
                closeWindow(win.id);
              }}
              onPreview={(screensaver) => setActiveScreensaver(screensaver)}
            />
          )}
        </Window>
      ))}

      {/* ── Taskbar ── */}
      <Taskbar
        windows={openWindows.map((w) => ({ id: w.id, title: w.title, icon: w.icon }))}
        activeWindowId={activeWindowId}
        onWindowFocus={focusWindow}
      />

      {/* ── Screensaver overlay ── */}
      {activeScreensaver && (
        <ScreensaverOverlay
          screensaver={activeScreensaver}
          onDismiss={() => {
            setActiveScreensaver(null);
            resetIdleTimer();
          }}
        />
      )}
    </div>
  );
}
