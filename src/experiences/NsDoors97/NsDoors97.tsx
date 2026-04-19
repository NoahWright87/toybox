import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { experiences, type Experience } from "../../data/experiences";
import { missingFeatureMessage } from "../../utils/missingFeatureMessage";
import { randomDelay } from "../../utils/retroTiming";
import { useOsDialog } from "./OsDialog";
import DesktopIcon from "./DesktopIcon";
import Window from "./Window";
import Taskbar from "./Taskbar";
import ScreensaverApp from "./ScreensaverApp";
import ScreensaverOverlay from "./ScreensaverOverlay";
import {
  loadScreensaverConfig,
  saveScreensaverConfig,
  type FullScreensaverConfig,
  type AllScreensaverSettings,
  type ScreensaverId,
} from "./screensaverSettings";
import AboutApp from "./AboutApp";
import FolderApp from "./FolderApp";
import FilesApp from "./FilesApp";
import NotebookApp from "./NotebookApp";
import InternetApp from "./InternetApp";
import TicTacToe from "../TicTacToe/TicTacToe";
import NumberMuncher from "../NumberMuncher/NumberMuncher";
import BombFinder, { type Difficulty as BfDifficulty } from "../BombFinder/BombFinder";
import CardsLauncher from "../Cards/CardsLauncher";
import NoGame from "../Cards/NoGame";
import type { CardsGame, DeckSettings } from "../Cards/types";
import BootScreen, { shouldShowBoot, playShutdownSound } from "./BootScreen";
import "./NsDoors97.css";

// ── Icon / experience config ───────────────────────────────────────────────

const EXPERIENCE_ICONS: Record<string, string> = {
  starfield:            "⭐",
  fireworks:            "🎆",
  "bouncing-shapes":    "🔷",
  "scrolling-text":     "📜",
  "bouncing-polygons":  "🔺",
  "raining-emojis":     "🌧️",
  "typing-racer":       "⌨️",
  "number-muncher":     "🔢",
  "tic-tac-toe":        "✖️",
  "word-whirlwind":     "🌪️",
  "bomb-finder":        "💣",
  "ns-doors-97":        "🚪",
};

type DesktopIconAction =
  | "placeholder"
  | "experience"
  | "screensavers"
  | "tictactoe"
  | "nomnom"
  | "bombfinder"
  | "cards"
  | "about"
  | "my-doors"
  | "internet"
  | "files"
  | "notebook";

interface DesktopIconDef {
  id: string;
  title: string;
  icon: string;
  action: DesktopIconAction;
}

const STATIC_ICONS: DesktopIconDef[] = [
  { id: "my-doors",     title: "My Doors",     icon: "🖥️", action: "my-doors"     },
  { id: "files",        title: "My Files",     icon: "📁", action: "files"        },
  { id: "notebook",     title: "Notebook",     icon: "📝", action: "notebook"     },
  { id: "recycle-bin",  title: "Recycle Bin",  icon: "🗑️", action: "placeholder"  },
  { id: "about",        title: "About NS Doors 97", icon: "ℹ️", action: "about"   },
  { id: "internet",     title: "Internet",     icon: "🌐", action: "internet"     },
  { id: "screensavers", title: "Screensavers", icon: "💤", action: "screensavers" },
  { id: "cards",        title: "Cards",        icon: "🃏", action: "cards"        },
];

const EXPERIENCE_ICON_DEFS: DesktopIconDef[] = experiences
  .filter((e) => e.id !== "ns-doors-97" && e.category !== "screensaver")
  .map((e) => ({
    id: e.id,
    title: e.title,
    icon: EXPERIENCE_ICONS[e.id] ?? "🖥️",
    action: (
      e.id === "tic-tac-toe" ? "tictactoe" :
      e.id === "number-muncher" ? "nomnom" :
      e.id === "bomb-finder" ? "bombfinder" :
      "experience"
    ) as DesktopIconAction,
  }));

const ALL_DESKTOP_ICONS = [...STATIC_ICONS, ...EXPERIENCE_ICON_DEFS];

// ── Window content union ───────────────────────────────────────────────────

type WindowContent =
  | { type: "app-launcher"; experience: Experience }
  | { type: "screensaver-settings" }
  | { type: "tictactoe" }
  | { type: "nomnom" }
  | { type: "bombfinder" }
  | { type: "cards-launcher" }
  | { type: "cards-game"; game: CardsGame; settings: DeckSettings }
  | { type: "about" }
  | { type: "my-doors" }
  | { type: "internet" }
  | { type: "files" }
  | { type: "notebook"; filePath: string; fileName: string; initialContent: string };

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
const BF_WINDOW_WIDTHS: Record<BfDifficulty, number> = {
  beginner: 310,
  intermediate: 470,
  expert: 820,
};

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

  const [showBoot, setShowBoot]           = useState(() => shouldShowBoot());
  const [shuttingDown, setShuttingDown]   = useState(false);
  const [desktopLoading, setDesktopLoading] = useState(false);

  // Icons visible on desktop — starts empty when there's a boot screen,
  // all-visible immediately when there isn't one.
  const [visibleIcons, setVisibleIcons] = useState<ReadonlySet<string>>(() => {
    if (shouldShowBoot()) return new Set<string>();
    return new Set(ALL_DESKTOP_ICONS.map((d) => d.id));
  });

  // Called when the boot screen finishes (both initial boot and after restart)
  const handleBootComplete = useCallback(() => {
    setShowBoot(false);
    setDesktopLoading(true);
  }, []);

  const handleRestart = useCallback(() => {
    playShutdownSound();
    setShuttingDown(true);
    setVisibleIcons(new Set()); // icons will re-pop-in after boot
    setTimeout(() => {
      setShuttingDown(false);
      setShowBoot(true);
    }, 1500);
  }, []);

  // ── Janky desktop startup ────────────────────────────────────────────────
  useEffect(() => {
    if (!desktopLoading) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (cb: () => void, ms: number) => {
      const id = setTimeout(() => { if (!cancelled) cb(); }, ms);
      timers.push(id);
    };

    // Phase 1 — hourglass while "system initialises"
    document.body.style.cursor = "wait";

    const phase1 = randomDelay({ base: 900, variance: 0.6, panicChance: 0.15, panicMultiplier: 4 });
    t(() => {
      document.body.style.cursor = "";

      // Phase 2 — icons pop in one by one in random order
      const shuffled = [...ALL_DESKTOP_ICONS.map((d) => d.id)];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      let iconDelay = 0;
      shuffled.forEach((id) => {
        iconDelay += randomDelay({ base: 130, variance: 0.8, panicChance: 0.03, panicMultiplier: 5 });
        t(() => setVisibleIcons((prev) => new Set([...prev, id])), iconDelay);
      });

      // Maybe flash hourglass again partway through — 55% chance
      if (Math.random() < 0.55) {
        const freezeAt  = iconDelay * (0.25 + Math.random() * 0.35);
        const freezeFor = randomDelay({ base: 700, variance: 0.5, panicChance: 0.12, panicMultiplier: 4 });
        t(() => { document.body.style.cursor = "wait"; }, freezeAt);
        t(() => { document.body.style.cursor = ""; },     freezeAt + freezeFor);
      }

      t(() => setDesktopLoading(false), iconDelay + 100);
    }, phase1);

    return () => {
      cancelled = true;
      document.body.style.cursor = "";
      timers.forEach(clearTimeout);
    };
  }, [desktopLoading]);

  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  // ── Screensaver ──────────────────────────────────────────────────────────
  const [screensaverConfig, setScreensaverConfig] = useState<FullScreensaverConfig>(
    () => loadScreensaverConfig()
  );
  // Active overlay: either auto-triggered (uses saved settings) or preview (uses unsaved settings)
  const [activeOverlay, setActiveOverlay] = useState<{
    id: ScreensaverId;
    settings: AllScreensaverSettings;
  } | null>(null);

  const screensaverConfigRef = useRef(screensaverConfig);
  useEffect(() => { screensaverConfigRef.current = screensaverConfig; }, [screensaverConfig]);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    const { screensaver, waitMinutes, settings } = screensaverConfigRef.current;
    if (screensaver && waitMinutes > 0) {
      idleTimerRef.current = setTimeout(() => {
        setActiveOverlay({ id: screensaver, settings });
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
        case "files":        content = { type: "files" };                width = 600; break;
        case "notebook":     content = { type: "notebook", filePath: "(new file)", fileName: "Untitled.txt", initialContent: "" }; width = 560; break;
        case "tictactoe":    content = { type: "tictactoe" };            width = TTT_WINDOW_WIDTHS[3]; break;
        case "nomnom":       content = { type: "nomnom" };               width = 700; break;
        case "bombfinder":   content = { type: "bombfinder" };           width = BF_WINDOW_WIDTHS.beginner; break;
        case "cards":        content = { type: "cards-launcher" };       width = 320; break;
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

  const openNotebook = useCallback(
    (filePath: string, fileName: string, initialContent: string) => {
      const winId = `notebook:${filePath}`;
      setOpenWindows((prev) => {
        if (prev.some((w) => w.id === winId)) {
          maxZ++;
          setActiveWindowId(winId);
          return prev.map((w) => (w.id === winId ? { ...w, zIndex: maxZ } : w));
        }
        const offset = (windowSeq % 8) * 32;
        windowSeq++;
        maxZ++;
        setActiveWindowId(winId);
        return [
          ...prev,
          {
            id: winId,
            title: fileName,
            icon: "📝",
            content: { type: "notebook" as const, filePath, fileName, initialContent },
            zIndex: maxZ,
            defaultPosition: { x: 100 + offset, y: 60 + offset },
            width: 560,
          },
        ];
      });
    },
    []
  );

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

  // Called by BombFinder when difficulty changes — resize the window
  const handleBfDifficultyChange = useCallback(
    (winId: string, diff: BfDifficulty) => {
      setOpenWindows((prev) =>
        prev.map((w) =>
          w.id === winId ? { ...w, width: BF_WINDOW_WIDTHS[diff] } : w
        )
      );
    },
    []
  );

  // Close the Cards launcher and open the chosen game in a new window
  const handleCardsLaunch = useCallback(
    (launcherWinId: string, game: CardsGame, settings: DeckSettings) => {
      setOpenWindows((prev) => {
        const filtered = prev.filter((w) => w.id !== launcherWinId);
        const offset = (windowSeq % 8) * 32;
        windowSeq++;
        maxZ++;
        setActiveWindowId("cards-game");
        return [
          ...filtered,
          {
            id: "cards-game",
            title: "No Game",
            icon: "🃏",
            content: { type: "cards-game" as const, game, settings },
            zIndex: maxZ,
            defaultPosition: { x: 80 + offset, y: 48 + offset },
            width: 380,
          },
        ];
      });
    },
    []
  );

  // Close the Cards game and reopen the launcher
  const handleCardsGameClose = useCallback((id: string) => {
    setOpenWindows((prev) => {
      const filtered = prev.filter((w) => w.id !== id);
      const offset = (windowSeq % 8) * 32;
      windowSeq++;
      maxZ++;
      setActiveWindowId("cards");
      return [
        ...filtered,
        {
          id: "cards",
          title: "Cards",
          icon: "🃏",
          content: { type: "cards-launcher" as const },
          zIndex: maxZ,
          defaultPosition: { x: 80 + offset, y: 48 + offset },
          width: 320,
        },
      ];
    });
  }, []);

  return (
    <div className="ns-desktop">
      {/* ── Icon grid (icons pop in one by one during boot) ── */}
      <div className="ns-desktop__icons">
        {ALL_DESKTOP_ICONS.filter((def) => visibleIcons.has(def.id)).map((def) => (
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
          onClose={win.content.type === "cards-game" ? handleCardsGameClose : closeWindow}
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
          {win.content.type === "nomnom" && <NumberMuncher />}
          {win.content.type === "cards-launcher" && (
            <CardsLauncher
              onLaunch={(game, settings) => handleCardsLaunch(win.id, game, settings)}
            />
          )}
          {win.content.type === "cards-game" && (
            <NoGame settings={win.content.settings} />
          )}
          {win.content.type === "bombfinder" && (
            <BombFinder
              onDifficultyChange={(diff) =>
                handleBfDifficultyChange(win.id, diff)
              }
            />
          )}
          {win.content.type === "screensaver-settings" && (
            <ScreensaverApp
              config={screensaverConfig}
              onSave={(cfg) => {
                setScreensaverConfig(cfg);
                saveScreensaverConfig(cfg);
                closeWindow(win.id);
              }}
              onPreview={(screensaver, settings) => {
                setActiveOverlay({ id: screensaver, settings });
              }}
              onCancel={() => closeWindow(win.id)}
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
          {win.content.type === "files" && (
            <FilesApp
              onOpenApp={openWindow}
              onOpenNotebook={openNotebook}
            />
          )}
          {win.content.type === "notebook" && (
            <NotebookApp
              filePath={win.content.filePath}
              fileName={win.content.fileName}
              initialContent={win.content.initialContent}
            />
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
      {activeOverlay && (
        <ScreensaverOverlay
          screensaver={activeOverlay.id}
          settings={activeOverlay.settings}
          onDismiss={() => {
            setActiveOverlay(null);
            resetIdleTimer();
          }}
        />
      )}

      {/* ── Shutdown overlay (black screen while restarting) ── */}
      {shuttingDown && <div className="ns-shutdown-overlay" />}

      {/* ── Boot screen (renders on top of everything) ── */}
      {showBoot && (
        <BootScreen onComplete={handleBootComplete} />
      )}
    </div>
  );
}
