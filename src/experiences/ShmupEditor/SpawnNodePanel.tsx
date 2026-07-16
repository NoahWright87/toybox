import CurveField from "./CurveField";
import SpawnScalingPreview from "./SpawnScalingPreview";
import type { SpawnCountMode, SpawnDistribution, SpawnNodeDef, SpawnOrigin, SpawnOriginType, SpawnShapeKind } from "./spawnTypes";
import type { UnitDef } from "./unitTypes";

interface SpawnNodePanelProps {
  node: SpawnNodeDef;
  units: UnitDef[];
  onChange: (patch: Partial<SpawnNodeDef>) => void;
}

/**
 * Below-canvas settings for a selected spawn node (mirrors StepPanel.tsx/
 * AttackPanel.tsx's role) — everything about a spawn-node group *except*
 * its origin's world-space anchor, which is a canvas drag (EncounterEditor.tsx,
 * same ✥ move-handle pattern as a step). Origin *type* and its type-specific
 * fields (region size, shape kind/span) live here since they're plain
 * numbers/enums, not positions.
 */
export default function SpawnNodePanel({ node, units, onChange }: SpawnNodePanelProps) {
  const origin = node.origin;

  function updateOrigin(patch: Partial<SpawnOrigin>) {
    onChange({ origin: { ...origin, ...patch } });
  }

  return (
    <div className="shmup-panel">
      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Name</span>
          <input type="text" className="shmup-input" value={node.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Unit</span>
          {units.length > 0 ? (
            <select className="shmup-input" value={node.unitDefId ?? ""} onChange={(e) => onChange({ unitDefId: e.target.value === "" ? null : e.target.value })}>
              <option value="">(none)</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="shmup-error">(no Units in the library yet)</span>
          )}
        </label>
      </div>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Origin</span>
          <select className="shmup-input" value={origin.type} onChange={(e) => updateOrigin({ type: e.target.value as SpawnOriginType })}>
            <option value="point">Point</option>
            <option value="region">Region</option>
            <option value="shape">Shape</option>
          </select>
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Distribution</span>
          <select className="shmup-input" value={node.distribution} onChange={(e) => onChange({ distribution: e.target.value as SpawnDistribution })}>
            <option value="random">Random</option>
            <option value="ordered">Ordered</option>
          </select>
        </label>
      </div>
      <p className="shmup-hint">
        {origin.type === "point" && "A single fixed location — every individual emerges from the same spot, staggered only by timing below."}
        {origin.type === "region" && "A box; individuals scatter randomly within it."}
        {origin.type === "shape" && "A template (V/arc/line/grid) whose spacing derives from how many individuals fill it — count doesn't change the shape."}
      </p>

      {origin.type === "region" && (
        <div className="shmup-field-row">
          <label className="shmup-field shmup-field--inline">
            <span>Width</span>
            <input type="number" min={1} className="shmup-input shmup-input--small" value={origin.regionWidth} onChange={(e) => updateOrigin({ regionWidth: Number(e.target.value) })} />
          </label>
          <label className="shmup-field shmup-field--inline">
            <span>Height</span>
            <input type="number" min={1} className="shmup-input shmup-input--small" value={origin.regionHeight} onChange={(e) => updateOrigin({ regionHeight: Number(e.target.value) })} />
          </label>
        </div>
      )}

      {origin.type === "shape" && (
        <>
          <div className="shmup-field-row">
            <label className="shmup-field shmup-field--inline">
              <span>Shape</span>
              <select className="shmup-input" value={origin.shapeKind} onChange={(e) => updateOrigin({ shapeKind: e.target.value as SpawnShapeKind })}>
                <option value="v">V</option>
                <option value="arc">Arc</option>
                <option value="line">Line</option>
                <option value="grid">Grid</option>
              </select>
            </label>
          </div>
          <div className="shmup-field-row">
            <label className="shmup-field shmup-field--inline">
              <span>Span start (%)</span>
              <input type="number" min={0} max={100} className="shmup-input shmup-input--small" value={origin.spanStart} onChange={(e) => updateOrigin({ spanStart: Number(e.target.value) })} />
            </label>
            <label className="shmup-field shmup-field--inline">
              <span>Span end (%)</span>
              <input type="number" min={0} max={100} className="shmup-input shmup-input--small" value={origin.spanEnd} onChange={(e) => updateOrigin({ spanEnd: Number(e.target.value) })} />
            </label>
          </div>
        </>
      )}

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Direction (deg)</span>
          <input type="number" className="shmup-input shmup-input--small" value={node.direction} onChange={(e) => onChange({ direction: Number(e.target.value) })} />
        </label>
        <label className="shmup-checkbox">
          <input type="checkbox" checked={node.mirror} onChange={(e) => onChange({ mirror: e.target.checked })} />
          Mirror (a second copy reflected across the tile's center)
        </label>
      </div>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>First-spawn delay (ms)</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={node.delayMs} onChange={(e) => onChange({ delayMs: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Spawn interval (ms)</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={node.intervalMs} onChange={(e) => onChange({ intervalMs: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Count</span>
          <select className="shmup-input" value={node.countMode} onChange={(e) => onChange({ countMode: e.target.value as SpawnCountMode })}>
            <option value="fixed">Fixed</option>
            <option value="untilTileEnds">Until tile ends</option>
          </select>
        </label>
      </div>
      <p className="shmup-hint">0 interval = every individual spawns simultaneously; nonzero staggers them into a queue.</p>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Min count</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={node.minCount} onChange={(e) => onChange({ minCount: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Max count</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={node.maxCount} onChange={(e) => onChange({ maxCount: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Power split (%)</span>
          <input type="number" min={0} max={100} className="shmup-input shmup-input--small" value={node.powerSplit} onChange={(e) => onChange({ powerSplit: Number(e.target.value) })} />
        </label>
      </div>
      <p className="shmup-hint">
        0% power split spends all incoming budget on more count (a swarm); 100% with max count 1 spends it all on power instead (a miniboss that
        never duplicates).
      </p>

      <CurveField curve={node.countCurve} onChange={(countCurve) => onChange({ countCurve })} />
      <SpawnScalingPreview node={node} />
    </div>
  );
}
