import { Dial } from "../../components/Dial/Dial";
import { computeAttackDurationMs } from "./hitboxPreview";
import { minDurationWarning } from "./attackValidation";
import type { EncounterUnit, PartActionPlacement } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

interface PartActionPanelProps {
  unit: UnitDef | undefined;
  instance: EncounterUnit;
  placement: PartActionPlacement;
  onChange: (patch: Partial<PartActionPlacement>) => void;
}

function durationReadout(unit: UnitDef | undefined, placement: PartActionPlacement): string | null {
  const part = unit?.parts.find((p) => p.id === placement.partId);
  const action = part?.actions.find((a) => a.id === placement.actionId);
  if (!action?.attack) return null;
  const ms = computeAttackDurationMs(action.attack);
  return ms === null ? "fires indefinitely" : `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Below-canvas settings for a selected Part-Action placement, rendered in
 * the Part tab (EncounterEditor.tsx) — mirrors StepPanel.tsx's role for
 * steps. Full behavior notes live in the Help menu, not inline.
 *
 * **Which Part is not a field here.** It used to be, back when placements
 * were created by a 🔫+ button that made you pick a Part from a popup and
 * left you able to reassign it afterwards. Every Part now owns a visible
 * lane on the timeline and you select a placement *from* that lane, so the
 * Part is context rather than a setting — a dropdown that could silently
 * move a placement onto a different turret is a way to lose work, not a
 * feature. Retargeting means deleting the dot and adding one on the lane you
 * actually meant.
 *
 * **No aim-angle override or authored duration.** Aim is whichever way the
 * referenced Action's own `facing` resolves — Cloning the Action on the Part
 * is how you author a fixed-angle variant. Duration is computed from the
 * Action's own attack fields (`hitboxPreview.ts`'s `computeAttackDurationMs`)
 * and shown read-only. An Action with no attack shows no duration at all,
 * which is correct rather than an omission: a Part Action can legitimately be
 * pure state (invincibility today, a sprite swap once one exists).
 */
export default function PartActionPanel({ unit, instance, placement, onChange }: PartActionPanelProps) {
  const part = unit?.parts.find((p) => p.id === placement.partId);
  const duration = durationReadout(unit, placement);
  const warning = minDurationWarning(instance, unit, placement);

  return (
    <div className="shmup-panel">
      <label className="shmup-field shmup-field--inline">
        <span>{part?.name ?? "Part"}</span>
        {part ? (
          part.actions.length > 0 ? (
            <select className="shmup-input" value={placement.actionId ?? ""} onChange={(e) => onChange({ actionId: e.target.value === "" ? null : e.target.value })}>
              <option value="">(none)</option>
              {part.actions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="shmup-error">(no Actions on this Part — add one from the Units menu)</span>
          )
        ) : (
          <span className="shmup-error">(missing Part)</span>
        )}
      </label>

      <div className="shmup-dial-grid">
        <Dial label="Time (s)" value={placement.time} onChange={(v) => onChange({ time: Math.max(0, v) })} step={0.1} showNudgeButtons />
      </div>
      {duration && (
        <p className="shmup-readout">
          <span className="shmup-readout__label">Duration</span>
          <span className="shmup-readout__value">{duration}</span>
        </p>
      )}
      {warning && <p className="shmup-warning">{warning}</p>}
    </div>
  );
}
