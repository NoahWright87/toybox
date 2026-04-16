import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { experiences, type Experience } from "../../data/experiences";
import { missingFeatureMessage } from "../../utils/missingFeatureMessage";
import { useOsDialog } from "./OsDialog";
import DesktopIcon from "./DesktopIcon";
import Window from "./Window";
import Taskbar from "./Taskbar";
import ScreensaverApp from "./ScreensaverApp";
import ScreensaverOverlay, { type ScreensaverId } from "./ScreensaverOverlay";
import AboutApp from "./AboutApp";
import FolderApp from "./FolderApp";
import InternetApp from "./InternetApp";
import TicTacToe from "../TicTacToe/TicTacToe";
import BootScreen, { shouldShowBoot, playShutdownSound } from "./BootScreen";
import "./NsDoors97.css";

// ── Icon / experience config ───────────────────────────────────────────────

const EXPERIENCE_ICONS: Record<string, string> = {
  starfield:          "⭐",
  fireworks:          "🎆",
  "bouncing-shapes":  "🔷",
  "typing-racer":     "⌨️",
  "number-muncher":   "🔢",
  "tic-tac-toe":      "✖️",
  "word-whirlwind":   "🌪️",
  "ns-doors-97":      "🚪",
};

type DesktopIconAction =
  | "placeholder"
  | "experience"
  | "screensavers"
  | "tictactoe"
  | "about"
  | "my-doors"
  | "internet";

interface DesktopIconDef {
  id: string;
  title: string;
  icon: string;
  action: DesktopIconAction;
}

const STATIC_ICONS: DesktopIconDef[] = [
  { id: "my-doors",     title: "My Doors",     icon: "🖥️", action: "my-doors"     },
  { id: "recycle-bin",  title: "Recycle Bin",  icon: "🗑️", action: "placeholder"  },
  { id: "about",        title: "About NS Doors 97", icon: "ℹ️", action: "about"   },
  { id: "internet",     title: "Internet",     icon: "🌐", action: "internet"     },
  { id: "screensavers", title: "Screensavers", icon: "💤", action: "screensavers" },
];

const EXPERIENCE_ICON_DEFS: DesktopIconDef[] = experiences
  .filter((e) => e.id !== "ns-doors-97")
  .map((e) => ({
    id: e.id,
    title: e.title,
    icon: EXPERIENCE_ICONS[e.id] ?? "🖥️",
    action: (e.id === "tic-tac-toe" ? "tictactoe" : "experience") as DesktopIconAction,
  }));

const ALL_DESKTOP_ICONS = [...STATIC_ICONS, ...EXPERIENCE_ICON_DEFS];

// ── Window content union ───────────────────────────────────────────────────

type WindowContent =
  | { type: "app-launcher"; experience: Experience }
  | { type: "screensaver-settings" }
  | { type: "tictactoe" }
  | { type: "about" }
  | { type: "my-doors" }
  | { type: "internet" };

interface OpenWindow {
  id: string;
  title: string;
  icon: string;
  content: WindowContent;
  zIndex: number;
  defaultPosition: { x: number; y: number };
  width?: number;
}

let windowSeq = 0;
let maxZ = 100;

const TTT_WINDOW_WIDTHS: Record<3 | 5 | 7, number> = { 3: 380, 5: 480, 7: 580 };

// ── App Launcher card ──────────────────────────────────────────────────────

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

// ── Main Desktop ───────────────────────────────────────────────────────────

export default function NsDoors97() {
  const navigate = useNavigate();
  const { showDialog } = useOsDialog();

  const [showBoot, setShowBoot] = useState(() => shouldShowBoot());
  const [shuttingDown, setShuttingDown] = useState(false);

  const handleRestart = useCallback(() => {
    playShutdownSound();
    setShuttingDown(true);
    setTimeout(() => {
      setShuttingDown(false);
      setShowBoot(true);
    }, 1500);
  }, []);

  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  // ── Screensaver ──────────────────────────────────────────────────────────
  const [screensaverConfig, setScreensaverConfig] = useState<{
    screensaver: ScreensaverId | null;
    waitMinutes: number;
  }>({ screensaver: null, waitMinutes: 1 });
  const [activeScreensaver, setActiveScreensaver] = useState<ScreensaverId | null>(null);

  const screensaverConfigRef = useRef(screensaverConfig);
  useEffect(() => { screensaverConfigRef.current = screensaverConfig; }, [screensaverConfig]);

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

  // ── Window management ────────────────────────────────────────────────────

  const openWindow = useCallback((id: string) => {
    const iconDef = ALL_DESKTOP_ICONS.find((d) => d.id === id);
    if (!iconDef) return;

    if (iconDef.action === "placeholder") {
      showDialog(missingFeatureMessage());
      return;
    }

    setOpenWindows((prev) => {
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
      let width: number | undefined;

      switch (iconDef.action) {
        case "screensavers": content = { type: "screensaver-settings" }; width = 440; break;
        case "about":        content = { type: "about" };                width = 340; break;
        case "my-doors":     content = { type: "my-doors" };             width = 440; break;
        case "internet":     content = { type: "internet" };             width = 640; break;
        case "tictactoe":    content = { type: "tictactoe" };            width = TTT_WINDOW_WIDTHS[3]; break;
        case "experience": {
          const experience = experiences.find((e) => e.id === id)!;
          content = { type: "app-launcher", experience };
          break;
        }
        default: return prev;
      }

      setActiveWindowId(id);
      return [
        ...prev,
        {
          id,
          title: iconDef.title,
          icon: iconDef.icon,
          content,
          zIndex: maxZ,
          defaultPosition: { x: 80 + offset, y: 48 + offset },
          width,
        },
      ];
    });
  }, [showDialog]);

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

  // Called by TicTacToe when board size changes — resize the window
  const handleTttBoardSizeChange = useCallback(
    (winId: string, boardSize: 3 | 5 | 7) => {
      setOpenWindows((prev) =>
        prev.map((w) =>
          w.id === winId ? { ...w, width: TTT_WINDOW_WIDTHS[boardSize] } : w
        )
      );
    },
    []
  );

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
          width={win.width}
          onClose={closeWindow}
          onFocus={focusWindow}
        >
          {win.content.type === "app-launcher" && (
            <AppLauncher
              experience={win.content.experience}
              onPlay={() =>
                navigate(
                  (win.content as Extract<WindowContent, { type: "app-launcher" }>)
                    .experience.path
                )
              }
            />
          )}
          {win.content.type === "tictactoe" && (
            <TicTacToe
              onBoardSizeChange={(size) =>
                handleTttBoardSizeChange(win.id, size)
              }
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
          {win.content.type === "about" && (
            <AboutApp onClose={() => closeWindow(win.id)} />
          )}
          {win.content.type === "my-doors" && (
            <FolderApp onOpenExperience={openWindow} />
          )}
          {win.content.type === "internet" && (
            <InternetApp onOpenExperience={openWindow} />
          )}
        </Window>
      ))}

      {/* ── Taskbar ── */}
      <Taskbar
        windows={openWindows.map((w) => ({ id: w.id, title: w.title, icon: w.icon }))}
        activeWindowId={activeWindowId}
        onWindowFocus={focusWindow}
        onRestart={handleRestart}
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

      {/* ── Shutdown overlay (black screen while restarting) ── */}
      {shuttingDown && <div className="ns-shutdown-overlay" />}

      {/* ── Boot screen (renders on top of everything) ── */}
      {showBoot && (
        <BootScreen onComplete={() => setShowBoot(false)} />
      )}
    </div>
  );
}
