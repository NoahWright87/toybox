import { useState } from "react";
import SpritePicker from "./SpritePicker";
import ActionForm from "./ActionForm";
import { createBlankAction, type ActionDef, type UnitDef, type UnitLayer, type UnitPart } from "./unitTypes";

interface UnitStatsFormProps {
  unit: UnitDef;
  units: UnitDef[];
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
  return part.actions.length === 1 ? "1 action" : `${part.actions.length} actions`;
}

function actionSummary(action: ActionDef): string {
  const movement = action.movementPercent === 0 ? "stationary" : `${action.movementPercent}% move`;
  const attack = action.attack ? `${action.attack.count} shot(s)` : "no attack";
  return `${movement}, ${attack}`;
}

/**
 * Stats form + the Unit's own reusable Action buffet + reusable Part
 * buffet — a Unit is sprite + stats (including `speed`/`turnRate`, which
 * drive movement between encounter waypoints — see unitTypes.ts) + a
 * `layer` + a set of Actions (used directly when the Unit has no Parts,
 * and always governing the base Unit's own movement/facing/state) + a set
 * of Parts, each owning its own independent reusable Action buffet (see
 * PartEditor.tsx), authored once here and selected/placed repeatedly
 * across encounters (see EncounterEditor.tsx). Same toolbar-then-fields
 * shape as TileEditorForm.tsx; the Parts section mirrors that form's
 * Encounters section (list + New/Edit/Delete, editing navigates to a
 * dedicated view).
 */
export default function UnitStatsForm({ unit, units, onSave, onCancel, onDraftChange, onNewPart, onEditPart, onDeletePart }: UnitStatsFormProps) {
  const [draft, setDraft] = useState<UnitDef>(unit);
  const [pendingDeletePartId, setPendingDeletePartId] = useState<string | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [pendingDeleteActionId, setPendingDeleteActionId] = useState<string | null>(null);
  const error = validate(draft);

  function update(patch: Partial<UnitDef>) {
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
    update({
      actions: draft.actions.filter((a) => a.id !== actionId),
      defaultActionId: draft.defaultActionId === actionId ? null : draft.defaultActionId,
    });
    setPendingDeleteActionId(null);
    if (expandedActionId === actionId) setExpandedActionId(null);
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
        Speed is this Unit's fixed max — an Action's Movement % selects how much of it is actually used. Turn rate is how sharply it can curve
        between an encounter's waypoints (a multiple of each segment's straight-line length).
      </p>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Layer</span>
          <select className="shmup-input" value={draft.layer} onChange={(e) => update({ layer: e.target.value as UnitLayer })}>
            <option value="ground">Ground</option>
            <option value="air">Air</option>
            <option value="doodad">Doodad</option>
          </select>
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Default Action</span>
          <select className="shmup-input" value={draft.defaultActionId ?? ""} onChange={(e) => update({ defaultActionId: e.target.value === "" ? null : e.target.value })}>
            <option value="">(none)</option>
            {draft.actions.map((action) => (
              <option key={action.id} value={action.id}>
                {action.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="shmup-hint">Default Action is used when this Unit is spawned dynamically (e.g. as another Action's projectile) rather than hand-placed on a tile.</p>

      <div className="shmup-field">
        <span>Actions ({draft.actions.length})</span>
        <p className="shmup-hint">
          This Unit's own reusable Action buffet — used directly when it has no Parts, and always governs the base Unit's own
          movement/facing/state.
        </p>
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
              {expandedActionId === action.id && <ActionForm action={action} onChange={(a) => updateAction(action.id, a)} units={units} excludeUnitId={draft.id} />}
            </li>
          ))}
        </ul>
        <div className="shmup-btn-row">
          <button type="button" className="shmup-btn shmup-btn--small" onClick={addAction}>
            + New Action
          </button>
        </div>
      </div>

      <div className="shmup-field">
        <span>Parts ({draft.parts.length})</span>
        <p className="shmup-hint">
          Named anchor points, each with its own reusable Action buffet and its own independent action track per encounter placement — a
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
