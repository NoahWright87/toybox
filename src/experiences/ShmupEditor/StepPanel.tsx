import { Dial } from "../../components/Dial/Dial";
import type { EncounterStep } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

interface StepPanelProps {
  step: EncounterStep;
  /** The owning instance's Unit — supplies the Action picker's options (`unitDef.actions`). */
  unitDef: UnitDef | undefined;
  /** True when this step's `time` is computed from distance/speed rather than freely authored — see encounterTiming.ts. */
  timeDerived: boolean;
  onChange: (patch: Partial<EncounterStep>) => void;
}

/**
 * Below-canvas settings for a selected step, rendered inside the Step tab
 * (EncounterEditor.tsx). A step is a position + time + bezier handles +
 * which of the owning Unit's own Actions governs the segment leaving it;
 * movement itself (bezier handles) is edited on the canvas, not here.
 * Full behavior notes live in the Help menu, not inline — see
 * specs/shmup-editor.md's Encounter editor section for the rest.
 *
 * **No more "Speed x" override or "Visible" checkbox.** Both used to be
 * per-step fields; now that movement% lives on the shared, reusable Action
 * (unitTypes.ts), retiming a segment means picking a different Action for
 * this step, not dragging a per-placement multiplier — the drag-a-derived-
 * step-to-retime gesture is gone for the same reason (see
 * encounterTiming.ts's file header). Visibility is likewise no longer a
 * stored flag — invincibility is derived from the Action sequence
 * (actionState.ts), and the low-fi hitbox preview shows it directly.
 */
export default function StepPanel({ step, unitDef, timeDerived, onChange }: StepPanelProps) {
  const actions = unitDef?.actions ?? [];

  return (
    <div className="shmup-panel">
      <div className="shmup-dial-grid">
        {timeDerived ? (
          <div className="shmup-readout">
            <span className="shmup-readout__label">Time (auto)</span>
            <span className="shmup-readout__value">{step.time.toFixed(2)}s</span>
          </div>
        ) : (
          <Dial label="Time (s)" value={step.time} onChange={(v) => onChange({ time: Math.max(0, v) })} step={0.1} showNudgeButtons />
        )}
      </div>

      <label className="shmup-field shmup-field--inline">
        <span>Action</span>
        {actions.length > 0 ? (
          <select className="shmup-input" value={step.actionId ?? ""} onChange={(e) => onChange({ actionId: e.target.value === "" ? null : e.target.value })}>
            <option value="">(none — holds position)</option>
            {actions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="shmup-error">(no Actions on this Unit yet)</span>
        )}
      </label>
    </div>
  );
}
