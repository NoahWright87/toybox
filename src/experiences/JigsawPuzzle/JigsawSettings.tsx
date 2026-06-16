import { useRef, useState } from "react";
import {
  PUZZLE_PRESETS,
  PUZZLE_PRESET_THUMB_URLS,
  PUZZLE_PRESET_LABELS,
} from "./puzzleImages";
import {
  bestTimeKey,
  formatTime,
  DEFAULT_CONFIG,
  LEVEL_LABELS,
  type Level,
  type ImageSource,
  type JigsawConfig,
} from "./types";
import { resizeImageToDataUrl } from "../../utils/imageResize";
import "./JigsawPuzzle.css";

interface SettingRowProps {
  label: string;
  value: Level;
  descriptions: [string, string, string];
  onChange: (v: Level) => void;
}

function SettingRow({ label, value, descriptions, onChange }: SettingRowProps) {
  return (
    <div className="jigsaw-settings__row">
      <span className="jigsaw-settings__row-label">{label}</span>
      <div className="jigsaw-settings__slider-wrap">
        <span className="jigsaw-settings__slider-tick">E</span>
        <input
          type="range"
          min={0}
          max={2}
          step={1}
          value={value}
          className="jigsaw-settings__slider"
          onChange={(e) => onChange(Number(e.target.value) as Level)}
        />
        <span className="jigsaw-settings__slider-tick">H</span>
      </div>
      <span className="jigsaw-settings__row-desc">{descriptions[value]}</span>
    </div>
  );
}

interface JigsawSettingsProps {
  initial: JigsawConfig;
  customThumbUrl: string | null;
  bestTimes: Record<string, number>;
  onStart: (config: JigsawConfig, customDataUrl: string | null) => void;
}

const EASY_CONFIG: Omit<JigsawConfig, "imageSource" | "timed"> = {
  pieceCount: 0,
  previewMode: 0,
  cutStyle: 0,
  rotationMode: 0,
  imageFilter: 0,
  snapSensitivity: 0,
};
const MEDIUM_CONFIG: Omit<JigsawConfig, "imageSource" | "timed"> = {
  pieceCount: 1,
  previewMode: 1,
  cutStyle: 1,
  rotationMode: 0,
  imageFilter: 0,
  snapSensitivity: 1,
};
const HARD_CONFIG: Omit<JigsawConfig, "imageSource" | "timed"> = {
  pieceCount: 2,
  previewMode: 2,
  cutStyle: 2,
  rotationMode: 2,
  imageFilter: 2,
  snapSensitivity: 2,
};

function detectPreset(cfg: JigsawConfig): "easy" | "medium" | "hard" | null {
  const check = (pre: typeof EASY_CONFIG) =>
    cfg.pieceCount === pre.pieceCount &&
    cfg.previewMode === pre.previewMode &&
    cfg.cutStyle === pre.cutStyle &&
    cfg.rotationMode === pre.rotationMode &&
    cfg.imageFilter === pre.imageFilter &&
    cfg.snapSensitivity === pre.snapSensitivity;
  if (check(EASY_CONFIG)) return "easy";
  if (check(MEDIUM_CONFIG)) return "medium";
  if (check(HARD_CONFIG)) return "hard";
  return null;
}

export default function JigsawSettings({ initial, customThumbUrl, bestTimes, onStart }: JigsawSettingsProps) {
  const [imageSource, setImageSource] = useState<ImageSource>(initial.imageSource);
  const [cfg, setCfg] = useState<Omit<JigsawConfig, "imageSource" | "timed">>({
    pieceCount: initial.pieceCount ?? DEFAULT_CONFIG.pieceCount,
    previewMode: initial.previewMode ?? DEFAULT_CONFIG.previewMode,
    cutStyle: initial.cutStyle ?? DEFAULT_CONFIG.cutStyle,
    rotationMode: initial.rotationMode ?? DEFAULT_CONFIG.rotationMode,
    imageFilter: initial.imageFilter ?? DEFAULT_CONFIG.imageFilter,
    snapSensitivity: initial.snapSensitivity ?? DEFAULT_CONFIG.snapSensitivity,
  });
  const [timed, setTimed] = useState(initial.timed);
  const [customUrl, setCustomUrl] = useState<string | null>(customThumbUrl);
  const [customDataUrl, setCustomDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setUploading(true);
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    try {
      const resized = await resizeImageToDataUrl(objectUrl);
      setCustomUrl(resized.dataUrl);
      setCustomDataUrl(resized.dataUrl);
      setImageSource({ kind: "custom" });
    } catch {
      setError("Could not process image. Try a JPG or PNG.");
    } finally {
      URL.revokeObjectURL(objectUrl);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function setLevel(key: keyof typeof cfg, v: Level) {
    setCfg((prev) => ({ ...prev, [key]: v }));
  }

  function applyPreset(pre: typeof EASY_CONFIG) {
    setCfg({ ...pre });
  }

  const activePreset = detectPreset({ ...cfg, imageSource, timed });
  const best = bestTimes[bestTimeKey(imageSource, cfg.pieceCount)];

  return (
    <div className="jigsaw-settings">
      <div className="jigsaw-settings__title">New Puzzle</div>

      {/* Image picker */}
      <label className="jigsaw-settings__label">Image:</label>
      <div className="jigsaw-settings__images">
        {PUZZLE_PRESETS.map((preset) => (
          <button
            key={preset}
            className={`jigsaw-settings__thumb${
              imageSource.kind === "preset" && imageSource.presetId === preset
                ? " jigsaw-settings__thumb--active" : ""
            }`}
            onClick={() => setImageSource({ kind: "preset", presetId: preset })}
          >
            <img src={PUZZLE_PRESET_THUMB_URLS[preset]} alt={PUZZLE_PRESET_LABELS[preset]} className="jigsaw-settings__thumb-img" />
            <span className="jigsaw-settings__thumb-label">{PUZZLE_PRESET_LABELS[preset]}</span>
          </button>
        ))}
        {customUrl && (
          <button
            className={`jigsaw-settings__thumb${imageSource.kind === "custom" ? " jigsaw-settings__thumb--active" : ""}`}
            onClick={() => setImageSource({ kind: "custom" })}
          >
            <img src={customUrl} alt="Custom photo" className="jigsaw-settings__thumb-img" />
            <span className="jigsaw-settings__thumb-label">Your Photo</span>
          </button>
        )}
        <button
          className="jigsaw-settings__thumb jigsaw-settings__thumb--upload"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <span className="jigsaw-settings__upload-icon">📷</span>
          <span className="jigsaw-settings__thumb-label">{uploading ? "Loading…" : "Upload…"}</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
      </div>
      {error && <div className="jigsaw-settings__error">{error}</div>}

      {/* Preset buttons */}
      <div className="jigsaw-settings__presets">
        {(["easy", "medium", "hard"] as const).map((p, i) => {
          const pre = [EASY_CONFIG, MEDIUM_CONFIG, HARD_CONFIG][i];
          return (
            <button
              key={p}
              className={`jigsaw-settings__preset-btn${activePreset === p ? " jigsaw-settings__preset-btn--active" : ""}`}
              onClick={() => applyPreset(pre)}
            >
              {LEVEL_LABELS[i]}
            </button>
          );
        })}
      </div>

      {/* Settings rows */}
      <div className="jigsaw-settings__rows">
        <div className="jigsaw-settings__col-headers">
          <span />
          <span className="jigsaw-settings__col-e-h">
            <span>Easy</span><span>Hard</span>
          </span>
          <span />
        </div>
        <SettingRow
          label="Pieces"
          value={cfg.pieceCount}
          descriptions={["~12 pieces", "~48 pieces", "~108 pieces"]}
          onChange={(v) => setLevel("pieceCount", v)}
        />
        <SettingRow
          label="Preview"
          value={cfg.previewMode}
          descriptions={["Ghost overlay", "Corner hint", "No preview"]}
          onChange={(v) => setLevel("previewMode", v)}
        />
        <SettingRow
          label="Cut Style"
          value={cfg.cutStyle}
          descriptions={["5 distinct shapes", "Varied sizes", "Uniform classic"]}
          onChange={(v) => setLevel("cutStyle", v)}
        />
        <SettingRow
          label="Rotation"
          value={cfg.rotationMode}
          descriptions={["Fixed", "90° steps", "~10° free"]}
          onChange={(v) => setLevel("rotationMode", v)}
        />
        <SettingRow
          label="Image"
          value={cfg.imageFilter}
          descriptions={["Full color", "Desaturated", "Grayscale"]}
          onChange={(v) => setLevel("imageFilter", v)}
        />
        <SettingRow
          label="Snap Zone"
          value={cfg.snapSensitivity}
          descriptions={["Forgiving (36px)", "Normal (18px)", "Precise (9px)"]}
          onChange={(v) => setLevel("snapSensitivity", v)}
        />

        {/* Timed row */}
        <div className="jigsaw-settings__row jigsaw-settings__row--timed">
          <span className="jigsaw-settings__row-label">Timer</span>
          <label className="jigsaw-settings__checkbox-wrap">
            <input
              type="checkbox"
              className="jigsaw-settings__checkbox"
              checked={timed}
              onChange={(e) => setTimed(e.target.checked)}
            />
            <span>{timed ? "On" : "Off"}</span>
          </label>
          <span className="jigsaw-settings__row-desc">
            {timed && best !== undefined ? `Best: ${formatTime(best)}` : ""}
          </span>
        </div>
      </div>

      <button
        className="jigsaw-settings__start-btn"
        onClick={() => onStart({ ...cfg, imageSource, timed }, customDataUrl)}
        disabled={uploading}
      >
        ▶ Start
      </button>
    </div>
  );
}
