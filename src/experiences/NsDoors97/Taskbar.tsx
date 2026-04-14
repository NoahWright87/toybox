import { useEffect, useState, useCallback } from "react";
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

// ── Taskbar ───────────────────────────────────────────────────────────────────

export default function Taskbar({ windows, activeWindowId, onWindowFocus }: TaskbarProps) {
  const { showDialog } = useOsDialog();

  function handleStartClick() {
    showDialog(missingFeatureMessage());
  }

  return (
    <div className="ns-taskbar">
      <button className="ns-taskbar__start" onClick={handleStartClick}>
        <span className="ns-taskbar__start-logo">🚪</span>
        <span className="ns-taskbar__start-label">Open</span>
      </button>

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
