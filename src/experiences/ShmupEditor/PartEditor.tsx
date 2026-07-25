import { useState } from "react";
import { Dial } from "../../components/Dial/Dial";
import SpritePicker from "./SpritePicker";
import PartPositionEditor from "./PartPositionEditor";
import ActionForm from "./ActionForm";
import { resolveSpriteUrl } from "./enemySprites";
import { cloneAction, createBlankAction, type ActionDef, type UnitDef, type UnitPart } from "./unitTypes";

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

type PartTab = "basics" | "hitbox" | "actions";

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
 * as well as via `Dial` for exact numbers — the plain fields alone gave no
 * way to actually *see* where a Part would land. Actions are edited inline
 * (expand-in-place, live two-way bound) rather than getting their own
 * dedicated view/session.
 *
 * **Tabbed (Basics/Hitbox/Actions)**, mirroring `EncounterEditor.tsx`'s tab
 * treatment — explanatory text that used to sit inline as `.shmup-hint`
 * paragraphs now lives in the Help menu's "Units & Actions" topic instead.
 */
export default function PartEditor({ part, unit, units, excludeUnitId, onSave, onCancel, onDraftChange }: PartEditorProps) {
  const [draft, setDraft] = useState<UnitPart>(part);
  const [tab, setTab] = useState<PartTab>("basics");
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

  /** Clone button (design-handoff v3 §8.1) — the intended way to author a fixed-angle/differently-tuned variant of an existing Action without re-entering every field by hand. */
  function handleCloneAction(action: ActionDef) {
    update({ actions: [...draft.actions, cloneAction(action)] });
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
      <div className="shmup-enc-tabs">
        <div className="shmup-enc-tabbar">
          <button type="button" className={`shmup-enc-tab-btn ${tab === "basics" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setTab("basics")}>
            Basics
          </button>
          <button type="button" className={`shmup-enc-tab-btn ${tab === "hitbox" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setTab("hitbox")}>
            Hitbox
          </button>
          <button type="button" className={`shmup-enc-tab-btn ${tab === "actions" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setTab("actions")}>
            Actions ({draft.actions.length})
          </button>
        </div>

        <div className="shmup-enc-tab-content">
          {tab === "basics" && (
            <div className="shmup-panel">
              <label className="shmup-field shmup-field--inline">
                <span>Name</span>
                <input type="text" className="shmup-input" value={draft.name} onChange={(e) => update({ name: e.target.value })} />
              </label>

              <SpritePicker spriteId={draft.spriteId} customSprite={draft.customSprite} onChange={(spriteId, customSprite) => update({ spriteId, customSprite })} />

              <PartPositionEditor
                bodySpriteUrl={resolveSpriteUrl(unit.spriteId, unit.customSprite)}
                bodyLabel={unit.name}
                partSpriteUrl={resolveSpriteUrl(draft.spriteId, draft.customSprite)}
                offset={draft.offset}
                onChange={(offset) => update({ offset })}
              />
              <div className="shmup-dial-grid">
                <Dial label="Offset X" value={draft.offset.x} onChange={(v) => update({ offset: { ...draft.offset, x: v } })} step={5} showNudgeButtons />
                <Dial label="Offset Y" value={draft.offset.y} onChange={(v) => update({ offset: { ...draft.offset, y: v } })} step={5} showNudgeButtons />
              </div>
            </div>
          )}

          {tab === "hitbox" && (
            <div className="shmup-panel">
              <label className="shmup-checkbox">
                <input type="checkbox" checked={draft.hasHitbox} onChange={(e) => update({ hasHitbox: e.target.checked })} />
                Has its own hitbox
              </label>
              {draft.hasHitbox && (
                <>
                  <div className="shmup-dial-grid">
                    <Dial label="Damage x" value={draft.damageMultiplier} onChange={(v) => update({ damageMultiplier: Math.max(0, v) })} min={0} step={0.1} showNudgeButtons />
                  </div>
                  <label className="shmup-checkbox">
                    <input type="checkbox" checked={draft.hasHealth} onChange={(e) => update({ hasHealth: e.target.checked })} />
                    Has its own HP pool
                  </label>
                  {draft.hasHealth && (
                    <div className="shmup-dial-grid">
                      <Dial label="HP" value={draft.hp} onChange={(v) => update({ hp: Math.max(1, v) })} min={1} step={1} showNudgeButtons />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "actions" && (
            <div className="shmup-panel">
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
                        <button type="button" className="shmup-btn shmup-btn--small" onClick={() => handleCloneAction(action)}>
                          Clone
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
          )}
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
