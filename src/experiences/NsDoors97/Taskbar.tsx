import { useEffect, useState, useCallback, useRef } from "react";
import { missingFeatureMessage } from "../../utils/missingFeatureMessage";
import { useOsDialog } from "./OsDialog";
import "./Taskbar.css";

interface TaskbarWindowEntry {
  id: string;
  title: string;
  icon?: string;
}

interface TaskbarProps {
  windows: TaskbarWindowEntry[];
  activeWindowId: string | null;
  onWindowFocus: (id: string) => void;
  onRestart: () => void;
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

// ── Start menu ────────────────────────────────────────────────────────────────

const START_MENU_ITEMS = [
  { id: "programs", icon: "📂", label: "Programs",  arrow: true  },
  { id: "settings", icon: "⚙️",  label: "Settings",  arrow: true  },
  { id: "help",     icon: "❓",  label: "Help",       arrow: false },
] as const;

// ── Taskbar ───────────────────────────────────────────────────────────────────

export default function Taskbar({ windows, activeWindowId, onWindowFocus, onRestart }: TaskbarProps) {
  const { showDialog } = useOsDialog();
  const [startOpen, setStartOpen] = useState(false);
  const startAreaRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!startOpen) return;
    function handler(e: MouseEvent) {
      if (startAreaRef.current && !startAreaRef.current.contains(e.target as Node)) {
        setStartOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [startOpen]);

  const handlePlaceholder = useCallback(() => {
    setStartOpen(false);
    showDialog(missingFeatureMessage());
  }, [showDialog]);

  const handleRestart = useCallback(() => {
    setStartOpen(false);
    onRestart();
  }, [onRestart]);

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
              {START_MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className="ns-start-menu__item"
                  onClick={handlePlaceholder}
                >
                  <span className="ns-start-menu__item-icon">{item.icon}</span>
                  <span className="ns-start-menu__item-label">{item.label}</span>
                  {item.arrow && <span className="ns-start-menu__item-arrow">▶</span>}
                </button>
              ))}

              <div className="ns-start-menu__divider" />

              <button className="ns-start-menu__item ns-start-menu__item--restart" onClick={handleRestart}>
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
            className={`ns-taskbar__win-btn${activeWindowId === win.id ? " ns-taskbar__win-btn--active" : ""}`}
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
