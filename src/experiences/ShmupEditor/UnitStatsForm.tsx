import { useState } from "react";
import { Dial } from "../../components/Dial/Dial";
import SpritePicker from "./SpritePicker";
import ActionForm from "./ActionForm";
import UnitMovementPreview from "./UnitMovementPreview";
import { resolveSpriteUrl } from "./enemySprites";
import { MIN_TURN_RATE_DEG_PER_SEC } from "./turning";
import { cloneAction, clonePart, createBlankAction, type ActionDef, type UnitDef, type UnitLayer, type UnitPart } from "./unitTypes";

interface UnitStatsFormProps {
  unit: UnitDef;
  units: UnitDef[];
  onSave: (unit: UnitDef) => void;
  onCancel: () => void;
  /** Null for a Unit that isn't in the library yet — nothing to duplicate or delete until it's been saved once. */
  onDuplicate: (() => void) | null;
  onDelete: (() => void) | null;
  /** Called on every change so the caller can persist the in-progress draft — root CLAUDE.md's mandatory in-progress-session-survives-reload rule. */
  onDraftChange: (unit: UnitDef) => void;
  onNewPart: () => void;
  onEditPart: (part: UnitPart) => void;
  onDeletePart: (partId: string) => void;
}

type UnitTab = "stats" | "visuals" | "actions" | "parts";

function validate(unit: UnitDef): string | null {
  if (!unit.name.trim()) return "Name is required.";
  if (unit.hp <= 0) return "HP must be positive.";
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
 * across encounters (see EncounterEditor.tsx).
 *
 * **Tabbed (Stats/Visuals/Actions/Parts) with `Dial` knobs for the stat
 * fields**, mirroring `EncounterEditor.tsx`'s tab treatment — explanatory
 * text that used to sit inline as `.shmup-hint` paragraphs now lives in the
 * Help menu's "Units & Actions" topic instead. Parts still navigate to a
 * dedicated `PartEditor.tsx` view on Edit (a Part is a full sub-form in its
 * own right, not something that fits inline the way an Action does).
 *
 * **Visuals is its own tab, not part of Stats** (Noah) — today it holds
 * only the sprite picker, but it's the seam everything about how a Unit
 * *looks* lands on next (per-Unit animation being the near-term one), and a
 * tab that grows is better than a stats page that slowly turns into two
 * unrelated pages. `defaultActionId` moved off that page too, onto
 * **Actions**, next to the buffet whose entries it picks from — it was only
 * ever on Basics because that's where the plain fields happened to live.
 *
 * Stats leads with a live `UnitMovementPreview` — `speed`/`turnRate`/hitbox
 * `size` are exactly the kind of numbers you can't judge without watching
 * them, the same argument `ActionPreview.tsx` settles on the Action side.
 */
export default function UnitStatsForm({ unit, units, onSave, onCancel, onDuplicate, onDelete, onDraftChange, onNewPart, onEditPart, onDeletePart }: UnitStatsFormProps) {
  /** Delete is destructive and sits next to Save, so it arms first. */
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState<UnitDef>(unit);
  const [tab, setTab] = useState<UnitTab>("stats");
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

  /** Clone button (design-handoff v3 §8.1) — the intended way to author a fixed-angle/differently-tuned variant of an existing Action without re-entering every field by hand. */
  function handleCloneAction(action: ActionDef) {
    update({ actions: [...draft.actions, cloneAction(action)] });
  }

  function deleteAction(actionId: string) {
    update({
      actions: draft.actions.filter((a) => a.id !== actionId),
      defaultActionId: draft.defaultActionId === actionId ? null : draft.defaultActionId,
    });
    setPendingDeleteActionId(null);
    if (expandedActionId === actionId) setExpandedActionId(null);
  }

  /**
   * `onNewPart`/`onEditPart` navigate away to `PartEditor.tsx`'s own view,
   * which remounts this form fresh (with the parent's now-current `unit`)
   * on return — so those two never needed a local update. Delete doesn't
   * navigate anywhere, so without also updating `draft` here directly, the
   * Parts list kept showing the just-deleted Part until the next
   * unrelated remount (a real bug — `onDeletePart` alone only updated the
   * parent's `editingUnit`, never this component's own stale local copy).
   */
  function deletePart(partId: string) {
    update({ parts: draft.parts.filter((p) => p.id !== partId) });
    onDeletePart(partId);
    setPendingDeletePartId(null);
  }

  /** Clone button (design-handoff v3 §8.1) — copies the Part and its own Action buffet in one step, same rationale as handleCloneAction above. */
  function handleClonePart(part: UnitPart) {
    update({ parts: [...draft.parts, clonePart(part)] });
  }

  function handleSave() {
    if (validate(draft)) return;
    onSave({ ...draft, name: draft.name.trim(), modifiedAt: Date.now() });
  }

  return (
    <div className="shmup-enemy-form">
      <div className="shmup-enc-tabs">
        <div className="shmup-enc-tabbar">
          <button type="button" className={`shmup-enc-tab-btn ${tab === "stats" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setTab("stats")}>
            Stats
          </button>
          <button type="button" className={`shmup-enc-tab-btn ${tab === "visuals" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setTab("visuals")}>
            Visuals
          </button>
          <button type="button" className={`shmup-enc-tab-btn ${tab === "actions" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setTab("actions")}>
            Actions ({draft.actions.length})
          </button>
          <button type="button" className={`shmup-enc-tab-btn ${tab === "parts" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setTab("parts")}>
            Parts ({draft.parts.length})
          </button>
        </div>

        <div className="shmup-enc-tab-content">
          {tab === "stats" && (
            <div className="shmup-panel">
              <label className="shmup-field shmup-field--inline">
                <span>Name</span>
                <input type="text" className="shmup-input" value={draft.name} onChange={(e) => update({ name: e.target.value })} />
              </label>

              {/* The movement dials are directly below it, so it sits with them rather than at the top of the tab. */}
              <UnitMovementPreview
                spriteUrl={resolveSpriteUrl(draft.spriteId, draft.customSprite)}
                speed={draft.speed}
                minSpeed={draft.minSpeed}
                turnRateDegPerSec={draft.turnRateDegPerSec}
                size={draft.size}
              />

              <div className="shmup-dial-grid">
                {/* Lowering top speed drags the floor down with it — a minimum above the maximum isn't a Unit, it's a contradiction. */}
                <Dial label="Speed" value={draft.speed} onChange={(v) => update({ speed: Math.max(0, v), minSpeed: Math.min(draft.minSpeed, Math.max(0, v)) })} min={0} step={10} showNudgeButtons />
                <Dial label="Min speed" value={draft.minSpeed} onChange={(v) => update({ minSpeed: Math.min(draft.speed, Math.max(0, v)) })} min={0} max={draft.speed} step={5} showNudgeButtons />
                <Dial
                  label="Turn °/sec"
                  value={draft.turnRateDegPerSec}
                  onChange={(v) => update({ turnRateDegPerSec: Math.max(MIN_TURN_RATE_DEG_PER_SEC, v) })}
                  min={MIN_TURN_RATE_DEG_PER_SEC}
                  step={5}
                  showNudgeButtons
                />
                <Dial label="Hitbox size" value={draft.size} onChange={(v) => update({ size: Math.max(1, v) })} min={1} step={1} showNudgeButtons />
              </div>
              <div className="shmup-dial-grid">
                <Dial label="HP" value={draft.hp} onChange={(v) => update({ hp: Math.max(1, v) })} min={1} step={1} showNudgeButtons />
                <Dial label="Contact dmg" value={draft.contactDamage} onChange={(v) => update({ contactDamage: Math.max(0, v) })} min={0} step={1} showNudgeButtons />
                <Dial label="Score" value={draft.scoreValue} onChange={(v) => update({ scoreValue: Math.max(0, v) })} min={0} step={10} showNudgeButtons />
              </div>

              <label className="shmup-field shmup-field--inline">
                <span>Layer</span>
                <select className="shmup-input" value={draft.layer} onChange={(e) => update({ layer: e.target.value as UnitLayer })}>
                  <option value="ground">Ground</option>
                  <option value="air">Air</option>
                  <option value="doodad">Doodad</option>
                </select>
              </label>
            </div>
          )}

          {tab === "visuals" && (
            <div className="shmup-panel">
              <SpritePicker spriteId={draft.spriteId} customSprite={draft.customSprite} onChange={(spriteId, customSprite) => update({ spriteId, customSprite })} />
            </div>
          )}

          {tab === "actions" && (
            <div className="shmup-panel">
              {/* Lives here rather than on Stats: it picks one of the Actions listed directly below it, and is meaningless until at least one exists. */}
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
          )}

          {tab === "parts" && (
            <div className="shmup-panel">
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
                      <button type="button" className="shmup-btn shmup-btn--small" onClick={() => handleClonePart(part)}>
                        Clone
                      </button>
                      {pendingDeletePartId === part.id ? (
                        <>
                          <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" onClick={() => deletePart(part.id)}>
                            Confirm
                          </button>
                          <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeletePartId(null)}>
                            Keep
                          </button>
                        </>
                      ) : (
                        <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setPendingDeletePartId(part.id)}>
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
          )}
        </div>
      </div>

      {error && <p className="shmup-error">{error}</p>}
      {/* Duplicate/Delete live here rather than in the library grid — see
          TileEditorForm's matching note. */}
      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn shmup-btn--primary" disabled={!!error} onClick={handleSave}>
          Save Unit
        </button>
        <button type="button" className="shmup-btn" onClick={onCancel}>
          Cancel
        </button>
        {onDuplicate && (
          <button type="button" className="shmup-btn" onClick={onDuplicate}>
            Duplicate
          </button>
        )}
        {onDelete &&
          (confirmingDelete ? (
            <>
              <button type="button" className="shmup-btn shmup-btn--danger" onClick={onDelete}>
                Confirm Delete
              </button>
              <button type="button" className="shmup-btn" onClick={() => setConfirmingDelete(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className="shmup-btn" onClick={() => setConfirmingDelete(true)}>
              Delete
            </button>
          ))}
      </div>
    </div>
  );
}
