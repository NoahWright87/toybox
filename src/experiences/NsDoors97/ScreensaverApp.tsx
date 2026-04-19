import { useState } from "react";
import {
  type FullScreensaverConfig,
  type ScreensaverId,
  type AllScreensaverSettings,
} from "./screensaverSettings";
import "./ScreensaverApp.css";

interface ScreensaverOption {
  id: ScreensaverId | "none";
  label: string;
  icon: string;
}

const SCREENSAVERS: ScreensaverOption[] = [
  { id: "none",              label: "(None)",            icon: "🖥️" },
  { id: "starfield",         label: "Starfield",         icon: "⭐" },
  { id: "fireworks",         label: "Fireworks",         icon: "🎆" },
  { id: "bouncing-shapes",   label: "Bouncing Shapes",   icon: "🔷" },
  { id: "scrolling-text",    label: "Scrolling Text",    icon: "📜" },
  { id: "bouncing-polygons", label: "Bouncing Polygons", icon: "🔺" },
  { id: "raining-emojis",    label: "Raining Emojis",    icon: "🌧️" },
];

interface ScreensaverAppProps {
  config: FullScreensaverConfig;
  onSave: (config: FullScreensaverConfig) => void;
  onPreview: (screensaver: ScreensaverId, settings: AllScreensaverSettings) => void;
  onCancel: () => void;
}

const INACTIVE_TABS = ["Background", "Appearance", "Settings"];

// ── Shared input primitives ───────────────────────────────────────────────────

function SliderInput({
  label, value, min, max, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="ns-saver-app__row">
      <label className="ns-saver-app__label ns-saver-app__label--slider">{label}</label>
      <input
        className="ns-saver-app__slider"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="ns-saver-app__slider-val">{value}</span>
    </div>
  );
}

function CheckInput({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="ns-saver-app__row">
      <label className="ns-saver-app__label">{label}</label>
      <input
        className="ns-saver-app__checkbox"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

// ── Per-screensaver settings panels ──────────────────────────────────────────

function StarfieldPanel({
  s, patch,
}: {
  s: AllScreensaverSettings["starfield"];
  patch: (p: Partial<AllScreensaverSettings["starfield"]>) => void;
}) {
  return (
    <>
      <SliderInput label="Speed" value={s.speed} min={1} max={30} onChange={(v) => patch({ speed: v })} />
      <SliderInput label="Stars" value={s.starCount} min={100} max={1000} onChange={(v) => patch({ starCount: v })} />
    </>
  );
}

function FireworksPanel({
  s, patch,
}: {
  s: AllScreensaverSettings["fireworks"];
  patch: (p: Partial<AllScreensaverSettings["fireworks"]>) => void;
}) {
  return (
    <>
      <SliderInput label="Particles" value={s.particlesPerBurst} min={20} max={120} onChange={(v) => patch({ particlesPerBurst: v })} />
      <SliderInput label="Bursts/min" value={s.burstRate} min={5} max={120} onChange={(v) => patch({ burstRate: v })} />
    </>
  );
}

function BouncingShapesPanel({
  s, patch,
}: {
  s: AllScreensaverSettings["bouncing-shapes"];
  patch: (p: Partial<AllScreensaverSettings["bouncing-shapes"]>) => void;
}) {
  return (
    <>
      <SliderInput label="Shapes" value={s.shapeCount} min={3} max={30} onChange={(v) => patch({ shapeCount: v })} />
      <SliderInput label="Speed" value={s.speed} min={1} max={10} onChange={(v) => patch({ speed: v })} />
    </>
  );
}

function ScrollingTextPanel({
  s, patch,
}: {
  s: AllScreensaverSettings["scrolling-text"];
  patch: (p: Partial<AllScreensaverSettings["scrolling-text"]>) => void;
}) {
  return (
    <>
      <div className="ns-saver-app__row">
        <label className="ns-saver-app__label">Text</label>
        <select
          className="ns-saver-app__select ns-saver-app__select--sm"
          value={s.textMode}
          onChange={(e) => patch({ textMode: e.target.value as "datetime" | "catchphrase" | "custom" })}
        >
          <option value="catchphrase">Catchphrase</option>
          <option value="datetime">Date / Time</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      {s.textMode === "custom" && (
        <div className="ns-saver-app__row">
          <label className="ns-saver-app__label">Message</label>
          <input
            className="ns-saver-app__text-input"
            type="text"
            maxLength={80}
            value={s.customText}
            placeholder="Your text here"
            onChange={(e) => patch({ customText: e.target.value })}
          />
        </div>
      )}
      <SliderInput label="Speed" value={s.speed} min={1} max={10} onChange={(v) => patch({ speed: v })} />
      <div className="ns-saver-app__row">
        <label className="ns-saver-app__label">Color</label>
        <input
          className="ns-saver-app__color"
          type="color"
          value={s.color}
          onChange={(e) => patch({ color: e.target.value })}
        />
      </div>
      <SliderInput label="Font size" value={s.fontSize} min={16} max={80} onChange={(v) => patch({ fontSize: v })} />
    </>
  );
}

function BouncingPolygonsPanel({
  s, patch,
}: {
  s: AllScreensaverSettings["bouncing-polygons"];
  patch: (p: Partial<AllScreensaverSettings["bouncing-polygons"]>) => void;
}) {
  return (
    <>
      <SliderInput label="Polygons" value={s.count} min={1} max={20} onChange={(v) => patch({ count: v })} />
      <SliderInput label="Vertices" value={s.vertices} min={3} max={8} onChange={(v) => patch({ vertices: v })} />
      <SliderInput label="Speed" value={s.speed} min={1} max={10} onChange={(v) => patch({ speed: v })} />
      <SliderInput label="Trail" value={s.trailLength} min={0} max={60} onChange={(v) => patch({ trailLength: v })} />
      <CheckInput label="Rounded" checked={s.rounded} onChange={(v) => patch({ rounded: v })} />
    </>
  );
}

function RainingEmojisPanel({
  s, patch,
}: {
  s: AllScreensaverSettings["raining-emojis"];
  patch: (p: Partial<AllScreensaverSettings["raining-emojis"]>) => void;
}) {
  return (
    <>
      <SliderInput label="Density" value={s.density} min={10} max={150} onChange={(v) => patch({ density: v })} />
      <SliderInput label="Speed" value={s.speedMultiplier} min={1} max={10} onChange={(v) => patch({ speedMultiplier: v })} />
      <SliderInput label="Min size" value={s.minSize} min={10} max={100} onChange={(v) => patch({ minSize: v })} />
      <SliderInput label="Max size" value={s.maxSize} min={10} max={100} onChange={(v) => patch({ maxSize: v })} />
      <div className="ns-saver-app__row">
        <label className="ns-saver-app__label">Emojis</label>
        <input
          className="ns-saver-app__text-input"
          type="text"
          value={s.customEmojis}
          placeholder="🍕,🚀,⭐ (comma-separated)"
          onChange={(e) => patch({ customEmojis: e.target.value })}
        />
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScreensaverApp({
  config,
  onSave,
  onPreview,
  onCancel,
}: ScreensaverAppProps) {
  const [local, setLocal] = useState<FullScreensaverConfig>(() => ({ ...config, settings: { ...config.settings } }));

  const localSaver = local.screensaver ?? "none";
  const selected = SCREENSAVERS.find((s) => s.id === localSaver)!;

  function patchSettings<K extends ScreensaverId>(id: K, patch: Partial<AllScreensaverSettings[K]>) {
    setLocal((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [id]: { ...prev.settings[id as keyof AllScreensaverSettings], ...patch },
      },
    }));
  }

  function handlePreview() {
    if (localSaver === "none") return;
    onPreview(localSaver, local.settings);
  }

  function handleOk() {
    onSave({
      ...local,
      screensaver: localSaver === "none" ? null : localSaver,
    });
  }

  const hasScreensaver = localSaver !== "none";

  return (
    <div className="ns-saver-app">
      {/* ── Tab bar ── */}
      <div className="ns-saver-app__tabs">
        {INACTIVE_TABS.map((tab) => (
          <button key={tab} className="ns-saver-app__tab" disabled>
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
              {hasScreensaver ? (
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
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                screensaver: e.target.value === "none" ? null : (e.target.value as ScreensaverId),
              }))
            }
          >
            {SCREENSAVERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="ns-saver-app__row ns-saver-app__row--wait">
            <label className="ns-saver-app__label" htmlFor="ns-wait">
              Wait:
            </label>
            <input
              id="ns-wait"
              className="ns-saver-app__number"
              type="number"
              min={0}
              max={120}
              value={local.waitMinutes}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  waitMinutes: Math.max(0, Math.min(120, Number(e.target.value))),
                }))
              }
            />
            <span className="ns-saver-app__unit">
              {local.waitMinutes === 0 ? "min (disabled)" : "min"}
            </span>
          </div>

          <div className="ns-saver-app__btn-row">
            <button
              className="ns-saver-app__btn"
              onClick={handlePreview}
              disabled={!hasScreensaver}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* ── Per-screensaver settings ── */}
      {hasScreensaver && (
        <div className="ns-saver-app__settings-panel">
          <div className="ns-saver-app__settings-title">⚙ Settings</div>

          {localSaver === "starfield" && (
            <StarfieldPanel s={local.settings.starfield} patch={(p) => patchSettings("starfield", p)} />
          )}
          {localSaver === "fireworks" && (
            <FireworksPanel s={local.settings.fireworks} patch={(p) => patchSettings("fireworks", p)} />
          )}
          {localSaver === "bouncing-shapes" && (
            <BouncingShapesPanel s={local.settings["bouncing-shapes"]} patch={(p) => patchSettings("bouncing-shapes", p)} />
          )}
          {localSaver === "scrolling-text" && (
            <ScrollingTextPanel s={local.settings["scrolling-text"]} patch={(p) => patchSettings("scrolling-text", p)} />
          )}
          {localSaver === "bouncing-polygons" && (
            <BouncingPolygonsPanel s={local.settings["bouncing-polygons"]} patch={(p) => patchSettings("bouncing-polygons", p)} />
          )}
          {localSaver === "raining-emojis" && (
            <RainingEmojisPanel s={local.settings["raining-emojis"]} patch={(p) => patchSettings("raining-emojis", p)} />
          )}
        </div>
      )}

      {/* ── OK / Cancel ── */}
      <div className="ns-saver-app__footer">
        <button className="ns-saver-app__btn ns-saver-app__btn--primary" onClick={handleOk}>
          OK
        </button>
        <button className="ns-saver-app__btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
