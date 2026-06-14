import { useRef, useState } from "react";
import {
  PUZZLE_PRESETS,
  PUZZLE_PRESET_THUMB_URLS,
  PUZZLE_PRESET_LABELS,
} from "./puzzleImages";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  bestTimeKey,
  formatTime,
  type Difficulty,
  type ImageSource,
  type JigsawConfig,
} from "./types";
import { resizeImageToDataUrl } from "../../utils/imageResize";
import "./JigsawPuzzle.css";

interface JigsawSettingsProps {
  initial: JigsawConfig;
  customThumbUrl: string | null;
  bestTimes: Record<string, number>;
  onStart: (config: JigsawConfig, customDataUrl: string | null) => void;
}

export default function JigsawSettings({ initial, customThumbUrl, bestTimes, onStart }: JigsawSettingsProps) {
  const [imageSource, setImageSource] = useState<ImageSource>(initial.imageSource);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);
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

  const best = bestTimes[bestTimeKey(imageSource, difficulty)];

  return (
    <div className="jigsaw-settings">
      <div className="jigsaw-settings__title">New Puzzle</div>

      <label className="jigsaw-settings__label">Image:</label>
      <div className="jigsaw-settings__images">
        {PUZZLE_PRESETS.map((preset) => (
          <button
            key={preset}
            className={`jigsaw-settings__thumb${
              imageSource.kind === "preset" && imageSource.presetId === preset
                ? " jigsaw-settings__thumb--active"
                : ""
            }`}
            onClick={() => setImageSource({ kind: "preset", presetId: preset })}
          >
            <img
              src={PUZZLE_PRESET_THUMB_URLS[preset]}
              alt={PUZZLE_PRESET_LABELS[preset]}
              className="jigsaw-settings__thumb-img"
            />
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>
      {error && <div className="jigsaw-settings__error">{error}</div>}

      <label className="jigsaw-settings__label jigsaw-settings__label--gap">Difficulty:</label>
      <div className="jigsaw-settings__difficulties">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            className={`jigsaw-settings__diff-btn${difficulty === d ? " jigsaw-settings__diff-btn--active" : ""}`}
            onClick={() => setDifficulty(d)}
          >
            {DIFFICULTY_LABELS[d]}
          </button>
        ))}
      </div>

      <div className="jigsaw-settings__row">
        <label className="jigsaw-settings__checkbox-wrap">
          <input
            type="checkbox"
            className="jigsaw-settings__checkbox"
            checked={timed}
            onChange={(e) => setTimed(e.target.checked)}
          />
          <span>Timed</span>
        </label>
        {timed && best !== undefined && (
          <span className="jigsaw-settings__best">Best: {formatTime(best)}</span>
        )}
      </div>

      <button
        className="jigsaw-settings__start-btn"
        onClick={() => onStart({ imageSource, difficulty, timed }, customDataUrl)}
        disabled={uploading}
      >
        ▶ Start
      </button>
    </div>
  );
}
