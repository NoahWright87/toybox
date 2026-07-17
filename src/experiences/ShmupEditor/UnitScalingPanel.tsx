import { resolveScaling, type ScalingShapeKind, type UnitScaling } from "./unitScaling";

interface UnitScalingPanelProps {
  scaling: UnitScaling;
  previewBudget: number;
  onPreviewBudgetChange: (budget: number) => void;
  onChange: (patch: Partial<UnitScaling>) => void;
  onAddCurvePoint: () => void;
  onRemoveCurvePoint: (index: number) => void;
}

const PREVIEW_BUDGET_MAX = 100;

/**
 * "Design Handoff v2" §6 — a Scaling tab/section for an already-placed
 * `EncounterUnit` instance, separate from its step/attack authoring
 * (`StepPanel.tsx`/`AttackPanel.tsx`). Count range/power split/min cost
 * drive §4.2's single conserved-budget algorithm (`resolveScaling`,
 * unitScaling.ts) — no curve-type picker, condensed to one mechanism.
 * Positioning-shape *values* live here as editable number fields; the
 * shape's actual *handles* are canvas drag targets (EncounterEditor.tsx),
 * shown/hidden together with this panel per §8.2 ("appear contextually
 * only while editing the relevant... Action").
 */
export default function UnitScalingPanel({ scaling, previewBudget, onPreviewBudgetChange, onChange, onAddCurvePoint, onRemoveCurvePoint }: UnitScalingPanelProps) {
  const scalingEnabled = scaling.maxCount > 1;
  const resolution = resolveScaling(scaling, previewBudget);

  return (
    <div className="shmup-panel">
      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Min count</span>
          <input type="number" min={1} className="shmup-input shmup-input--small" value={scaling.minCount} onChange={(e) => onChange({ minCount: Math.max(1, Number(e.target.value)) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Max count</span>
          <input type="number" min={1} className="shmup-input shmup-input--small" value={scaling.maxCount} onChange={(e) => onChange({ maxCount: Math.max(1, Number(e.target.value)) })} />
        </label>
      </div>
      <p className="shmup-hint">Min is always the originally-placed instance itself. Raising max above 1 enables the rest of this panel.</p>

      {scalingEnabled && (
        <>
          <div className="shmup-field-row">
            <label className="shmup-field shmup-field--inline">
              <span>Power split (%)</span>
              <input type="number" min={0} max={100} className="shmup-input shmup-input--small" value={scaling.powerSplit} onChange={(e) => onChange({ powerSplit: Number(e.target.value) })} />
            </label>
            <label className="shmup-field shmup-field--inline">
              <span>Min cost / instance</span>
              <input
                type="number"
                min={0.01}
                step={0.1}
                className="shmup-input shmup-input--small"
                value={scaling.minCostPerInstance}
                onChange={(e) => onChange({ minCostPerInstance: Math.max(0.01, Number(e.target.value)) })}
              />
            </label>
            <label className="shmup-field shmup-field--inline">
              <span>Spawn delay (ms)</span>
              <input type="number" min={0} className="shmup-input shmup-input--small" value={scaling.spawnDelayMs} onChange={(e) => onChange({ spawnDelayMs: Number(e.target.value) })} />
            </label>
          </div>
          <p className="shmup-hint">
            0% power split spends the whole budget on more count (a swarm); 100% spends it all on power instead (bounded by max count — set max
            count to 1 for a miniboss that never duplicates). Min cost/instance is the self-limiting floor: once remaining budget can't afford
            one more, duplication stops — low = smooth frequent steps, high = infrequent chunky jumps.
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
            <span>Preview budget</span>
            <input type="range" min={0} max={PREVIEW_BUDGET_MAX} value={previewBudget} onChange={(e) => onPreviewBudgetChange(Number(e.target.value))} />
            <span className="shmup-spawn-scaling-preview__value">{previewBudget}</span>
          </label>
          <p className="shmup-hint">
            At this budget: <strong>{resolution.count}</strong> instance{resolution.count === 1 ? "" : "s"}, ~<strong>{resolution.powerMultiplier.toFixed(2)}x</strong> power
            (representative preview — not wired to any real stat yet).
          </p>
        </>
      )}
    </div>
  );
}
