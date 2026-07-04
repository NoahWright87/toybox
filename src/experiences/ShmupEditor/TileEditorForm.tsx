import { useMemo, useRef, useState, type ChangeEvent } from "react";
import BiomeSelect from "./BiomeSelect";
import TilePreview from "./TilePreview";
import { loadTileImageFile } from "./imageUpload";
import { CUSTOM_IMAGE_ID, NONE_IMAGE_ID, TILE_IMAGES } from "./tileImages";
import { FOOTPRINTS, WILDCARD, edgeSlot, resizeSlots, type EdgeSlot, type Footprint, type TileDef } from "./types";

interface TileEditorFormProps {
  tile: TileDef;
  availableTags: string[];
  availableBiomes: string[];
  onRegisterTag: (tag: string) => void;
  onRegisterBiome: (biome: string) => void;
  onSave: (tile: TileDef) => void;
  onCancel: () => void;
}

function validate(tile: TileDef): string | null {
  if (!tile.name.trim()) return "Name is required.";
  const slots = [...tile.north, ...tile.south, tile.east, tile.west];
  for (const slot of slots) {
    if (slot.hardwall || slot.tag === WILDCARD) continue;
    if (!slot.tag.trim()) return "Every edge needs a tag or Hard Wall (use the dropdown on the tile diagram).";
  }
  if (tile.weight < 0) return "Weight can't be negative.";
  return null;
}

export default function TileEditorForm({
  tile,
  availableTags,
  availableBiomes,
  onRegisterTag,
  onRegisterBiome,
  onSave,
  onCancel,
}: TileEditorFormProps) {
  const [draft, setDraft] = useState<TileDef>(tile);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const error = useMemo(() => validate(draft), [draft]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const dataUrl = await loadTileImageFile(file);
      setDraft((prev) => ({ ...prev, customImage: dataUrl, imageId: CUSTOM_IMAGE_ID }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not load that image.");
    } finally {
      setUploading(false);
    }
  }

  function removeCustomImage() {
    setDraft((prev) => ({
      ...prev,
      customImage: null,
      imageId: prev.imageId === CUSTOM_IMAGE_ID ? NONE_IMAGE_ID : prev.imageId,
    }));
  }

  function setFootprint(footprint: Footprint) {
    setDraft((prev) => ({
      ...prev,
      footprint,
      north: resizeSlots(prev.north, footprint),
      south: prev.isConnector
        ? Array.from({ length: footprint }, () => edgeSlot(WILDCARD))
        : resizeSlots(prev.south, footprint),
    }));
  }

  function toggleConnector() {
    setDraft((prev) => {
      const isConnector = !prev.isConnector;
      return {
        ...prev,
        isConnector,
        south: isConnector
          ? Array.from({ length: prev.footprint }, () => edgeSlot(WILDCARD))
          : Array.from({ length: prev.footprint }, () => edgeSlot()),
      };
    });
  }

  function handleEdgeChange(side: "north" | "south" | "east" | "west", index: number, slot: EdgeSlot) {
    setDraft((prev) => {
      if (side === "east" || side === "west") return { ...prev, [side]: slot };
      const list = prev[side].map((s, i) => (i === index ? slot : s));
      return { ...prev, [side]: list };
    });
  }

  function handleSave() {
    if (validate(draft)) return;
    onSave({ ...draft, name: draft.name.trim(), modifiedAt: Date.now() });
  }

  return (
    <div className="shmup-tile-form">
      <div className="shmup-tile-form__toolbar">
        <label className="shmup-field shmup-field--inline">
          <span>Name</span>
          <input
            type="text"
            className="shmup-input"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>

        <div className="shmup-btn-row">
          {FOOTPRINTS.map((fp) => (
            <button
              key={fp}
              type="button"
              className={`shmup-btn shmup-btn--small ${draft.footprint === fp ? "shmup-btn--active" : ""}`}
              onClick={() => setFootprint(fp)}
            >
              {fp}x1
            </button>
          ))}
        </div>

        <label className="shmup-checkbox">
          <input type="checkbox" checked={draft.isConnector} onChange={toggleConnector} />
          Connector
        </label>
      </div>

      <p className="shmup-hint">Click any edge on the diagram to set its tag or mark it Hard Wall.</p>

      <TilePreview
        tile={draft}
        size="edit"
        editable
        availableTags={availableTags}
        onEdgeChange={handleEdgeChange}
        onRegisterTag={onRegisterTag}
      />

      <div className="shmup-field">
        <span>Background</span>
        <div className="shmup-image-picker">
          {TILE_IMAGES.map((img) => (
            <button
              key={img.id}
              type="button"
              className={`shmup-image-picker__option ${draft.imageId === img.id ? "shmup-image-picker__option--active" : ""}`}
              style={img.url ? { backgroundImage: `url(${img.url})` } : undefined}
              onClick={() => setDraft((prev) => ({ ...prev, imageId: img.id }))}
              title={img.label}
            >
              {!img.url && <span>{img.label}</span>}
            </button>
          ))}
          {draft.customImage && (
            <button
              type="button"
              className={`shmup-image-picker__option ${draft.imageId === CUSTOM_IMAGE_ID ? "shmup-image-picker__option--active" : ""}`}
              style={{ backgroundImage: `url(${draft.customImage})` }}
              onClick={() => setDraft((prev) => ({ ...prev, imageId: CUSTOM_IMAGE_ID }))}
              title="Custom upload"
            />
          )}
        </div>
        <div className="shmup-btn-row">
          <button type="button" className="shmup-btn shmup-btn--small" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Loading..." : "Upload Custom Art..."}
          </button>
          {draft.customImage && (
            <button type="button" className="shmup-btn shmup-btn--small" onClick={removeCustomImage}>
              Remove Custom Art
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
        {uploadError && <p className="shmup-error">{uploadError}</p>}
      </div>

      <label className="shmup-field shmup-field--inline">
        <span>Biome</span>
        <BiomeSelect value={draft.biome} availableBiomes={availableBiomes} onChange={(biome) => setDraft((prev) => ({ ...prev, biome }))} onRegisterBiome={onRegisterBiome} />
      </label>

      <label className="shmup-field shmup-field--inline">
        <span>Weight</span>
        <input
          type="number"
          min={0}
          step={0.1}
          className="shmup-input shmup-input--small"
          value={draft.weight}
          onChange={(e) => setDraft((prev) => ({ ...prev, weight: Number(e.target.value) }))}
        />
      </label>

      {error && <p className="shmup-error">{error}</p>}

      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn shmup-btn--primary" disabled={!!error} onClick={handleSave}>
          Save Tile
        </button>
        <button type="button" className="shmup-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
