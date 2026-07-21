import { useState } from "react";
import SpritePicker from "./SpritePicker";
import PartPositionEditor from "./PartPositionEditor";
import ActionForm from "./ActionForm";
import { resolveSpriteUrl } from "./enemySprites";
import { createBlankAction, type ActionDef, type UnitDef, type UnitPart } from "./unitTypes";

interface PartEditorProps {
  part: UnitPart;
  /** The Unit this Part belongs to — its sprite renders dimmed as a position reference, see PartPositionEditor.tsx. */
  unit: UnitDef;
  units: UnitDef[];
  /** The Unit currently being authored — excluded from each Action's spawn picker, see ActionForm.tsx. */
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

function actionSummary(action: ActionDef): string {
  const movement = action.movementPercent === 0 ? "stationary" : `${action.movementPercent}% move`;
  const attack = action.attack ? `${action.attack.count} shot(s)` : "no attack";
  return `${movement}, ${attack}`;
}

/**
 * One reusable Part: a name, an optional sprite, a position offset from
 * the Unit's own origin (anchors its Actions and their attacks' facing —
 * a turret mounted forward of a battleship's center), optional hitbox/
 * health fields, and a reusable buffet of Actions. The offset is set
 * visually (`PartPositionEditor.tsx` — drag the Part's sprite over a
 * dimmed reference of the Unit's own body, or nudge with arrow buttons)
 * as well as by typing exact numbers — the plain fields alone gave no way
 * to actually *see* where a Part would land. Actions are edited inline
 * here (expand-in-place, live two-way bound) rather than getting their
 * own dedicated view/session, same as before the Weapon->Action rename.
 */
export default function PartEditor({ part, unit, units, excludeUnitId, onSave, onCancel, onDraftChange }: PartEditorProps) {
  const [draft, setDraft] = useState<UnitPart>(part);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [pendingDeleteActionId, setPendingDeleteActionId] = useState<string | null>(null);
  const error = validate(draft);

  function update(patch: Partial<UnitPart>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onDraftChange(next);
  }

  function updateAction(actionId: string, action: ActionDef) {
    update({ actions: draft.actions.map((a) => (a.id === actionId ? action : a)) });
  }

  function addAction() {
    const action = createBlankAction(draft.actions.length);
    update({ actions: [...draft.actions, action] });
    setExpandedActionId(action.id);
  }

  function deleteAction(actionId: string) {
    update({ actions: draft.actions.filter((a) => a.id !== actionId) });
    setPendingDeleteActionId(null);
    if (expandedActionId === actionId) setExpandedActionId(null);
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
        <span>Hitbox</span>
        <label className="shmup-checkbox">
          <input type="checkbox" checked={draft.hasHitbox} onChange={(e) => update({ hasHitbox: e.target.checked })} />
          Has its own hitbox (unchecked = fused to the Unit's own body, damage attributes to the Unit)
        </label>
        {draft.hasHitbox && (
          <>
            <div className="shmup-field-row">
              <label className="shmup-field shmup-field--inline">
                <span>Damage multiplier</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="shmup-input shmup-input--small"
                  value={draft.damageMultiplier}
                  onChange={(e) => update({ damageMultiplier: Number(e.target.value) })}
                />
              </label>
            </div>
            <label className="shmup-checkbox">
              <input type="checkbox" checked={draft.hasHealth} onChange={(e) => update({ hasHealth: e.target.checked })} />
              Has its own HP pool (unchecked = damage transfers through to the Unit's shared HP)
            </label>
            {draft.hasHealth && (
              <label className="shmup-field shmup-field--inline">
                <span>HP</span>
                <input type="number" min={1} className="shmup-input shmup-input--small" value={draft.hp} onChange={(e) => update({ hp: Number(e.target.value) })} />
              </label>
            )}
          </>
        )}
      </div>

      <div className="shmup-field">
        <span>Actions ({draft.actions.length})</span>
        <p className="shmup-hint">Authored once, placed on this Part's own independent action track per encounter placement.</p>
        <ul className="shmup-encounter-list">
          {draft.actions.map((action) => (
            <li key={action.id} className="shmup-encounter-list__row shmup-encounter-list__row--stack">
              <div className="shmup-encounter-list__row-header">
                <span>
                  {action.name} — {actionSummary(action)}
                </span>
                <div className="shmup-btn-row">
                  <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setExpandedActionId(expandedActionId === action.id ? null : action.id)}>
                    {expandedActionId === action.id ? "Collapse" : "Edit"}
                  </button>
                  {pendingDeleteActionId === action.id ? (
                    <>
                      <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" onClick={() => deleteAction(action.id)}>
                        Confirm
                      </button>
                      <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteActionId(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeleteActionId(action.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {expandedActionId === action.id && <ActionForm action={action} onChange={(a) => updateAction(action.id, a)} units={units} excludeUnitId={excludeUnitId} />}
            </li>
          ))}
        </ul>
        <div className="shmup-btn-row">
          <button type="button" className="shmup-btn shmup-btn--small" onClick={addAction}>
            + New Action
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
