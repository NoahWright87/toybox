import { Dial } from "../../components/Dial/Dial";
import type { EncounterStep } from "./encounterTypes";

interface StepPanelProps {
  step: EncounterStep;
  /** True when this step's `time` is computed from distance/speed rather than freely authored — see encounterTiming.ts. */
  timeDerived: boolean;
  /** True when a next step exists at a different position — i.e. this step's Speed Multiplier actually affects something (the segment leaving here). Distinct from timeDerived, which is about the segment *arriving* here. */
  hasOutgoingSegment: boolean;
  onChange: (patch: Partial<EncounterStep>) => void;
}

/**
 * Below-canvas settings for a selected step, rendered inside the Step tab
 * (EncounterEditor.tsx). A step is just a position + time + visibility +
 * bezier handles; movement itself (bezier handles) is edited on the
 * canvas, not here. Full behavior notes live in the Help menu, not inline
 * — see specs/shmup-editor.md's Encounter editor section for the rest.
 */
export default function StepPanel({ step, timeDerived, hasOutgoingSegment, onChange }: StepPanelProps) {
  const showSpeedOverride = hasOutgoingSegment;

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
        {showSpeedOverride && (
          <Dial label="Speed x" value={step.speedMultiplier} onChange={(v) => onChange({ speedMultiplier: Math.max(0, v) })} step={0.1} defaultValue={1} showNudgeButtons />
        )}
      </div>

      <label className="shmup-checkbox">
        <input type="checkbox" checked={step.visible} onChange={(e) => onChange({ visible: e.target.checked })} />
        Visible
      </label>
    </div>
  );
}
