import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
import FilesApp from "./FilesApp";
import NotebookApp from "./NotebookApp";
import InternetApp from "./InternetApp";
import NsArt, { type NsArtHandle } from "../NsArt/NsArt";
import WordWhirlwind from "../WordWhirlwind/WordWhirlwind";
import Words from "../Words/Words";
import TicTacToe from "../TicTacToe/TicTacToe";
import Pool from "../Pool/Pool";
import DuckHunt from "../DuckHunt/DuckHunt";
import NumberMuncher from "../NumberMuncher/NumberMuncher";
import SoundRecorder, { lsGetSoundNames } from "./SoundRecorder";
import MidiEditor from "../MidiEditor/MidiEditor";
import BombFinder, { type Difficulty as BfDifficulty } from "../BombFinder/BombFinder";
import CardsLauncher from "../Cards/CardsLauncher";
import War from "../Cards/War";
import Blackjack from "../Cards/Blackjack";
import Pyramid from "../Cards/Pyramid";
import type { CardsGame, DeckSettings } from "../Cards/types";
import BootScreen, { shouldShowBoot, playShutdownSound } from "./BootScreen";
import DisplayApp, { WALLPAPER_PRESET_URLS } from "./DisplayApp";
import {
  loadDesktopSettings,
  saveDesktopSettings,
  getDesktopBackground,
  type DesktopSettings,
} from "./desktopSettings";
import "./NsDoors97.css";

// ── App registry ───────────────────────────────────────────────────────────────
// All apps that can be opened (whether via desktop icon or Open menu).

type AppAction =
  | "placeholder"
  | "experience"
  | "screensavers"
  | "pool"
  | "tictactoe"
  | "nomnom"
  | "wordwhirlwind"
  | "words"
  | "bombfinder"
  | "duckhunt"
  | "cards"
  | "about"
  | "internet"
  | "files"
  | "notebook"
  | "nsart"
  | "art-backup"
  | "readme"
  | "sound-recorder"
  | "midi-editor";

interface AppDef {
  title: string;
  icon: string;
  action: AppAction;
}

const APP_REGISTRY: Record<string, AppDef> = {
  "my-doors":       { title: "My Doors",          icon: "🖥️", action: "files"         },
  "dumpster":       { title: "Dumpster",           icon: "🗑️", action: "placeholder"   },
  "readme":         { title: "README.txt",         icon: "📋", action: "readme"        },
  "about":          { title: "About NS Doors 97",  icon: "ℹ️",  action: "about"         },
  "internet":       { title: "Internet",           icon: "🌐", action: "internet"      },
  "screensavers":   { title: "Screensavers",       icon: "💤", action: "screensavers"  },
  "notebook":       { title: "Notebook",           icon: "📝", action: "notebook"      },
  "cards":          { title: "Cards",              icon: "🃏", action: "cards"         },
  "ns-art":         { title: "NS Art",             icon: "🎨", action: "nsart"         },
  "pool":           { title: "8-Ball Pool",        icon: "🎱", action: "pool"          },
  "tic-tac-toe":    { title: "Tic-Tac-Toe",       icon: "✖️",  action: "tictactoe"     },
  "number-muncher": { title: "Nom Nom Numerals",   icon: "🔢", action: "nomnom"        },
  "word-whirlwind": { title: "Word Whirlwind",     icon: "🌪️", action: "wordwhirlwind" },
  "words":          { title: "WORDS",              icon: "🔤", action: "words"         },
  "bomb-finder":    { title: "Bomb Finder",        icon: "💣", action: "bombfinder"    },
  "duck-hunt":      { title: "Duck & Learn",       icon: "🎯", action: "duckhunt"        },
  "typing-racer":   { title: "Type 'Em Up",        icon: "⌨️", action: "experience"      },
  "sound-recorder": { title: "Sound Recorder",     icon: "🎙️", action: "sound-recorder"  },
  "midi-editor":    { title: "MIDI Editor",         icon: "🎹", action: "midi-editor"     },
};

// ── Desktop icon entries (subset actually shown on desktop) ───────────────────

interface DesktopIconEntry {
  id: string;
  title: string;
  icon: string;
}

const STATIC_DESKTOP_ICONS: DesktopIconEntry[] = [
  { id: "my-doors",  title: "My Doors",  icon: "🖥️" },
  { id: "dumpster",  title: "Dumpster",  icon: "🗑️" },
];

const STATIC_RIGHT_ICONS: DesktopIconEntry[] = [
  { id: "readme", title: "README.txt", icon: "📋" },
];

const DESKTOP_README = `IMPORTANT NOTE TO MYSELF
=========================

To play HELL.EXE you can NOT just
double-click it. I know. I tried.
It gives you a whole lecture.

You have to go through the TOS
(the scary black text screen).

HOW TO DO IT (I keep forgetting):

  1. Click Start
  2. Programs
  3. NS-TOS
  4. Type this exactly:
       cd Programs\\Games
       HELL.EXE
  5. Press Enter. That's it!!

Gerald says I "should not have
that game installed." Gerald has
never beaten level 3. I have.

DO NOT tell Gerald.

                        - Noah

P.S. If you get stuck in the text
screen just type DOORS to come back.
`;

const NB_PREFIX = "ns97_notebook_";
const README_PATH = "C:\\Desktop\\README.txt";

function loadSavedNotebookIcons(): DesktopIconEntry[] {
  const entries: DesktopIconEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(NB_PREFIX)) continue;
    const filePath = key.slice(NB_PREFIX.length);
    if (filePath === "(new file)" || filePath === README_PATH) continue;
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    entries.push({ id: `nb:${filePath}`, title: fileName, icon: "📝" });
  }
  return entries;
}

function loadSavedSoundIcons(): DesktopIconEntry[] {
  return lsGetSoundNames().map(name => ({ id: `sound:${name}`, title: name, icon: "🎵" }));
}

// ── Window content union ───────────────────────────────────────────────────

type WindowContent =
  | { type: "app-launcher"; experience: Experience }
  | { type: "screensaver-settings" }
  | { type: "pool" }
  | { type: "tictactoe" }
  | { type: "nomnom" }
  | { type: "word-whirlwind" }
  | { type: "words" }
  | { type: "bombfinder" }
  | { type: "duckhunt" }
  | { type: "cards-launcher" }
  | { type: "cards-game"; game: CardsGame; settings: DeckSettings }
  | { type: "about" }
  | { type: "internet" }
  | { type: "files" }
  | { type: "notebook"; filePath: string; fileName: string; initialContent: string }
  | { type: "desktop-display" }
  | { type: "nsart" }
  | { type: "nsart-backup" }
  | { type: "sound-recorder"; fileName?: string }
  | { type: "midi-editor" };

interface OpenWindow {
  id: string;
  title: string;
  icon: string;
  content: WindowContent;
  zIndex: number;
  defaultPosition: { x: number; y: number };
  width?: number;
  minimized: boolean;
}

let windowSeq = 0;
let maxZ = 100;

const TTT_WINDOW_WIDTHS: Record<3 | 5 | 7, number> = { 3: 380, 5: 480, 7: 580 };
const CARDS_GAME_TITLES: Record<CardsGame, string> = { "war": "War", "blackjack": "Blackjack", "pyramid": "Pyramid" };
const CARDS_GAME_WIDTHS: Record<CardsGame, number> = { "war": 440, "blackjack": 520, "pyramid": 460 };
const BF_WINDOW_WIDTHS: Record<BfDifficulty, number> = {
  beginner: 310,
  intermediate: 470,
  expert: 820,
};

// ── App Launcher card ──────────────────────────────────────────────────────

const EXPERIENCE_ICONS: Record<string, string> = {
  "typing-racer": "⌨️",
};

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
  const location = useLocation();
  const { showDialog } = useOsDialog();

  // Returning from NS-TOS shows only the splash screen (no BIOS), then desktop.
  const fromTos = (location.state as { fromTos?: boolean } | null)?.fromTos === true;
  // Returning from a standalone app page skips boot entirely.
  const skipBoot = (location.state as { skipBoot?: boolean } | null)?.skipBoot === true;
  const initialShouldBoot = !skipBoot && (fromTos || shouldShowBoot());

  const nsArtRef       = useRef<NsArtHandle>(null);

  const [showBoot, setShowBoot]             = useState(initialShouldBoot);
  const [shuttingDown, setShuttingDown]     = useState(false);
  const [desktopLoading, setDesktopLoading] = useState(false);

  // Saved notebook files that appear on the desktop
  const [savedNotebookIcons, setSavedNotebookIcons] = useState<DesktopIconEntry[]>(
    () => loadSavedNotebookIcons()
  );
  const savedNotebookIconsRef = useRef(savedNotebookIcons);
  useEffect(() => { savedNotebookIconsRef.current = savedNotebookIcons; }, [savedNotebookIcons]);

  // Saved sound files that appear on the desktop
  const [savedSoundIcons, setSavedSoundIcons] = useState<DesktopIconEntry[]>(
    () => loadSavedSoundIcons()
  );
  const savedSoundIconsRef = useRef(savedSoundIcons);
  useEffect(() => { savedSoundIconsRef.current = savedSoundIcons; }, [savedSoundIcons]);

  // Icons start empty whenever there's a boot screen; all-visible otherwise.
  const [visibleIcons, setVisibleIcons] = useState<ReadonlySet<string>>(() => {
    if (initialShouldBoot) return new Set<string>();
    return new Set<string>([
      ...STATIC_DESKTOP_ICONS.map((d) => d.id),
      ...STATIC_RIGHT_ICONS.map((d) => d.id),
      ...loadSavedNotebookIcons().map((d) => d.id),
      ...loadSavedSoundIcons().map((d) => d.id),
    ]);
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

  const handleExitToTos = useCallback(() => {
    navigate("/ns-tos");
  }, [navigate]);

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
      const allIds = [
        ...STATIC_DESKTOP_ICONS.map((d) => d.id),
        ...STATIC_RIGHT_ICONS.map((d) => d.id),
        ...savedNotebookIconsRef.current.map((d) => d.id),
        ...savedSoundIconsRef.current.map((d) => d.id),
      ];
      const shuffled = [...allIds];
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

  // ── Desktop settings ─────────────────────────────────────────────────────
  const [desktopSettings, setDesktopSettings] = useState<DesktopSettings>(
    () => loadDesktopSettings()
  );

  const openDisplaySettings = useCallback(() => {
    const winId = "desktop-display";
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
          title: "Display Properties",
          icon: "🖥️",
          content: { type: "desktop-display" as const },
          zIndex: maxZ,
          defaultPosition: { x: 100 + offset, y: 60 + offset },
          width: 400,
          minimized: false,
        },
      ];
    });
  }, []);


  // ── Screensaver ──────────────────────────────────────────────────────────
  const [screensaverConfig, setScreensaverConfig] = useState<FullScreensaverConfig>(
    () => loadScreensaverConfig()
  );
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
            minimized: false,
          },
        ];
      });
    },
    []
  );

  const openWindow = useCallback((id: string) => {
    // Sound file desktop icons use "sound:{fileName}" id format
    if (id.startsWith("sound:")) {
      const soundFileName = id.slice(6);
      const winId = `sound-recorder:${soundFileName}`;
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
            title: soundFileName,
            icon: "🎵",
            content: { type: "sound-recorder" as const, fileName: soundFileName },
            zIndex: maxZ,
            defaultPosition: { x: 80 + offset, y: 48 + offset },
            width: 420,
            minimized: false,
          },
        ];
      });
      return;
    }

    // Notebook saved-file desktop icons use "nb:{filePath}" id format
    if (id.startsWith("nb:")) {
      const filePath = id.slice(3);
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      const savedContent = localStorage.getItem(`${NB_PREFIX}${filePath}`) ?? "";
      openNotebook(filePath, fileName, savedContent);
      return;
    }

    const appDef = APP_REGISTRY[id];
    if (!appDef) return;

    if (appDef.action === "placeholder") {
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

      switch (appDef.action) {
        case "screensavers": content = { type: "screensaver-settings" }; width = 440; break;
        case "about":        content = { type: "about" };                width = 340; break;
        case "internet":     content = { type: "internet" };             width = 640; break;
        case "files":        content = { type: "files" };                width = 600; break;
        case "notebook":     content = { type: "notebook", filePath: "(new file)", fileName: "Untitled.txt", initialContent: "" }; width = 560; break;
        case "readme":       content = { type: "notebook", filePath: README_PATH, fileName: "README.txt", initialContent: DESKTOP_README }; width = 420; break;
        case "nsart":        content = { type: "nsart" };                width = 760; break;
        case "art-backup":   content = { type: "nsart-backup" };         width = 760; break;
        case "pool":         content = { type: "pool" };                 width = 800; break;
        case "tictactoe":    content = { type: "tictactoe" };            width = TTT_WINDOW_WIDTHS[3]; break;
        case "nomnom":       content = { type: "nomnom" };               width = 700; break;
        case "wordwhirlwind":content = { type: "word-whirlwind" };       width = 600; break;
        case "words":        content = { type: "words" };                width = 440; break;
        case "bombfinder":   content = { type: "bombfinder" };           width = BF_WINDOW_WIDTHS.beginner; break;
        case "duckhunt":     content = { type: "duckhunt" };             width = 740; break;
        case "cards":          content = { type: "cards-launcher" };                           width = 320; break;
        case "sound-recorder": content = { type: "sound-recorder" as const };                  width = 420; break;
        case "midi-editor":    content = { type: "midi-editor" as const };                     width = 860; break;
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
          title: appDef.title,
          icon: appDef.icon,
          content,
          zIndex: maxZ,
          defaultPosition: { x: 80 + offset, y: 48 + offset },
          width,
          minimized: false,
        },
      ];
    });
  }, [showDialog, openNotebook]);

  const openAbout = useCallback(() => {
    openWindow("about");
  }, [openWindow]);

  const openScreensaverSettings = useCallback(() => {
    openWindow("screensavers");
  }, [openWindow]);

  const closeWindow = useCallback((id: string) => {
    setOpenWindows((prev) => prev.filter((w) => w.id !== id));
    setActiveWindowId((cur) => (cur === id ? null : cur));
  }, []);

  const focusWindow = useCallback((id: string) => {
    maxZ++;
    const z = maxZ;
    setOpenWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: z, minimized: false } : w))
    );
    setActiveWindowId(id);
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setOpenWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, minimized: true } : w))
    );
    setActiveWindowId((cur) => (cur === id ? null : cur));
  }, []);

  // When Notebook saves a file, add it to the desktop if not already there
  const handleNotebookFileSaved = useCallback((filePath: string, fileName: string) => {
    if (filePath === "(new file)" || filePath === README_PATH) return;
    const newId = `nb:${filePath}`;
    setSavedNotebookIcons((prev) => {
      if (prev.some((d) => d.id === newId)) return prev;
      return [...prev, { id: newId, title: fileName, icon: "📝" }];
    });
    setVisibleIcons((prev) => new Set<string>([...prev, newId]));
  }, []);

  // Called by SoundRecorder when a file is saved — add its icon to the desktop
  const handleSoundFileSaved = useCallback((name: string) => {
    const newId = `sound:${name}`;
    setSavedSoundIcons((prev) => {
      if (prev.some((d) => d.id === newId)) return prev;
      return [...prev, { id: newId, title: name, icon: "🎵" }];
    });
    setVisibleIcons((prev) => new Set<string>([...prev, newId]));
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
            title: CARDS_GAME_TITLES[game],
            icon: "🃏",
            content: { type: "cards-game" as const, game, settings },
            zIndex: maxZ,
            defaultPosition: { x: 80 + offset, y: 48 + offset },
            width: CARDS_GAME_WIDTHS[game],
            minimized: false,
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
          minimized: false,
        },
      ];
    });
  }, []);

  // ── Build desktop style (solid/gradient vs wallpaper) ────────────────────
  const desktopStyle: React.CSSProperties = (() => {
    if (desktopSettings.bgType === "wallpaper") {
      const url = desktopSettings.wallpaperPreset
        ? WALLPAPER_PRESET_URLS[desktopSettings.wallpaperPreset]
        : (desktopSettings.wallpaperCustomUrl ?? "");
      return {
        backgroundImage:    url ? `url(${url})` : undefined,
        backgroundSize:     desktopSettings.wallpaperFit,
        backgroundPosition: "center",
        backgroundRepeat:   "no-repeat",
        backgroundColor:    "#000000",
        imageRendering:     "pixelated",
      };
    }
    return { background: getDesktopBackground(desktopSettings) };
  })();

  const rightIcons = [...STATIC_RIGHT_ICONS, ...savedNotebookIcons, ...savedSoundIcons];

  return (
    <div className="ns-desktop" style={desktopStyle}>
      {/* ── Icon grid (icons pop in one by one during boot) ── */}
      <div className="ns-desktop__icons">
        {STATIC_DESKTOP_ICONS
          .filter((def) => visibleIcons.has(def.id))
          .map((def) => (
            <DesktopIcon
              key={def.id}
              id={def.id}
              title={def.title}
              icon={def.icon}
              onOpen={openWindow}
            />
          ))}
      </div>

      {/* ── Right-side pinned icons (README, saved notebook files) ── */}
      <div className="ns-desktop__icons-right">
        {rightIcons.filter((def) => visibleIcons.has(def.id)).map((def) => (
          <DesktopIcon
            key={def.id}
            id={def.id}
            title={def.title}
            icon={def.icon}
            onOpen={openWindow as (id: string) => void}
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
      {(openWindows as OpenWindow[]).map((win) => (
        <Window
          key={win.id}
          id={win.id}
          title={win.title}
          icon={win.icon}
          zIndex={win.zIndex}
          defaultPosition={win.defaultPosition}
          width={win.width}
          minimized={win.minimized}
          onClose={win.content.type === "cards-game" ? handleCardsGameClose : closeWindow}
          onFocus={focusWindow}
          onShrink={minimizeWindow}
          onCloseRequested={
            (win.content.type === "nsart" || win.content.type === "nsart-backup")
              ? (_id, proceed) => {
                  if (nsArtRef.current) { nsArtRef.current.requestClose(proceed); } else { proceed(); }
                }
              : undefined
          }
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
          {win.content.type === "nsart" && (
            <NsArt ref={nsArtRef} onBackupSaved={() => {}} />
          )}
          {win.content.type === "nsart-backup" && (
            <NsArt ref={nsArtRef} onBackupSaved={() => {}} />
          )}
          {win.content.type === "pool" && (
            <Pool onQuit={() => closeWindow(win.id)} />
          )}
          {win.content.type === "tictactoe" && (
            <TicTacToe
              onBoardSizeChange={(size) =>
                handleTttBoardSizeChange(win.id, size)
              }
              onQuit={() => closeWindow(win.id)}
            />
          )}
          {win.content.type === "nomnom" && <NumberMuncher onQuit={() => closeWindow(win.id)} />}
          {win.content.type === "word-whirlwind" && <WordWhirlwind onQuit={() => closeWindow(win.id)} />}
          {win.content.type === "words" && <Words onQuit={() => closeWindow(win.id)} />}
          {win.content.type === "duckhunt" && <DuckHunt />}
          {win.content.type === "cards-launcher" && (
            <CardsLauncher
              onLaunch={(game, settings) => handleCardsLaunch(win.id, game, settings)}
              onQuit={() => closeWindow(win.id)}
            />
          )}
          {win.content.type === "cards-game" && win.content.game === "war" && (
            <War settings={win.content.settings} onNewGame={() => handleCardsGameClose(win.id)} onQuit={() => closeWindow(win.id)} />
          )}
          {win.content.type === "cards-game" && win.content.game === "blackjack" && (
            <Blackjack settings={win.content.settings} onNewGame={() => handleCardsGameClose(win.id)} onQuit={() => closeWindow(win.id)} />
          )}
          {win.content.type === "cards-game" && win.content.game === "pyramid" && (
            <Pyramid settings={win.content.settings} onNewGame={() => handleCardsGameClose(win.id)} onQuit={() => closeWindow(win.id)} />
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
          {win.content.type === "internet" && (
            <InternetApp />
          )}
          {win.content.type === "files" && (
            <FilesApp
              onOpenApp={openWindow}
              onOpenNotebook={openNotebook}
              onQuit={() => closeWindow(win.id)}
            />
          )}
          {win.content.type === "notebook" && (
            <NotebookApp
              filePath={win.content.filePath}
              fileName={win.content.fileName}
              initialContent={win.content.initialContent}
              onFileSaved={handleNotebookFileSaved}
            />
          )}
          {win.content.type === "sound-recorder" && (
            <SoundRecorder
              fileName={win.content.fileName}
              onQuit={() => closeWindow(win.id)}
              onFileSaved={handleSoundFileSaved}
            />
          )}
          {win.content.type === "midi-editor" && (
            <MidiEditor onQuit={() => closeWindow(win.id)} />
          )}
          {win.content.type === "desktop-display" && (
            <DisplayApp
              settings={desktopSettings}
              onApply={(newSettings) => {
                setDesktopSettings(newSettings);
                saveDesktopSettings(newSettings);
                closeWindow(win.id);
              }}
              onCancel={() => closeWindow(win.id)}
            />
          )}
        </Window>
      ))}

      {/* ── Taskbar ── */}
      <Taskbar
        windows={openWindows.map((w) => ({ id: w.id, title: w.title, icon: w.icon, minimized: w.minimized }))}
        activeWindowId={activeWindowId}
        onWindowFocus={focusWindow}
        onRestart={handleRestart}
        onOpenSettings={(s) => {
          if (s === "display") openDisplaySettings();
          else if (s === "screensavers") openScreensaverSettings();
        }}
        onOpenAbout={openAbout}
        onExitToTos={handleExitToTos}
        onOpenApp={openWindow}
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
        <BootScreen onComplete={handleBootComplete} splashOnly={fromTos} />
      )}
    </div>
  );
}
