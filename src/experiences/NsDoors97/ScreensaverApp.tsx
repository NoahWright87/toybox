import { useState } from "react";
import { missingFeatureMessage } from "../../utils/missingFeatureMessage";
import { useOsDialog } from "./OsDialog";
import { type ScreensaverId } from "./ScreensaverOverlay";
import "./ScreensaverApp.css";

interface ScreensaverOption {
  id: ScreensaverId | "none";
  label: string;
  icon: string;
}

const SCREENSAVERS: ScreensaverOption[] = [
  { id: "none",            label: "(None)",         icon: "🖥️" },
  { id: "starfield",       label: "Starfield",      icon: "⭐" },
  { id: "fireworks",       label: "Fireworks",      icon: "🎆" },
  { id: "bouncing-shapes", label: "Bouncing Shapes", icon: "🔷" },
];

interface ScreensaverAppProps {
  currentScreensaver: ScreensaverId | null;
  waitMinutes: number;
  onSave: (screensaver: ScreensaverId | null, waitMinutes: number) => void;
  onPreview: (screensaver: ScreensaverId) => void;
}

const INACTIVE_TABS = ["Background", "Appearance", "Settings"];

export default function ScreensaverApp({
  currentScreensaver,
  waitMinutes,
  onSave,
  onPreview,
}: ScreensaverAppProps) {
  const { showDialog } = useOsDialog();
  const [localSaver, setLocalSaver] = useState<ScreensaverId | "none">(
    currentScreensaver ?? "none"
  );
  const [localWait, setLocalWait] = useState(waitMinutes);

  const selected = SCREENSAVERS.find((s) => s.id === localSaver)!;

  function handlePreview() {
    if (localSaver === "none") {
      showDialog(missingFeatureMessage());
      return;
    }
    onPreview(localSaver);
  }

  function handleOk() {
    onSave(localSaver === "none" ? null : localSaver, localWait);
  }

  return (
    <div className="ns-saver-app">
      {/* ── Tab bar ── */}
      <div className="ns-saver-app__tabs">
        {INACTIVE_TABS.map((tab) => (
          <button
            key={tab}
            className="ns-saver-app__tab"
            onClick={() => showDialog(missingFeatureMessage())}
          >
            {tab}
          </button>
        ))}
        <button className="ns-saver-app__tab ns-saver-app__tab--active">
          Screen Saver
        </button>
      </div>

      <div className="ns-saver-app__body">
        {/* ── Fake CRT monitor preview ── */}
        <div className="ns-saver-app__monitor-wrap">
          <div className="ns-saver-app__monitor">
            <div className="ns-saver-app__screen">
              {localSaver !== "none" ? (
                <span className="ns-saver-app__screen-icon">{selected.icon}</span>
              ) : (
                <span className="ns-saver-app__screen-off">NO SIGNAL</span>
              )}
            </div>
            <div className="ns-saver-app__monitor-neck" />
            <div className="ns-saver-app__monitor-base" />
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="ns-saver-app__controls">
          <label className="ns-saver-app__label">Screen Saver</label>
          <select
            className="ns-saver-app__select"
            value={localSaver}
            onChange={(e) => setLocalSaver(e.target.value as ScreensaverId | "none")}
          >
            {SCREENSAVERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="ns-saver-app__row">
            <label className="ns-saver-app__label" htmlFor="ns-wait">
              Wait:
            </label>
            <input
              id="ns-wait"
              className="ns-saver-app__number"
              type="number"
              min={1}
              max={60}
              value={localWait}
              onChange={(e) => setLocalWait(Math.max(1, Math.min(60, Number(e.target.value))))}
            />
            <span className="ns-saver-app__unit">minutes</span>
          </div>

          <div className="ns-saver-app__btn-row">
            <button className="ns-saver-app__btn" onClick={handlePreview}>
              Preview
            </button>
            <button
              className="ns-saver-app__btn"
              onClick={() => showDialog(missingFeatureMessage())}
            >
              Settings…
            </button>
          </div>
        </div>
      </div>

      {/* ── OK / Cancel ── */}
      <div className="ns-saver-app__footer">
        <button className="ns-saver-app__btn ns-saver-app__btn--primary" onClick={handleOk}>
          OK
        </button>
        <button
          className="ns-saver-app__btn"
          onClick={() => showDialog(missingFeatureMessage())}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
