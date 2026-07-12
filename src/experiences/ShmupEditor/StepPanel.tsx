import type { EncounterStep } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

interface StepPanelProps {
  unit: UnitDef | undefined;
  step: EncounterStep;
  onChange: (patch: Partial<EncounterStep>) => void;
}

/**
 * Below-canvas settings for a selected step (specs/shmup-editor.md's
 * Encounter editor section) — replaces the old NodePanel/EdgePanel tab
 * pair: an encounter no longer authors movement/dwell/attack params
 * directly, it just picks an Action from the referenced Unit's buffet and
 * says when it activates. "When" used to be a Trigger object (always/
 * unitPosition/playerPosition/time) but is now just a plain `time` field —
 * the timeline scrubber (EncounterTimeline.tsx) is the primary way to set
 * it by dragging, this numeric field is here for precision. The two narrow
 * per-placement overrides (firing angle, speed multiplier) only appear
 * when the selected action actually has something for them to apply to.
 */
export default function StepPanel({ unit, step, onChange }: StepPanelProps) {
  const action = unit?.actions.find((a) => a.id === step.actionId);
  const showAimOverride = action?.attack?.enabled && action.attack.aim === "fixed";
  const showSpeedOverride = action?.movement != null;

  return (
    <div className="shmup-panel">
      <label className="shmup-field shmup-field--inline">
        <span>Time (sec)</span>
        <input
          type="number"
          min={0}
          step={0.1}
          className="shmup-input shmup-input--small"
          value={step.time}
          onChange={(e) => onChange({ time: Number(e.target.value) })}
        />
      </label>

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
        <label className="shmup-field shmup-field--inline">
          <span>Speed multiplier</span>
          <input type="number" min={0} step={0.1} className="shmup-input shmup-input--small" value={step.speedMultiplier} onChange={(e) => onChange({ speedMultiplier: Number(e.target.value) })} />
        </label>
      )}
    </div>
  );
}
