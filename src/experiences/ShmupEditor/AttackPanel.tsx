import { Dial } from "../../components/Dial/Dial";
import { computeAttackDurationMs } from "./hitboxPreview";
import type { PartActionPlacement } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

interface AttackPanelProps {
  unit: UnitDef | undefined;
  attack: PartActionPlacement;
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
 * Below-canvas settings for a selected Part-action placement, rendered
 * inside the Attack tab (EncounterEditor.tsx) — mirrors StepPanel.tsx's
 * role for steps. Full behavior notes live in the Help menu, not inline.
 *
 * **No more aim-angle override or authored duration.** Aim is just
 * whichever way the referenced Action's own `facing` resolves — Cloning
 * the Action (on the Part) is how you'd author a fixed-angle variant, not
 * a per-placement override. Duration is computed from the Action's own
 * attack fields (`hitboxPreview.ts`'s `computeAttackDurationMs`), shown
 * below as a read-only readout, not a field to edit.
 */
export default function AttackPanel({ unit, attack, onChange }: AttackPanelProps) {
  const part = unit?.parts.find((p) => p.id === attack.partId);
  const duration = durationReadout(unit, attack);

  function handlePartChange(partId: string) {
    const nextPart = unit?.parts.find((p) => p.id === partId);
    const nextActionId = nextPart?.actions[0]?.id ?? null;
    onChange({ partId, actionId: nextActionId });
  }

  return (
    <div className="shmup-panel">
      {unit && unit.parts.length > 1 && (
        <label className="shmup-field shmup-field--inline">
          <span>Part</span>
          <select className="shmup-input" value={attack.partId} onChange={(e) => handlePartChange(e.target.value)}>
            {unit.parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="shmup-field shmup-field--inline">
        <span>Action</span>
        {part ? (
          part.actions.length > 0 ? (
            <select className="shmup-input" value={attack.actionId ?? ""} onChange={(e) => onChange({ actionId: e.target.value === "" ? null : e.target.value })}>
              <option value="">(none)</option>
              {part.actions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="shmup-error">(no Actions on this Part)</span>
          )
        ) : (
          <span className="shmup-error">(missing Part)</span>
        )}
      </label>

      <div className="shmup-dial-grid">
        <Dial label="Time (s)" value={attack.time} onChange={(v) => onChange({ time: Math.max(0, v) })} step={0.1} showNudgeButtons />
      </div>
      {duration && (
        <p className="shmup-readout">
          <span className="shmup-readout__label">Duration</span>
          <span className="shmup-readout__value">{duration}</span>
        </p>
      )}
    </div>
  );
}
