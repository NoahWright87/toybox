import { useEffect, useState } from "react";
import { missingFeatureMessage } from "../../utils/missingFeatureMessage";
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

function RetroClock() {
  const [timeStr, setTimeStr] = useState("");

  function buildDisplay() {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function buildTooltip() {
    const now = new Date();
    const retroYear = now.getFullYear() - 30;
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return dateStr.replace(now.getFullYear().toString(), retroYear.toString());
  }

  useEffect(() => {
    setTimeStr(buildDisplay());
    const id = setInterval(() => setTimeStr(buildDisplay()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ns-taskbar__clock" title={buildTooltip()}>
      {timeStr}
    </div>
  );
}

export default function Taskbar({ windows, activeWindowId, onWindowFocus }: TaskbarProps) {
  function handleStartClick() {
    alert(missingFeatureMessage());
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
        <RetroClock />
      </div>
    </div>
  );
}
