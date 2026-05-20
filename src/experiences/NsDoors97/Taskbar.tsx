import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import "./Taskbar.css";

interface TaskbarWindowEntry {
  id: string;
  title: string;
  icon?: string;
  minimized?: boolean;
}

interface TaskbarProps {
  windows: TaskbarWindowEntry[];
  activeWindowId: string | null;
  onWindowFocus: (id: string) => void;
  onRestart: () => void;
  onOpenSettings: (setting: "display" | "screensavers") => void;
  onOpenAbout: () => void;
  onExitToTos: () => void;
  onOpenApp: (id: string) => void;
}

// ── Retro clock: real time, date shifted 30 years back ────────────────────────

function RetroClock() {
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  function buildTime() {
    return new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function buildDate() {
    const now = new Date();
    const retro = new Date(now);
    retro.setFullYear(now.getFullYear() - 30);
    return retro.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  useEffect(() => {
    setTimeStr(buildTime());
    setDateStr(buildDate());
    const id = setInterval(() => {
      setTimeStr(buildTime());
      setDateStr(buildDate());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ns-taskbar__clock" title="NS Doors 97 System Clock">
      <span className="ns-taskbar__clock-time">{timeStr}</span>
      <span className="ns-taskbar__clock-date">{dateStr}</span>
    </div>
  );
}

// ── Fullscreen toggle ─────────────────────────────────────────────────────────

function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  return (
    <button
      className="ns-taskbar__fullscreen"
      onClick={toggle}
      title={isFullscreen ? "Exit fullscreen" : "Go fullscreen"}
      aria-label={isFullscreen ? "Exit fullscreen" : "Go fullscreen"}
    >
      {isFullscreen ? "⊡" : "⛶"}
    </button>
  );
}

// ── Menu item data ────────────────────────────────────────────────────────────

const GAMES_ITEMS = [
  { id: "cards",          icon: "🃏", label: "Cards"            },
  { id: "tic-tac-toe",    icon: "✖️",  label: "Tic-Tac-Toe"     },
  { id: "pool",           icon: "🎱", label: "8-Ball Pool"      },
  { id: "word-whirlwind", icon: "🌪️", label: "Word Whirlwind"  },
  { id: "words",          icon: "🔤", label: "WORDS"            },
  { id: "bomb-finder",    icon: "💣", label: "Bomb Finder"      },
  { id: "duck-hunt",      icon: "🎯", label: "Duck & Learn"     },
  { id: "number-muncher", icon: "🔢", label: "Nom Nom Numerals" },
  { id: "typing-racer",   icon: "⌨️", label: "Type 'Em Up"      },
  { id: "chain-reaction", icon: "🔗", label: "Chain Reaction"   },
  { id: "peg-solitaire",  icon: "🔴", label: "Peg Solitaire"    },
] as const;

const TOOLS_ITEMS = [
  { id: "notebook",       icon: "📝", label: "Notebook"       },
  { id: "ns-art",         icon: "🎨", label: "NS Art"          },
  { id: "sound-recorder", icon: "🎙️", label: "Sound Recorder" },
  { id: "midi-editor",    icon: "🎹", label: "MIDI Editor"    },
] as const;

type OpenSubmenu = "games" | "tools" | "settings" | null;

// ── Taskbar ───────────────────────────────────────────────────────────────────

export default function Taskbar({ windows, activeWindowId, onWindowFocus, onRestart, onOpenSettings, onOpenAbout, onExitToTos, onOpenApp }: TaskbarProps) {
  const [startOpen, setStartOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<OpenSubmenu>(null);
  const startAreaRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (openSubmenu !== null && submenuRef.current) {
      const rect = submenuRef.current.getBoundingClientRect();
      const available = window.innerHeight - rect.top - 48;
      submenuRef.current.style.maxHeight = `${Math.max(120, available)}px`;
    }
  }, [openSubmenu]);

  // Close on outside click
  useEffect(() => {
    if (!startOpen) return;
    function handler(e: MouseEvent) {
      if (startAreaRef.current && !startAreaRef.current.contains(e.target as Node)) {
        setStartOpen(false);
        setOpenSubmenu(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [startOpen]);

  const close = useCallback(() => {
    setStartOpen(false);
    setOpenSubmenu(null);
  }, []);

  const handleOpenAbout = useCallback(() => {
    close();
    onOpenAbout();
  }, [onOpenAbout, close]);

  const handleOpenScreensavers = useCallback(() => {
    close();
    onOpenSettings("screensavers");
  }, [onOpenSettings, close]);

  const handleRestart = useCallback(() => {
    close();
    onRestart();
  }, [onRestart, close]);

  const handleOpenDisplay = useCallback(() => {
    close();
    onOpenSettings("display");
  }, [onOpenSettings, close]);

  const handleExitToTos = useCallback(() => {
    close();
    onExitToTos();
  }, [onExitToTos, close]);

  const handleOpenApp = useCallback((id: string) => {
    close();
    onOpenApp(id);
  }, [onOpenApp, close]);

  return (
    <div className="ns-taskbar">
      {/* ── Start button + menu ── */}
      <div className="ns-taskbar__start-area" ref={startAreaRef}>
        {startOpen && (
          <div className="ns-start-menu">
            <div className="ns-start-menu__sidebar">
              <span className="ns-start-menu__sidebar-text">NS DOORS 97</span>
            </div>
            <div className="ns-start-menu__items">

              {/* Games */}
              <div
                className="ns-start-menu__item-wrapper"
                onMouseEnter={() => setOpenSubmenu("games")}
                onMouseLeave={() => setOpenSubmenu(null)}
              >
                <button className="ns-start-menu__item">
                  <span className="ns-start-menu__item-icon">🎮</span>
                  <span className="ns-start-menu__item-label">Games</span>
                  <span className="ns-start-menu__item-arrow">▶</span>
                </button>
                {openSubmenu === "games" && (
                  <div className="ns-start-submenu" ref={submenuRef}>
                    {GAMES_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        className="ns-start-menu__item"
                        onClick={() => handleOpenApp(item.id)}
                      >
                        <span className="ns-start-menu__item-icon">{item.icon}</span>
                        <span className="ns-start-menu__item-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tools */}
              <div
                className="ns-start-menu__item-wrapper"
                onMouseEnter={() => setOpenSubmenu("tools")}
                onMouseLeave={() => setOpenSubmenu(null)}
              >
                <button className="ns-start-menu__item">
                  <span className="ns-start-menu__item-icon">🔧</span>
                  <span className="ns-start-menu__item-label">Tools</span>
                  <span className="ns-start-menu__item-arrow">▶</span>
                </button>
                {openSubmenu === "tools" && (
                  <div className="ns-start-submenu" ref={submenuRef}>
                    {TOOLS_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        className="ns-start-menu__item"
                        onClick={() => handleOpenApp(item.id)}
                      >
                        <span className="ns-start-menu__item-icon">{item.icon}</span>
                        <span className="ns-start-menu__item-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Internet */}
              <button
                className="ns-start-menu__item"
                onClick={() => handleOpenApp("internet")}
                onMouseEnter={() => setOpenSubmenu(null)}
              >
                <span className="ns-start-menu__item-icon">🌐</span>
                <span className="ns-start-menu__item-label">Internet</span>
              </button>

              {/* Settings */}
              <div
                className="ns-start-menu__item-wrapper"
                onMouseEnter={() => setOpenSubmenu("settings")}
                onMouseLeave={() => setOpenSubmenu(null)}
              >
                <button className="ns-start-menu__item">
                  <span className="ns-start-menu__item-icon">⚙️</span>
                  <span className="ns-start-menu__item-label">Settings</span>
                  <span className="ns-start-menu__item-arrow">▶</span>
                </button>
                {openSubmenu === "settings" && (
                  <div className="ns-start-submenu" ref={submenuRef}>
                    <button
                      className="ns-start-menu__item"
                      onClick={handleOpenDisplay}
                    >
                      <span className="ns-start-menu__item-icon">🖥️</span>
                      <span className="ns-start-menu__item-label">Display...</span>
                    </button>
                    <button
                      className="ns-start-menu__item"
                      onClick={handleOpenScreensavers}
                    >
                      <span className="ns-start-menu__item-icon">💤</span>
                      <span className="ns-start-menu__item-label">Screensavers...</span>
                    </button>
                  </div>
                )}
              </div>

              {/* About */}
              <button
                className="ns-start-menu__item"
                onClick={handleOpenAbout}
                onMouseEnter={() => setOpenSubmenu(null)}
              >
                <span className="ns-start-menu__item-icon">ℹ️</span>
                <span className="ns-start-menu__item-label">About NS Doors 97</span>
              </button>

              <div className="ns-start-menu__divider" />

              <button
                className="ns-start-menu__item"
                onClick={handleExitToTos}
                onMouseEnter={() => setOpenSubmenu(null)}
              >
                <span className="ns-start-menu__item-icon ns-start-menu__item-icon--text">&gt;_</span>
                <span className="ns-start-menu__item-label">Exit to NS-TOS...</span>
              </button>

              <button
                className="ns-start-menu__item ns-start-menu__item--restart"
                onClick={handleRestart}
                onMouseEnter={() => setOpenSubmenu(null)}
              >
                <span className="ns-start-menu__item-icon">🔄</span>
                <span className="ns-start-menu__item-label">Restart...</span>
              </button>

            </div>
          </div>
        )}

        <button
          className={`ns-taskbar__start${startOpen ? " ns-taskbar__start--active" : ""}`}
          onClick={() => setStartOpen((v) => !v)}
        >
          <span className="ns-taskbar__start-logo">🚪</span>
          <span className="ns-taskbar__start-label">Open</span>
        </button>
      </div>

      <div className="ns-taskbar__separator" />

      <div className="ns-taskbar__windows">
        {windows.map((win) => (
          <button
            key={win.id}
            className={[
              "ns-taskbar__win-btn",
              activeWindowId === win.id ? "ns-taskbar__win-btn--active" : "",
              win.minimized ? "ns-taskbar__win-btn--minimized" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => onWindowFocus(win.id)}
            title={win.title}
          >
            {win.icon && <span className="ns-taskbar__win-icon">{win.icon}</span>}
            <span className="ns-taskbar__win-label">{win.title}</span>
          </button>
        ))}
      </div>

      <div className="ns-taskbar__tray">
        <FullscreenButton />
        <div className="ns-taskbar__tray-divider" />
        <RetroClock />
      </div>
    </div>
  );
}
