import { Dial } from "../../components/Dial/Dial";
import { resolveScaling, type ScalingShapeKind, type UnitScaling } from "./unitScaling";

interface UnitScalingPanelProps {
  scaling: UnitScaling;
  previewDifficulty: number;
  onPreviewDifficultyChange: (difficulty: number) => void;
  onChange: (patch: Partial<UnitScaling>) => void;
  onAddCurvePoint: () => void;
  onRemoveCurvePoint: (index: number) => void;
}

const PREVIEW_DIFFICULTY_MAX = 100;
/** maxCount's dial ceiling — generous for "how many duplicate enemies from one authored instance," distinct from the much larger bullet counts a Weapon can produce (that's a different scale entirely, see WeaponDef). */
const MAX_COUNT_CEILING = 30;

/**
 * Scaling tab for an already-placed `EncounterUnit` instance, rendered
 * inside EncounterEditor.tsx's Scaling tab. Positioning-shape *values*
 * live here; the shape's *handles* are canvas drag targets. Full behavior
 * notes live in the Help menu, not inline — see specs/shmup-editor.md's
 * Per-instance scaling section for the rest.
 */
export default function UnitScalingPanel({ scaling, previewDifficulty, onPreviewDifficultyChange, onChange, onAddCurvePoint, onRemoveCurvePoint }: UnitScalingPanelProps) {
  const scalingEnabled = scaling.maxCount > 1;
  const resolution = resolveScaling(scaling, previewDifficulty);

  return (
    <div className="shmup-panel">
      <div className="shmup-dial-grid">
        <Dial label="Max count" value={scaling.maxCount} onChange={(v) => onChange({ maxCount: v })} min={1} max={MAX_COUNT_CEILING} showNudgeButtons />
        {scalingEnabled && (
          <>
            <Dial label="Min cost" value={scaling.minCostPerInstance} onChange={(v) => onChange({ minCostPerInstance: Math.max(0.01, v) })} step={1} showNudgeButtons />
            <Dial label="Spawn delay (ms)" value={scaling.spawnDelayMs} onChange={(v) => onChange({ spawnDelayMs: Math.max(0, v) })} step={50} showNudgeButtons />
          </>
        )}
      </div>

      {scalingEnabled && (
        <>
          <label className="shmup-field shmup-field--inline">
            <span>Shape</span>
            <select className="shmup-input" value={scaling.shape} onChange={(e) => onChange({ shape: e.target.value as ScalingShapeKind })}>
              <option value="curve">Curve</option>
              <option value="v">V</option>
              <option value="grid">Grid</option>
              <option value="ring">Ring</option>
            </select>
          </label>

          {scaling.shape === "curve" && (
            <div className="shmup-field-row">
              <span>{scaling.curvePoints.length} point{scaling.curvePoints.length === 1 ? "" : "s"}</span>
              <button type="button" className="shmup-btn shmup-btn--small" onClick={onAddCurvePoint}>
                + Point
              </button>
              {scaling.curvePoints.length > 0 && (
                <button type="button" className="shmup-btn shmup-btn--small" onClick={() => onRemoveCurvePoint(scaling.curvePoints.length - 1)}>
                  − Point
                </button>
              )}
            </div>
          )}
          {scaling.shape === "v" && (
            <div className="shmup-dial-grid">
              <Dial label="Width" value={scaling.vWidth} onChange={(v) => onChange({ vWidth: Math.max(0, v) })} step={5} showNudgeButtons />
            </div>
          )}
          {scaling.shape === "grid" && (
            <div className="shmup-dial-grid">
              <Dial label="Width" value={scaling.gridWidth} onChange={(v) => onChange({ gridWidth: Math.max(0, v) })} step={5} showNudgeButtons />
              <Dial label="Depth" value={scaling.gridDepth} onChange={(v) => onChange({ gridDepth: Math.max(0, v) })} step={5} showNudgeButtons />
            </div>
          )}
          {scaling.shape === "ring" && (
            <div className="shmup-dial-grid">
              <Dial label="Radius" value={scaling.ringRadius} onChange={(v) => onChange({ ringRadius: Math.max(1, v) })} step={5} showNudgeButtons />
            </div>
          )}

          <label className="shmup-checkbox">
            <input type="checkbox" checked={scaling.pingPong} onChange={(e) => onChange({ pingPong: e.target.checked, pingPongOverride: e.target.checked ? scaling.pingPongOverride : null })} />
            Ping-pong mirror
          </label>

          <label className="shmup-field shmup-field--inline">
            <span>Preview Difficulty</span>
            <input type="range" min={0} max={PREVIEW_DIFFICULTY_MAX} value={previewDifficulty} onChange={(e) => onPreviewDifficultyChange(Number(e.target.value))} />
            <span className="shmup-spawn-scaling-preview__value">{previewDifficulty}</span>
          </label>
          <p className="shmup-readout">
            <strong>{resolution.count}</strong> instance{resolution.count === 1 ? "" : "s"} · <strong>{resolution.power}</strong> Difficulty each
          </p>
        </>
      )}
    </div>
  );
}
