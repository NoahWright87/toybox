import { useState } from "react";
import SpritePicker from "./SpritePicker";
import PartPositionEditor from "./PartPositionEditor";
import WeaponForm from "./WeaponForm";
import { resolveSpriteUrl } from "./enemySprites";
import { createBlankWeapon, type UnitDef, type UnitPart, type WeaponDef } from "./unitTypes";

interface PartEditorProps {
  part: UnitPart;
  /** The Unit this Part belongs to — its sprite renders dimmed as a position reference, see PartPositionEditor.tsx. */
  unit: UnitDef;
  units: UnitDef[];
  /** The Unit currently being authored — excluded from each Weapon's spawn picker, see WeaponForm.tsx. */
  excludeUnitId: string;
  onSave: (part: UnitPart) => void;
  onCancel: () => void;
  /** Called on every change so the caller can persist the in-progress draft — root CLAUDE.md's mandatory in-progress-session-survives-reload rule. */
  onDraftChange: (part: UnitPart) => void;
}

function validate(part: UnitPart): string | null {
  if (!part.name.trim()) return "Name is required.";
  return null;
}

function weaponSummary(weapon: WeaponDef): string {
  const aim = weapon.aimMode === "fixed" ? `fixed ${weapon.fixedAngleDeg}°` : weapon.trackPlayer ? "tracks player" : "snapshots player";
  const spawn = weapon.spawnUnitId ? "spawns Unit" : "spawns nothing yet";
  return `${aim}, ${weapon.count} shot(s), ${spawn}`;
}

/**
 * One reusable Part: a name, an optional sprite, a position offset from
 * the Unit's own origin (anchors its Weapons and their aim handle — a
 * turret mounted forward of a battleship's center), and a reusable buffet
 * of Weapons. The offset is set visually (`PartPositionEditor.tsx` —
 * drag the Part's sprite over a dimmed reference of the Unit's own body,
 * or nudge with arrow buttons) as well as by typing exact numbers — the
 * plain fields alone gave no way to actually *see* where a Part would
 * land. Weapons are edited inline here (expand-in-place, live two-way
 * bound) rather than getting their own dedicated view/session — a
 * Weapon's field count is comparable to the old inline
 * AttackPayloadForm, which never needed a separate Save/Cancel flow
 * either.
 */
export default function PartEditor({ part, unit, units, excludeUnitId, onSave, onCancel, onDraftChange }: PartEditorProps) {
  const [draft, setDraft] = useState<UnitPart>(part);
  const [expandedWeaponId, setExpandedWeaponId] = useState<string | null>(null);
  const [pendingDeleteWeaponId, setPendingDeleteWeaponId] = useState<string | null>(null);
  const error = validate(draft);

  function update(patch: Partial<UnitPart>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onDraftChange(next);
  }

  function updateWeapon(weaponId: string, weapon: WeaponDef) {
    update({ weapons: draft.weapons.map((w) => (w.id === weaponId ? weapon : w)) });
  }

  function addWeapon() {
    const weapon = createBlankWeapon(draft.weapons.length);
    update({ weapons: [...draft.weapons, weapon] });
    setExpandedWeaponId(weapon.id);
  }

  function deleteWeapon(weaponId: string) {
    update({ weapons: draft.weapons.filter((w) => w.id !== weaponId) });
    setPendingDeleteWeaponId(null);
    if (expandedWeaponId === weaponId) setExpandedWeaponId(null);
  }

  function handleSave() {
    if (validate(draft)) return;
    onSave({ ...draft, name: draft.name.trim() });
  }

  return (
    <div className="shmup-enemy-form">
      <label className="shmup-field shmup-field--inline">
        <span>Name</span>
        <input type="text" className="shmup-input" value={draft.name} onChange={(e) => update({ name: e.target.value })} />
      </label>

      <SpritePicker spriteId={draft.spriteId} customSprite={draft.customSprite} onChange={(spriteId, customSprite) => update({ spriteId, customSprite })} />

      <div className="shmup-field">
        <span>Position</span>
        <p className="shmup-hint">
          The dimmed sprite is the Unit's own body, for reference — drag this Part's sprite (or use the arrows) to place it, e.g. a turret
          mounted forward of a ship's center.
        </p>
        <PartPositionEditor
          bodySpriteUrl={resolveSpriteUrl(unit.spriteId, unit.customSprite)}
          bodyLabel={unit.name}
          partSpriteUrl={resolveSpriteUrl(draft.spriteId, draft.customSprite)}
          offset={draft.offset}
          onChange={(offset) => update({ offset })}
        />
        <div className="shmup-field-row">
          <label className="shmup-field shmup-field--inline">
            <span>Offset X</span>
            <input type="number" className="shmup-input shmup-input--small" value={draft.offset.x} onChange={(e) => update({ offset: { ...draft.offset, x: Number(e.target.value) } })} />
          </label>
          <label className="shmup-field shmup-field--inline">
            <span>Offset Y</span>
            <input type="number" className="shmup-input shmup-input--small" value={draft.offset.y} onChange={(e) => update({ offset: { ...draft.offset, y: Number(e.target.value) } })} />
          </label>
        </div>
      </div>

      <div className="shmup-field">
        <span>Weapons ({draft.weapons.length})</span>
        <p className="shmup-hint">Authored once, placed on this Part's own independent attack track per encounter placement.</p>
        <ul className="shmup-encounter-list">
          {draft.weapons.map((weapon) => (
            <li key={weapon.id} className="shmup-encounter-list__row shmup-encounter-list__row--stack">
              <div className="shmup-encounter-list__row-header">
                <span>
                  {weapon.name} — {weaponSummary(weapon)}
                </span>
                <div className="shmup-btn-row">
                  <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setExpandedWeaponId(expandedWeaponId === weapon.id ? null : weapon.id)}>
                    {expandedWeaponId === weapon.id ? "Collapse" : "Edit"}
                  </button>
                  {pendingDeleteWeaponId === weapon.id ? (
                    <>
                      <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" onClick={() => deleteWeapon(weapon.id)}>
                        Confirm
                      </button>
                      <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteWeaponId(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteWeaponId(weapon.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {expandedWeaponId === weapon.id && <WeaponForm weapon={weapon} onChange={(w) => updateWeapon(weapon.id, w)} units={units} excludeUnitId={excludeUnitId} />}
            </li>
          ))}
        </ul>
        <div className="shmup-btn-row">
          <button type="button" className="shmup-btn shmup-btn--small" onClick={addWeapon}>
            + New Weapon
          </button>
        </div>
      </div>

      {error && <p className="shmup-error">{error}</p>}
      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn shmup-btn--primary" disabled={!!error} onClick={handleSave}>
          Save Part
        </button>
        <button type="button" className="shmup-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
