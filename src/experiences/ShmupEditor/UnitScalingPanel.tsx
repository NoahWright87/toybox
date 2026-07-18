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
 * "Design Handoff v2" §6 — a Scaling tab/section for an already-placed
 * `EncounterUnit` instance, separate from its step/attack authoring
 * (`StepPanel.tsx`/`AttackPanel.tsx`). `maxCount`/`minCostPerInstance`
 * drive the single count/power algorithm (`resolveScaling`, unitScaling.ts)
 * — see that file's header for why there's no `powerSplit` or `minCount`
 * field anymore. Positioning-shape *values* live here as editable fields;
 * the shape's actual *handles* are canvas drag targets (EncounterEditor.tsx),
 * shown/hidden together with this panel per §8.2 ("appear contextually
 * only while editing the relevant... Action").
 */
export default function UnitScalingPanel({ scaling, previewDifficulty, onPreviewDifficultyChange, onChange, onAddCurvePoint, onRemoveCurvePoint }: UnitScalingPanelProps) {
  const scalingEnabled = scaling.maxCount > 1;
  const resolution = resolveScaling(scaling, previewDifficulty);

  return (
    <div className="shmup-panel">
      <div className="shmup-field-row">
        <Dial label="Max count" value={scaling.maxCount} onChange={(v) => onChange({ maxCount: v })} min={1} max={MAX_COUNT_CEILING} showNudgeButtons />
      </div>
      <p className="shmup-hint">The placed instance is always there at count 1. Raising this above 1 enables the rest of this panel.</p>

      {scalingEnabled && (
        <>
          <div className="shmup-field-row">
            <Dial label="Min cost / instance" value={scaling.minCostPerInstance} onChange={(v) => onChange({ minCostPerInstance: Math.max(0.01, v) })} step={1} showNudgeButtons />
            <label className="shmup-field shmup-field--inline">
              <span>Spawn delay (ms)</span>
              <input type="number" min={0} className="shmup-input shmup-input--small" value={scaling.spawnDelayMs} onChange={(e) => onChange({ spawnDelayMs: Number(e.target.value) })} />
            </label>
          </div>
          <p className="shmup-hint">
            The incoming Difficulty value is split evenly across however many instances it can afford at this cost each (capped at max count) —
            not spent separately. Low cost affords more instances quickly (a swarm); high cost affords fewer, but each gets a bigger share of
            Difficulty (passed down to whatever it spawns) once it can afford to exist at all — below this cost, it simply doesn't spawn yet.
          </p>

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
              <span className="shmup-hint">{scaling.curvePoints.length} intermediate point{scaling.curvePoints.length === 1 ? "" : "s"} (drag ◇ handles on canvas)</span>
              <button type="button" className="shmup-btn shmup-btn--small" onClick={onAddCurvePoint}>
                + Add point
              </button>
              {scaling.curvePoints.length > 0 && (
                <button type="button" className="shmup-btn shmup-btn--small" onClick={() => onRemoveCurvePoint(scaling.curvePoints.length - 1)}>
                  Remove last
                </button>
              )}
            </div>
          )}
          {scaling.shape === "v" && (
            <label className="shmup-field shmup-field--inline">
              <span>Width at tip</span>
              <input type="number" min={0} className="shmup-input shmup-input--small" value={scaling.vWidth} onChange={(e) => onChange({ vWidth: Number(e.target.value) })} />
            </label>
          )}
          {scaling.shape === "grid" && (
            <div className="shmup-field-row">
              <label className="shmup-field shmup-field--inline">
                <span>Width</span>
                <input type="number" min={0} className="shmup-input shmup-input--small" value={scaling.gridWidth} onChange={(e) => onChange({ gridWidth: Number(e.target.value) })} />
              </label>
              <label className="shmup-field shmup-field--inline">
                <span>Depth</span>
                <input type="number" min={0} className="shmup-input shmup-input--small" value={scaling.gridDepth} onChange={(e) => onChange({ gridDepth: Number(e.target.value) })} />
              </label>
            </div>
          )}
          {scaling.shape === "ring" && (
            <label className="shmup-field shmup-field--inline">
              <span>Radius</span>
              <input type="number" min={1} className="shmup-input shmup-input--small" value={scaling.ringRadius} onChange={(e) => onChange({ ringRadius: Number(e.target.value) })} />
            </label>
          )}
          <p className="shmup-hint">All shapes place slots, not final destinations — each duplicate replays this instance's entire step/attack sequence independently, anchored to its own slot.</p>

          <label className="shmup-checkbox">
            <input type="checkbox" checked={scaling.pingPong} onChange={(e) => onChange({ pingPong: e.target.checked, pingPongOverride: e.target.checked ? scaling.pingPongOverride : null })} />
            Ping-pong (mirror across the tile's center — free, drag the ⟷ handle on canvas for an asymmetric override)
          </label>

          <label className="shmup-field shmup-field--inline">
            <span>Preview Difficulty</span>
            <input type="range" min={0} max={PREVIEW_DIFFICULTY_MAX} value={previewDifficulty} onChange={(e) => onPreviewDifficultyChange(Number(e.target.value))} />
            <span className="shmup-spawn-scaling-preview__value">{previewDifficulty}</span>
          </label>
          <p className="shmup-hint">
            At this Difficulty: <strong>{resolution.count}</strong> instance{resolution.count === 1 ? "" : "s"}, <strong>{resolution.power}</strong>{" "}
            Difficulty passed to whatever each one spawns (not wired to any real stat yet).
          </p>
        </>
      )}
    </div>
  );
}
