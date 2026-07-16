import { useState } from "react";
import { resolvePowerMultiplier, resolveSpawnCount, type SpawnNodeDef } from "./spawnTypes";

interface SpawnScalingPreviewProps {
  node: SpawnNodeDef;
}

/** Preview-only budget range, 0-100 — this editor has no live `D`/difficulty-budget value to read (no shared runtime yet, same reasoning WeaponPreview.tsx documents for its own fixed-value approximations), so the slider is a stand-in for "however much budget this node ends up allocated" rather than a real game value. */
const PREVIEW_BUDGET_MAX = 100;

/**
 * Live "how does this actually scale" readout for a spawn node's
 * minCount/maxCount/powerSplit/countCurve (spawnTypes.ts) — same "a lot of
 * numbers, zero defaults, nothing visual" motivation that drove
 * WeaponPreview.tsx/PartPositionEditor.tsx in E2's visual authoring pass.
 * Ephemeral slider state only, not part of any saved draft — a viewing aid,
 * same as EncounterEditor.tsx's scrub/play state.
 */
export default function SpawnScalingPreview({ node }: SpawnScalingPreviewProps) {
  const [budget, setBudget] = useState(0);
  const count = resolveSpawnCount(node, budget);
  const powerMultiplier = resolvePowerMultiplier(node, budget);
  const maxBarCount = Math.max(node.maxCount, 1);

  return (
    <div className="shmup-spawn-scaling-preview">
      <label className="shmup-field shmup-field--inline">
        <span>Preview budget</span>
        <input type="range" min={0} max={PREVIEW_BUDGET_MAX} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
        <span className="shmup-spawn-scaling-preview__value">{budget}</span>
      </label>
      <div className="shmup-spawn-scaling-preview__bar" title={`${count} of up to ${node.maxCount}`}>
        {Array.from({ length: maxBarCount }, (_, i) => (
          <span key={i} className={`shmup-spawn-scaling-preview__dot ${i < count ? "shmup-spawn-scaling-preview__dot--filled" : ""}`} />
        ))}
      </div>
      <p className="shmup-hint">
        At this budget: <strong>{count}</strong> individual{count === 1 ? "" : "s"}, ~<strong>{powerMultiplier.toFixed(2)}x</strong> power
        (representative preview — not wired to any Unit stat yet, see shmup-editor.todo.md).
      </p>
    </div>
  );
}
