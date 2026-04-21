import { useState } from "react";
import {
  type DesktopSettings,
  type DesktopBgType,
  NOAHSOFT_GRADIENT,
} from "./desktopSettings";
import "./DisplayApp.css";

interface ColorPreset {
  label: string;
  color: string;
}

const COLOR_PRESETS: ColorPreset[] = [
  { label: "Teal",         color: "#008080" },
  { label: "Navy",         color: "#000080" },
  { label: "Maroon",       color: "#800000" },
  { label: "Purple",       color: "#800080" },
  { label: "Forest",       color: "#228833" },
  { label: "Olive",        color: "#808000" },
  { label: "Win98 Blue",   color: "#3a6ea5" },
  { label: "Slate",        color: "#2f4f4f" },
  { label: "Black",        color: "#000000" },
  { label: "Dark Gray",    color: "#404040" },
  { label: "Brick",        color: "#993333" },
  { label: "Noahsoft",     color: "#2a1000" },
];

interface DisplayAppProps {
  settings: DesktopSettings;
  onApply: (settings: DesktopSettings) => void;
  onCancel: () => void;
}

const INACTIVE_TABS = ["Appearance", "Settings"];

export default function DisplayApp({ settings, onApply, onCancel }: DisplayAppProps) {
  const [local, setLocal] = useState<DesktopSettings>({ ...settings });

  const previewBg =
    local.bgType === "noahsoft" ? NOAHSOFT_GRADIENT : local.solidColor;

  function setType(bgType: DesktopBgType) {
    setLocal((prev) => ({ ...prev, bgType }));
  }

  function setColor(solidColor: string) {
    setLocal({ bgType: "solid", solidColor });
  }

  return (
    <div className="ns-display-app">
      {/* Tab bar */}
      <div className="ns-display-app__tabs">
        <button className="ns-display-app__tab ns-display-app__tab--active">
          Background
        </button>
        {INACTIVE_TABS.map((t) => (
          <button key={t} className="ns-display-app__tab" disabled>
            {t}
          </button>
        ))}
      </div>

      <div className="ns-display-app__body">
        {/* CRT monitor preview */}
        <div className="ns-display-app__monitor-wrap">
          <div className="ns-display-app__monitor">
            <div
              className="ns-display-app__screen"
              style={{ background: previewBg }}
            >
              <div className="ns-display-app__screen-icons">
                <div className="ns-display-app__screen-icon">🖥️</div>
                <div className="ns-display-app__screen-icon">📁</div>
              </div>
              <div className="ns-display-app__screen-taskbar" />
            </div>
            <div className="ns-display-app__monitor-neck" />
            <div className="ns-display-app__monitor-base" />
          </div>
        </div>

        {/* Controls */}
        <div className="ns-display-app__controls">
          <label className="ns-display-app__label">Background</label>
          <select
            className="ns-display-app__select"
            value={local.bgType}
            onChange={(e) => setType(e.target.value as DesktopBgType)}
          >
            <option value="noahsoft">Noahsoft Theme</option>
            <option value="solid">Solid Color</option>
          </select>

          {local.bgType === "solid" && (
            <>
              <label className="ns-display-app__label ns-display-app__label--gap">
                Color
              </label>
              <div className="ns-display-app__presets">
                {COLOR_PRESETS.map(({ label, color }) => (
                  <button
                    key={color}
                    className={`ns-display-app__swatch${local.solidColor === color ? " ns-display-app__swatch--active" : ""}`}
                    style={{ background: color }}
                    title={label}
                    onClick={() => setColor(color)}
                    aria-label={label}
                  />
                ))}
              </div>
              <div className="ns-display-app__color-row">
                <label className="ns-display-app__label">Custom:</label>
                <input
                  className="ns-display-app__color-picker"
                  type="color"
                  value={local.solidColor}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span className="ns-display-app__color-hex">{local.solidColor}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="ns-display-app__footer">
        <button className="ns-display-app__btn ns-display-app__btn--primary" onClick={() => onApply(local)}>
          OK
        </button>
        <button className="ns-display-app__btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
