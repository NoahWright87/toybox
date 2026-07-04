import { useMemo, useState } from "react";
import TilePreview from "./TilePreview";
import type { Orientation } from "./orientation";
import { FOOTPRINTS, WILDCARD, edgeSlot, resizeSlots, type EdgeSlot, type Footprint, type TileDef } from "./types";

interface TileEditorFormProps {
  tile: TileDef;
  onSave: (tile: TileDef) => void;
  onCancel: () => void;
}

function EdgeSlotInput({
  label,
  slot,
  disabled,
  onChange,
}: {
  label: string;
  slot: EdgeSlot;
  disabled?: boolean;
  onChange: (slot: EdgeSlot) => void;
}) {
  return (
    <div className="shmup-edge-input">
      <span className="shmup-edge-input__label">{label}</span>
      <input
        type="text"
        className="shmup-input shmup-input--small"
        value={slot.hardwall ? "" : slot.tag}
        placeholder={slot.hardwall ? "HARD WALL" : "tag"}
        disabled={disabled || slot.hardwall}
        onChange={(e) => onChange({ ...slot, tag: e.target.value })}
      />
      <label className="shmup-checkbox">
        <input
          type="checkbox"
          checked={slot.hardwall}
          disabled={disabled}
          onChange={(e) => onChange({ ...slot, hardwall: e.target.checked, tag: e.target.checked ? "" : slot.tag })}
        />
        Wall
      </label>
    </div>
  );
}

function validate(tile: TileDef): string | null {
  if (!tile.name.trim()) return "Name is required.";
  const slots = [...tile.north, ...tile.south, tile.east, tile.west];
  for (const slot of slots) {
    if (slot.hardwall) continue;
    if (!slot.tag.trim()) return "Every non-wall edge needs a tag (or check Wall).";
  }
  if (tile.weight < 0) return "Weight can't be negative.";
  return null;
}

export default function TileEditorForm({ tile, onSave, onCancel }: TileEditorFormProps) {
  const [draft, setDraft] = useState<TileDef>(tile);
  const [orientation, setOrientation] = useState<Orientation>({ rotation: 0, flip: false });
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
    setOrientation({ rotation: 0, flip: false });
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

  function updateNorth(i: number, slot: EdgeSlot) {
    setDraft((prev) => ({ ...prev, north: prev.north.map((s, idx) => (idx === i ? slot : s)) }));
  }

  function updateSouth(i: number, slot: EdgeSlot) {
    setDraft((prev) => ({ ...prev, south: prev.south.map((s, idx) => (idx === i ? slot : s)) }));
  }

  function handleSave() {
    if (validate(draft)) return;
    onSave({ ...draft, name: draft.name.trim(), modifiedAt: Date.now() });
  }

  return (
    <div className="shmup-tile-form">
      <div className="shmup-tile-form__fields">
        <label className="shmup-field">
          <span>Name</span>
          <input
            type="text"
            className="shmup-input"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>

        <label className="shmup-field">
          <span>Footprint</span>
          <div className="shmup-btn-row">
            {FOOTPRINTS.map((fp) => (
              <button
                key={fp}
                type="button"
                className={`shmup-btn ${draft.footprint === fp ? "shmup-btn--active" : ""}`}
                onClick={() => setFootprint(fp)}
              >
                {fp}x1
              </button>
            ))}
          </div>
        </label>

        <label className="shmup-checkbox shmup-checkbox--row">
          <input type="checkbox" checked={draft.isConnector} onChange={toggleConnector} />
          Start/end connector tile (south trivially matches any edge)
        </label>

        <fieldset className="shmup-fieldset">
          <legend>North (top / new frontier)</legend>
          <div className="shmup-edge-row">
            {draft.north.map((slot, i) => (
              <EdgeSlotInput key={i} label={`col ${i + 1}`} slot={slot} onChange={(s) => updateNorth(i, s)} />
            ))}
          </div>
        </fieldset>

        <fieldset className="shmup-fieldset">
          <legend>South (bottom / matched against incoming edge)</legend>
          <div className="shmup-edge-row">
            {draft.south.map((slot, i) => (
              <EdgeSlotInput
                key={i}
                label={`col ${i + 1}`}
                slot={slot}
                disabled={draft.isConnector}
                onChange={(s) => updateSouth(i, s)}
              />
            ))}
          </div>
          {draft.isConnector && <p className="shmup-hint">Connector tiles match any south edge automatically.</p>}
        </fieldset>

        <fieldset className="shmup-fieldset">
          <legend>East / West</legend>
          <div className="shmup-edge-row">
            <EdgeSlotInput label="east" slot={draft.east} onChange={(s) => setDraft((prev) => ({ ...prev, east: s }))} />
            <EdgeSlotInput label="west" slot={draft.west} onChange={(s) => setDraft((prev) => ({ ...prev, west: s }))} />
          </div>
        </fieldset>

        <div className="shmup-field-row">
          <label className="shmup-field">
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
          <label className="shmup-field">
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

      <div className="shmup-tile-form__preview">
        <TilePreview tile={draft} orientation={orientation} onOrientationChange={setOrientation} />
        <p className="shmup-hint">Rotate/flip above to check every orientation the generator could pick.</p>
      </div>
    </div>
  );
}
