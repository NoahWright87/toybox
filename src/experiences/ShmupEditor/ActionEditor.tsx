import { useState } from "react";
import AttackPayloadForm from "./AttackPayloadForm";
import MovementForm from "./MovementForm";
import { defaultMovement, type ActionDef, type AnimationState, ANIMATION_STATES } from "./unitTypes";

interface ActionEditorProps {
  action: ActionDef;
  onSave: (action: ActionDef) => void;
  onCancel: () => void;
  /** Called on every change so the caller can persist the in-progress draft — root CLAUDE.md's mandatory in-progress-session-survives-reload rule. */
  onDraftChange: (action: ActionDef) => void;
}

function validate(action: ActionDef): string | null {
  if (!action.name.trim()) return "Name is required.";
  return null;
}

/**
 * One reusable Action: a movement-or-stationary behavior, an optional
 * attack, an animation state, and a visibility flag (false = hidden +
 * hitbox disabled — what Disappear/teleport-out/pop-down are made of, see
 * unitTypes.ts). Reuses MovementForm/AttackPayloadForm as-is — only where
 * they're invoked from changed (once per Unit now, not once per encounter
 * placement).
 */
export default function ActionEditor({ action, onSave, onCancel, onDraftChange }: ActionEditorProps) {
  const [draft, setDraft] = useState<ActionDef>(action);
  const error = validate(draft);

  function update(patch: Partial<ActionDef>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onDraftChange(next);
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

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Animation</span>
          <select className="shmup-input" value={draft.animationState} onChange={(e) => update({ animationState: e.target.value as AnimationState })}>
            {ANIMATION_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="shmup-checkbox">
          <input type="checkbox" checked={draft.visible} onChange={(e) => update({ visible: e.target.checked })} />
          Visible (uncheck for Disappear/teleport-out/pop-down)
        </label>
      </div>

      <div className="shmup-field">
        <label className="shmup-checkbox">
          <input type="checkbox" checked={draft.movement !== null} onChange={(e) => update({ movement: e.target.checked ? defaultMovement() : null })} />
          Moves (unchecked = stationary/dwell in place)
        </label>
        {draft.movement && <MovementForm movement={draft.movement} onChange={(movement) => update({ movement })} />}
      </div>

      <AttackPayloadForm payload={draft.attack} onChange={(attack) => update({ attack })} label="Attacks during this Action" />

      {error && <p className="shmup-error">{error}</p>}
      <div className="shmup-btn-row">
        <button type="button" className="shmup-btn shmup-btn--primary" disabled={!!error} onClick={handleSave}>
          Save Action
        </button>
        <button type="button" className="shmup-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
