import { useState, useRef } from "react";
import {
  type DesktopSettings,
  type DesktopBgType,
  type WallpaperPreset,
  type WallpaperFit,
  NOAHSOFT_GRADIENT,
} from "./desktopSettings";
import { degradeForWallpaper } from "./imageDegrade";
import sunsetDegradedUrl from "./wallpapers/sunset-degraded.png";
import archDegradedUrl   from "./wallpapers/arch-degraded.png";
import "./DisplayApp.css";

// ── Wallpaper preset registry ─────────────────────────────────────────────────

export const WALLPAPER_PRESET_URLS: Record<WallpaperPreset, string> = {
  sunset: sunsetDegradedUrl,
  arch:   archDegradedUrl,
};

const WALLPAPER_PRESET_LABELS: Record<WallpaperPreset, string> = {
  sunset: "Sunset",
  arch:   "Desert Arch",
};

const WALLPAPER_PRESETS: WallpaperPreset[] = ["sunset", "arch"];

// ── Colour presets ────────────────────────────────────────────────────────────

interface ColorPreset { label: string; color: string; }

const COLOR_PRESETS: ColorPreset[] = [
  { label: "Teal",       color: "#008080" },
  { label: "Navy",       color: "#000080" },
  { label: "Maroon",     color: "#800000" },
  { label: "Purple",     color: "#800080" },
  { label: "Forest",     color: "#228833" },
  { label: "Olive",      color: "#808000" },
  { label: "Win98 Blue", color: "#3a6ea5" },
  { label: "Slate",      color: "#2f4f4f" },
  { label: "Black",      color: "#000000" },
  { label: "Dark Gray",  color: "#404040" },
  { label: "Brick",      color: "#993333" },
  { label: "Noahsoft",   color: "#2a1000" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveWallpaperUrl(settings: DesktopSettings): string {
  if (settings.wallpaperPreset) return WALLPAPER_PRESET_URLS[settings.wallpaperPreset];
  return settings.wallpaperCustomUrl ?? "";
}

function getPreviewStyle(settings: DesktopSettings): React.CSSProperties {
  if (settings.bgType === "wallpaper") {
    const url = resolveWallpaperUrl(settings);
    return url
      ? {
          backgroundImage:    `url(${url})`,
          backgroundSize:     settings.wallpaperFit,
          backgroundPosition: "center",
          backgroundRepeat:   "no-repeat",
          backgroundColor:    "#000000",
          imageRendering:     "pixelated",
        }
      : { background: "#000" };
  }
  if (settings.bgType === "solid") return { background: settings.solidColor };
  return { background: NOAHSOFT_GRADIENT };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DisplayAppProps {
  settings: DesktopSettings;
  onApply:  (settings: DesktopSettings) => void;
  onCancel: () => void;
}

const INACTIVE_TABS = ["Appearance", "Settings"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DisplayApp({ settings, onApply, onCancel }: DisplayAppProps) {
  const [local, setLocal]       = useState<DesktopSettings>({ ...settings });
  const [degrading, setDegrading] = useState(false);
  const [degradeError, setDegradeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setType(bgType: DesktopBgType) {
    setLocal((prev) => ({ ...prev, bgType }));
    setDegradeError(null);
  }

  function setSolidColor(solidColor: string) {
    setLocal({ ...local, bgType: "solid", solidColor });
  }

  function selectPreset(preset: WallpaperPreset) {
    setLocal((prev) => ({
      ...prev,
      bgType:             "wallpaper",
      wallpaperPreset:    preset,
      wallpaperCustomUrl: null,
    }));
    setDegradeError(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setDegradeError("Please select an image file.");
      return;
    }

    setDegrading(true);
    setDegradeError(null);

    // createObjectURL avoids the 33% base64 memory overhead of readAsDataURL,
    // which prevents random out-of-memory failures on large phone photos.
    const objectUrl = URL.createObjectURL(file);
    try {
      const degradedUrl = await degradeForWallpaper(objectUrl);

      setLocal((prev) => ({
        ...prev,
        bgType:             "wallpaper",
        wallpaperPreset:    null,
        wallpaperCustomUrl: degradedUrl,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setDegradeError(
        msg.includes("dimensions")
          ? "Could not read image dimensions. Try a different file."
          : "Could not process image. Try a JPG or PNG."
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
      setDegrading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const previewStyle = getPreviewStyle(local);
  const customUrl    = local.wallpaperCustomUrl;

  return (
    <div className="ns-display-app">
      {/* Tab bar */}
      <div className="ns-display-app__tabs">
        <button className="ns-display-app__tab ns-display-app__tab--active">
          Background
        </button>
        {INACTIVE_TABS.map((t) => (
          <button key={t} className="ns-display-app__tab" disabled>{t}</button>
        ))}
      </div>

      <div className="ns-display-app__body">
        {/* CRT monitor preview */}
        <div className="ns-display-app__monitor-wrap">
          <div className="ns-display-app__monitor">
            <div className="ns-display-app__screen" style={previewStyle}>
              {local.bgType !== "wallpaper" && (
                <div className="ns-display-app__screen-icons">
                  <div className="ns-display-app__screen-icon">🖥️</div>
                  <div className="ns-display-app__screen-icon">📁</div>
                </div>
              )}
              <div className="ns-display-app__screen-taskbar" />
            </div>
            <div className="ns-display-app__monitor-neck" />
            <div className="ns-display-app__monitor-base" />
          </div>
        </div>

        {/* Controls */}
        <div className="ns-display-app__controls">
          {/* Background type */}
          <label className="ns-display-app__label">Background</label>
          <select
            className="ns-display-app__select"
            value={local.bgType}
            onChange={(e) => setType(e.target.value as DesktopBgType)}
          >
            <option value="noahsoft">Noahsoft Theme</option>
            <option value="solid">Solid Color</option>
            <option value="wallpaper">Wallpaper</option>
          </select>

          {/* ── Solid color controls ── */}
          {local.bgType === "solid" && (
            <>
              <label className="ns-display-app__label ns-display-app__label--gap">Color</label>
              <div className="ns-display-app__presets">
                {COLOR_PRESETS.map(({ label, color }) => (
                  <button
                    key={color}
                    className={`ns-display-app__swatch${local.solidColor === color ? " ns-display-app__swatch--active" : ""}`}
                    style={{ background: color }}
                    title={label}
                    onClick={() => setSolidColor(color)}
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
                  onChange={(e) => setSolidColor(e.target.value)}
                />
                <span className="ns-display-app__color-hex">{local.solidColor}</span>
              </div>
            </>
          )}

          {/* ── Wallpaper controls ── */}
          {local.bgType === "wallpaper" && (
            <>
              <label className="ns-display-app__label ns-display-app__label--gap">Preset</label>
              <div className="ns-display-app__wp-presets">
                {WALLPAPER_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    className={`ns-display-app__wp-thumb${local.wallpaperPreset === preset ? " ns-display-app__wp-thumb--active" : ""}`}
                    onClick={() => selectPreset(preset)}
                    title={WALLPAPER_PRESET_LABELS[preset]}
                  >
                    <img
                      src={WALLPAPER_PRESET_URLS[preset]}
                      alt={WALLPAPER_PRESET_LABELS[preset]}
                      className="ns-display-app__wp-thumb-img"
                    />
                    <span className="ns-display-app__wp-thumb-label">
                      {WALLPAPER_PRESET_LABELS[preset]}
                    </span>
                  </button>
                ))}

                {/* Custom upload slot */}
                {customUrl && (
                  <button
                    className={`ns-display-app__wp-thumb${local.wallpaperPreset === null && customUrl ? " ns-display-app__wp-thumb--active" : ""}`}
                    onClick={() => setLocal((p) => ({ ...p, wallpaperPreset: null }))}
                    title="Custom"
                  >
                    <img
                      src={customUrl}
                      alt="Custom"
                      className="ns-display-app__wp-thumb-img"
                    />
                    <span className="ns-display-app__wp-thumb-label">Custom</span>
                  </button>
                )}
              </div>

              {/* Fill / Fit toggle */}
              <label className="ns-display-app__label ns-display-app__label--gap">Display</label>
              <div className="ns-display-app__fit-row">
                {(["cover", "contain"] as WallpaperFit[]).map((fit) => (
                  <button
                    key={fit}
                    className={`ns-display-app__btn ns-display-app__btn--fit${local.wallpaperFit === fit ? " ns-display-app__btn--fit-active" : ""}`}
                    onClick={() => setLocal((p) => ({ ...p, wallpaperFit: fit }))}
                  >
                    {fit === "cover" ? "Fill" : "Fit"}
                  </button>
                ))}
              </div>

              {/* Upload button */}
              <div className="ns-display-app__upload-row">
                <button
                  className="ns-display-app__btn ns-display-app__btn--upload"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={degrading}
                >
                  {degrading ? "Degrading..." : "Browse..."}
                </button>
                {degrading && (
                  <span className="ns-display-app__upload-hint">
                    Applying 1997 treatment…
                  </span>
                )}
                {degradeError && (
                  <span className="ns-display-app__upload-error">{degradeError}</span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="ns-display-app__footer">
        <button
          className="ns-display-app__btn ns-display-app__btn--primary"
          onClick={() => onApply(local)}
          disabled={degrading}
        >
          OK
        </button>
        <button className="ns-display-app__btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
