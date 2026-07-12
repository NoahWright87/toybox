import type { EncounterStep } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

interface StepPanelProps {
  unit: UnitDef | undefined;
  step: EncounterStep;
  /** True when this step's `time` is computed from distance/speed rather than freely authored — see encounterTiming.ts. */
  timeDerived: boolean;
  /** True when a next step exists at a different position — i.e. this step's Speed Multiplier actually affects something (the segment leaving here). Distinct from timeDerived, which is about the segment *arriving* here. */
  hasOutgoingSegment: boolean;
  onChange: (patch: Partial<EncounterStep>) => void;
}

/**
 * Below-canvas settings for a selected step (specs/shmup-editor.md's
 * Timing section) — replaces the old NodePanel/EdgePanel tab pair: an
 * encounter no longer authors movement/dwell/attack params directly, it
 * just picks an Action from the referenced Unit's buffet and says when it
 * activates. Movement itself (bezier handles) is edited on the canvas, not
 * here — see EncounterEditor.tsx.
 *
 * **"When" is usually computed, not typed in.** A step whose position
 * differs from its predecessor's gets its `time` derived from the bezier
 * segment's arc length and the owning Unit's `speed` (encounterTiming.ts)
 * — the Time field goes read-only in that case, with a hint pointing at
 * the timeline (drag to retime) or this step's own Speed Multiplier (which
 * governs how long the *next* step takes to arrive) as the actual
 * controls. It's only freely editable for a step with nothing to derive
 * from — the first step of an instance, or one dwelling at the same
 * position as its predecessor.
 */
export default function StepPanel({ unit, step, timeDerived, hasOutgoingSegment, onChange }: StepPanelProps) {
  const action = unit?.actions.find((a) => a.id === step.actionId);
  const showAimOverride = action?.attack?.enabled && action.attack.aim === "fixed";
  const showSpeedOverride = hasOutgoingSegment;

  return (
    <div className="shmup-panel">
      <label className="shmup-field shmup-field--inline">
        <span>Time (sec)</span>
        <input
          type="number"
          min={0}
          step={0.1}
          className="shmup-input shmup-input--small"
          value={Number(step.time.toFixed(2))}
          disabled={timeDerived}
          onChange={(e) => onChange({ time: Number(e.target.value) })}
        />
      </label>
      {timeDerived && (
        <p className="shmup-hint">
          Auto — based on the distance from the previous step and its Action's speed. Drag this step on the timeline (or adjust the previous
          step's Speed Multiplier) to change pacing.
        </p>
      )}

      <label className="shmup-field shmup-field--inline">
        <span>Action</span>
        {unit ? (
          <select className="shmup-input" value={step.actionId} onChange={(e) => onChange({ actionId: e.target.value })}>
            {unit.actions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="shmup-error">(missing Unit)</span>
        )}
      </label>

      {showAimOverride && (
        <label className="shmup-field shmup-field--inline">
          <span>Aim angle override (deg)</span>
          <input
            type="number"
            className="shmup-input shmup-input--small"
            placeholder={String(action!.attack!.fixedAngleDeg)}
            value={step.aimAngleOverride ?? ""}
            onChange={(e) => onChange({ aimAngleOverride: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
      )}
      {showSpeedOverride && (
        <>
          <label className="shmup-field shmup-field--inline">
            <span>Speed multiplier</span>
            <input
              type="number"
              min={0}
              step={0.1}
              className="shmup-input shmup-input--small"
              value={step.speedMultiplier}
              onChange={(e) => onChange({ speedMultiplier: Number(e.target.value) })}
            />
          </label>
          <p className="shmup-hint">Also controls how long it takes to reach the next step (2 = twice as fast, half the travel time).</p>
        </>
      )}
    </div>
  );
}
