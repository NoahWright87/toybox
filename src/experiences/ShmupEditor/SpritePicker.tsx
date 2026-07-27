import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { DEFAULT_PALETTE_SIZE, PALETTE_SIZE_OPTIONS, loadSpriteImageFile } from "./imageUpload";
import { BUILTIN_SPRITES, CUSTOM_SPRITE_ID, NONE_SPRITE_ID } from "./enemySprites";

interface SpritePickerProps {
  spriteId: string;
  customSprite: string | null;
  onChange: (spriteId: string, customSprite: string | null) => void;
}

/** Sprite picker for enemies/bullets — same built-in-plus-custom-upload pattern as TileEditorForm's tile image picker, reusing imageUpload.ts's shared upload pipeline (specs/shmup-editor.todo.md, E2 #192). */
export default function SpritePicker({ spriteId, customSprite, onChange }: SpritePickerProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [paletteSize, setPaletteSize] = useState(DEFAULT_PALETTE_SIZE);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(
    () => (customSprite ? [...BUILTIN_SPRITES, { id: CUSTOM_SPRITE_ID, label: "Custom upload", url: customSprite }] : BUILTIN_SPRITES),
    [customSprite]
  );

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const dataUrl = await loadSpriteImageFile(file, paletteSize);
      onChange(CUSTOM_SPRITE_ID, dataUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not load that image.");
    } finally {
      setUploading(false);
    }
  }

  function removeCustom() {
    setUploadError(null);
    onChange(spriteId === CUSTOM_SPRITE_ID ? NONE_SPRITE_ID : spriteId, null);
  }

  return (
    <div className="shmup-field">
      <span>Sprite</span>
      <div className="shmup-image-picker">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`shmup-image-picker__option ${spriteId === opt.id ? "shmup-image-picker__option--active" : ""}`}
            style={opt.url ? { backgroundImage: `url(${opt.url})` } : undefined}
            onClick={() => onChange(opt.id, opt.id === CUSTOM_SPRITE_ID ? customSprite : null)}
            title={opt.label}
          >
            {!opt.url && <span>{opt.label}</span>}
          </button>
        ))}
      </div>
      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn shmup-btn--small" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? "Loading..." : "Upload Sprite..."}
        </button>
        <label className="shmup-checkbox">
          Colors
          <select className="shmup-input" value={paletteSize} disabled={uploading} onChange={(e) => setPaletteSize(Number(e.target.value))}>
            {PALETTE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {customSprite && (
          <button type="button" className="shmup-btn shmup-btn--small" disabled={uploading} onClick={removeCustom}>
            Remove Custom Sprite
          </button>
        )}
      </div>
      {uploadError && <p className="shmup-error">{uploadError}</p>}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
    </div>
  );
}
