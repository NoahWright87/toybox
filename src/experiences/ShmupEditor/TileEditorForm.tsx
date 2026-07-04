import { useMemo, useState } from "react";
import TilePreview from "./TilePreview";
import { FOOTPRINTS, WILDCARD, edgeSlot, resizeSlots, type EdgeSlot, type Footprint, type TileDef } from "./types";

interface TileEditorFormProps {
  tile: TileDef;
  availableTags: string[];
  onRegisterTag: (tag: string) => void;
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

export default function TileEditorForm({ tile, availableTags, onRegisterTag, onSave, onCancel }: TileEditorFormProps) {
  const [draft, setDraft] = useState<TileDef>(tile);
  const error = useMemo(() => validate(draft), [draft]);

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
        editable
        availableTags={availableTags}
        onEdgeChange={handleEdgeChange}
        onRegisterTag={onRegisterTag}
      />

      <div className="shmup-tile-form__footer">
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
        <label className="shmup-field shmup-field--inline">
          <span>Color</span>
          <input
            type="color"
            className="shmup-input-color"
            value={draft.color}
            onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
          />
        </label>
      </div>

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
