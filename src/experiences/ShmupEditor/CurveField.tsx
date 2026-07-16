import type { CurveDef, CurveThreshold, CurveType } from "./difficultyCurve";

interface CurveFieldProps {
  curve: CurveDef;
  onChange: (curve: CurveDef) => void;
}

/**
 * Generic editor for one `CurveDef` (difficultyCurve.ts,
 * spawn-and-warnings.spec.todo.md §1) — deliberately not spawn-node
 * specific, even though `SpawnNodeDef.countCurve` (spawnTypes.ts) is the
 * only field that uses it today, so a future pass attaching curves to
 * Unit/Weapon numeric params (see shmup-editor.todo.md's Remaining list)
 * can reuse this component rather than inventing its own curve-editing UI.
 */
export default function CurveField({ curve, onChange }: CurveFieldProps) {
  function addThreshold() {
    const nextBudget = curve.thresholds.length > 0 ? Math.max(...curve.thresholds.map((t) => t.budget)) + 10 : 10;
    onChange({ ...curve, thresholds: [...curve.thresholds, { budget: nextBudget, value: curve.base }] });
  }
  function updateThreshold(index: number, patch: Partial<CurveThreshold>) {
    onChange({ ...curve, thresholds: curve.thresholds.map((t, i) => (i === index ? { ...t, ...patch } : t)) });
  }
  function removeThreshold(index: number) {
    onChange({ ...curve, thresholds: curve.thresholds.filter((_, i) => i !== index) });
  }

  return (
    <div className="shmup-curve-field">
      <label className="shmup-field shmup-field--inline">
        <span>Curve</span>
        <select className="shmup-input" value={curve.type} onChange={(e) => onChange({ ...curve, type: e.target.value as CurveType })}>
          <option value="flat">Flat (never scales)</option>
          <option value="linear">Linear</option>
          <option value="capped">Capped (linear, then flat)</option>
          <option value="stepped">Stepped (tiers)</option>
        </select>
      </label>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>{curve.type === "stepped" ? "Base (below first tier)" : "Base"}</span>
          <input type="number" className="shmup-input shmup-input--small" value={curve.base} onChange={(e) => onChange({ ...curve, base: Number(e.target.value) })} />
        </label>
        {(curve.type === "linear" || curve.type === "capped") && (
          <label className="shmup-field shmup-field--inline">
            <span>Rate</span>
            <input type="number" className="shmup-input shmup-input--small" value={curve.rate} onChange={(e) => onChange({ ...curve, rate: Number(e.target.value) })} />
          </label>
        )}
        {curve.type === "capped" && (
          <label className="shmup-field shmup-field--inline">
            <span>Cap</span>
            <input type="number" className="shmup-input shmup-input--small" value={curve.cap} onChange={(e) => onChange({ ...curve, cap: Number(e.target.value) })} />
          </label>
        )}
      </div>

      {curve.type === "stepped" && (
        <div className="shmup-curve-thresholds">
          {curve.thresholds.map((t, i) => (
            <div key={i} className="shmup-field-row">
              <label className="shmup-field shmup-field--inline">
                <span>At budget</span>
                <input type="number" className="shmup-input shmup-input--small" value={t.budget} onChange={(e) => updateThreshold(i, { budget: Number(e.target.value) })} />
              </label>
              <label className="shmup-field shmup-field--inline">
                <span>Value</span>
                <input type="number" className="shmup-input shmup-input--small" value={t.value} onChange={(e) => updateThreshold(i, { value: Number(e.target.value) })} />
              </label>
              <button type="button" className="shmup-btn shmup-btn--small" onClick={() => removeThreshold(i)}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="shmup-btn shmup-btn--small" onClick={addThreshold}>
            + Add tier
          </button>
        </div>
      )}
    </div>
  );
}
