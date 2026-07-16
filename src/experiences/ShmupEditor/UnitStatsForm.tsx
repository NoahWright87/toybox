import { useState } from "react";
import SpritePicker from "./SpritePicker";
import type { UnitDef, UnitPart } from "./unitTypes";

interface UnitStatsFormProps {
  unit: UnitDef;
  onSave: (unit: UnitDef) => void;
  onCancel: () => void;
  /** Called on every change so the caller can persist the in-progress draft — root CLAUDE.md's mandatory in-progress-session-survives-reload rule. */
  onDraftChange: (unit: UnitDef) => void;
  onNewPart: () => void;
  onEditPart: (part: UnitPart) => void;
  onDeletePart: (partId: string) => void;
}

function validate(unit: UnitDef): string | null {
  if (!unit.name.trim()) return "Name is required.";
  if (unit.hp <= 0) return "HP must be positive.";
  if (unit.parts.length === 0) return "A Unit needs at least one Part.";
  return null;
}

function partSummary(part: UnitPart): string {
  return part.weapons.length === 1 ? "1 weapon" : `${part.weapons.length} weapons`;
}

/**
 * Stats form + reusable Part buffet — a Unit is sprite + stats (including
 * `speed`/`turnRate`, which drive movement between encounter waypoints —
 * see unitTypes.ts) + a set of Parts, each owning its own reusable Weapon
 * buffet (attacks — see PartEditor.tsx), authored once here and selected/
 * placed repeatedly across encounters (see EncounterEditor.tsx). Same
 * toolbar-then-fields shape as TileEditorForm.tsx; the Parts section
 * mirrors that form's Encounters section (list + New/Edit/Delete, editing
 * navigates to a dedicated view). There's no separate Action buffet
 * anymore — it only ever carried an inert `animationState` (nothing reads
 * it, the editor only renders a static idle sprite) and a `visible` flag,
 * which now lives directly on each encounter step instead, since a plain
 * boolean has no reuse value worth a whole named indirection.
 */
export default function UnitStatsForm({ unit, onSave, onCancel, onDraftChange, onNewPart, onEditPart, onDeletePart }: UnitStatsFormProps) {
  const [draft, setDraft] = useState<UnitDef>(unit);
  const [pendingDeletePartId, setPendingDeletePartId] = useState<string | null>(null);
  const error = validate(draft);

  function update(patch: Partial<UnitDef>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onDraftChange(next);
  }

  function handleSave() {
    if (validate(draft)) return;
    onSave({ ...draft, name: draft.name.trim(), modifiedAt: Date.now() });
  }

  return (
    <div className="shmup-enemy-form">
      <label className="shmup-field shmup-field--inline">
        <span>Name</span>
        <input type="text" className="shmup-input" value={draft.name} onChange={(e) => update({ name: e.target.value })} />
      </label>

      <SpritePicker spriteId={draft.spriteId} customSprite={draft.customSprite} onChange={(spriteId, customSprite) => update({ spriteId, customSprite })} />

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>HP</span>
          <input type="number" min={1} className="shmup-input shmup-input--small" value={draft.hp} onChange={(e) => update({ hp: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Contact damage</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={draft.contactDamage} onChange={(e) => update({ contactDamage: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Score value</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={draft.scoreValue} onChange={(e) => update({ scoreValue: Number(e.target.value) })} />
        </label>
      </div>
      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Speed</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={draft.speed} onChange={(e) => update({ speed: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Turn rate</span>
          <input type="number" min={0} step={0.1} className="shmup-input shmup-input--small" value={draft.turnRate} onChange={(e) => update({ turnRate: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Hitbox size</span>
          <input type="number" min={1} className="shmup-input shmup-input--small" value={draft.size} onChange={(e) => update({ size: Number(e.target.value) })} />
        </label>
      </div>
      <p className="shmup-hint">
        Speed and turn rate drive how this Unit travels between an encounter's waypoints (px/sec, and how sharply it can curve — a multiple of
        each segment's straight-line length). There's no per-Action movement anymore.
      </p>

      <div className="shmup-field">
        <span>Parts ({draft.parts.length})</span>
        <p className="shmup-hint">
          Named anchor points, each with its own reusable Weapons buffet and its own independent attack track per encounter placement — a
          battleship's three turrets are three Parts. Most Units just need the default "Main" part.
        </p>
        <ul className="shmup-encounter-list">
          {draft.parts.map((part) => (
            <li key={part.id} className="shmup-encounter-list__row">
              <span>
                {part.name} — {partSummary(part)}
              </span>
              <div className="shmup-btn-row">
                <button type="button" className="shmup-btn shmup-btn--small" onClick={() => onEditPart(part)}>
                  Edit
                </button>
                {pendingDeletePartId === part.id ? (
                  <>
                    <button
                      type="button"
                      className="shmup-btn shmup-btn--small shmup-btn--danger"
                      onClick={() => {
                        onDeletePart(part.id);
                        setPendingDeletePartId(null);
                      }}
                    >
                      Confirm
                    </button>
                    <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeletePartId(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="shmup-btn shmup-btn--small"
                    disabled={draft.parts.length <= 1}
                    title={draft.parts.length <= 1 ? "A Unit needs at least one Part" : undefined}
                    onClick={() => setPendingDeletePartId(part.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="shmup-btn-row">
          <button type="button" className="shmup-btn shmup-btn--small" onClick={onNewPart}>
            + New Part
          </button>
        </div>
      </div>

      {error && <p className="shmup-error">{error}</p>}
      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn shmup-btn--primary" disabled={!!error} onClick={handleSave}>
          Save Unit
        </button>
        <button type="button" className="shmup-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
