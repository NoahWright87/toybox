import { useState } from "react";
import SpritePicker from "./SpritePicker";
import type { EnemyDef } from "./enemyTypes";

interface EnemyStatsFormProps {
  enemy: EnemyDef;
  onSave: (enemy: EnemyDef) => void;
  onCancel: () => void;
  /** Called on every change so the caller can persist the in-progress draft — root CLAUDE.md's mandatory in-progress-session-survives-reload rule. */
  onDraftChange: (enemy: EnemyDef) => void;
}

function validate(enemy: EnemyDef): string | null {
  if (!enemy.name.trim()) return "Name is required.";
  if (enemy.hp <= 0) return "HP must be positive.";
  return null;
}

/**
 * Plain stats form — an enemy is just a sprite + a handful of numbers, no
 * behavior (movement/dwell/attack live on encounters instead, see
 * encounterTypes.ts and EncounterEditor.tsx). Same toolbar-then-fields
 * shape as TileEditorForm.tsx, just no diagram since there's nothing
 * spatial to author here.
 */
export default function EnemyStatsForm({ enemy, onSave, onCancel, onDraftChange }: EnemyStatsFormProps) {
  const [draft, setDraft] = useState<EnemyDef>(enemy);
  const error = validate(draft);

  function update(patch: Partial<EnemyDef>) {
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
          <span>Base speed</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={draft.baseSpeed} onChange={(e) => update({ baseSpeed: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Hitbox size</span>
          <input type="number" min={1} className="shmup-input shmup-input--small" value={draft.size} onChange={(e) => update({ size: Number(e.target.value) })} />
        </label>
      </div>

      {error && <p className="shmup-error">{error}</p>}
      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn shmup-btn--primary" disabled={!!error} onClick={handleSave}>
          Save Enemy
        </button>
        <button type="button" className="shmup-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
