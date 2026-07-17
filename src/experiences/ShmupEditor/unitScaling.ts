/**
 * Per-instance scaling (E3 #193 — "Design Handoff v2" §4.2/§6, corrected
 * after an earlier, wrong pass built this as a standalone "spawn node"
 * concept living parallel to `EncounterUnit`; see git history). Scaling is
 * a **field on an already-placed `EncounterUnit` instance**
 * (`encounterTypes.ts`), not a new kind of thing with its own origin — you
 * place a Unit and author its behavior via the existing step/attack
 * timeline exactly as before, then optionally open its Scaling tab to
 * procedurally duplicate that exact instance. Every duplicate replays the
 * instance's **entire** step/attack sequence independently, anchored to
 * its own slot (convoy-style) — this file only computes *where* those
 * slots are and *how many* there are, not their behavior.
 *
 * **One scaling mechanism, not several** — per §6, condensed down from an
 * earlier draft that (wrongly) offered a `flat`/`linear`/`capped`/`stepped`
 * curve-type picker per spawn node. §4.2's recursive conserved-budget
 * model is the only algorithm: an incoming difficulty budget splits
 * between buying more *count* (gated by `minCostPerInstance` — the
 * self-limiting floor that prevents runaway counts without an artificial
 * cap) and more *power* per instance (`powerSplit`), governed by exactly
 * two authored numbers (`powerSplit`, `minCostPerInstance`) plus the
 * `[minCount, maxCount]` bounds — no per-param curve shape to pick.
 * `resolveScaling` below is deliberately the only entry point.
 *
 * **Positioning shape** (`ScalingShapeKind`) has real draggable canvas
 * handles (`EncounterEditor.tsx`), not number-only fields — per §6/§8.2,
 * every shape gets a handle set the same way a bezier step's handleIn/
 * handleOut do. Handle fields below are stored as **offsets from the
 * instance's own first-step position** (same convention as
 * `EncounterStep.handleIn`/`handleOut`), not absolute world positions —
 * this is what lets a fresh `createDefaultScaling()` produce sensible
 * handle defaults without knowing where the instance will end up placed.
 */
import type { Vec2 } from "./encounterTypes";

export type ScalingShapeKind = "curve" | "v" | "grid" | "ring";

export interface UnitScaling {
  /** Always the originally-placed instance itself — the floor a duplication count can't go below. */
  minCount: number;
  /** >1 is what enables the rest of this panel (shape/handles/ping-pong) — at 1 (the default), scaling is a no-op and the instance behaves exactly as before this feature existed. */
  maxCount: number;
  /** 0-100 — how much of the incoming budget buys more power per instance vs. more count. 0 = count only (a swarm); 100 = power only (bounded by maxCount, typically 1 for a miniboss that never duplicates). */
  powerSplit: number;
  /** The self-limiting floor (§4.2): once remaining count-budget can't afford one more instance at this cost, duplication stops — this is what prevents runaway counts without an artificial depth cap. Also a deliberate tuning lever: low = smooth frequent small steps (swarm feel), high = infrequent chunky jumps (boss "it just leveled up" feel). */
  minCostPerInstance: number;
  /** Time between successive instance spawns, ms — 0 = simultaneous, >0 = a staggered queue (shown as stacked nodes on the timeline). */
  spawnDelayMs: number;
  shape: ScalingShapeKind;
  /** curve: intermediate control points between the instance's own position (implicit start) and curveEnd, offsets from that position. Unifies straight line (empty), arc, and S-curve as one variable-handle-count primitive. */
  curvePoints: Vec2[];
  /** curve: the path's final position, offset from the instance's own position. */
  curveEnd: Vec2;
  /** v: the far tip, offset from the instance's own position (which is the V's point/apex). */
  vTip: Vec2;
  /** v: width of the V's open end, centered on the tip. */
  vWidth: number;
  /** grid: block/rank formation width, centered on the instance's own position. */
  gridWidth: number;
  /** grid: block/rank formation depth, centered on the instance's own position. */
  gridDepth: number;
  /** ring: center point, offset from the instance's own position — defaults to {0,0} (the instance's own position). */
  ringCenterOffset: Vec2;
  /** ring: radius, driven by a draggable handle at this distance from the center. */
  ringRadius: number;
  /** Mirrors the whole resolved slot set across an axis, spawning a second full set — defaults to the owning tile's own center axis, free with no extra authoring. */
  pingPong: boolean;
  /** Narrow override on top of the free ping-pong default (same "override whitelist" pattern as a step's speedMultiplier) — an explicit world-space X to mirror across instead of the tile's center. Only revealed/meaningful when pingPong is true. */
  pingPongOverride: number | null;
}

export function createDefaultScaling(): UnitScaling {
  return {
    minCount: 1,
    maxCount: 1,
    powerSplit: 0,
    minCostPerInstance: 1,
    spawnDelayMs: 0,
    shape: "curve",
    curvePoints: [],
    curveEnd: { x: 0, y: 150 },
    vTip: { x: 0, y: 150 },
    vWidth: 120,
    gridWidth: 160,
    gridDepth: 120,
    ringCenterOffset: { x: 0, y: 0 },
    ringRadius: 100,
    pingPong: false,
    pingPongOverride: null,
  };
}

export interface ScalingResolution {
  count: number;
  /** A representative preview multiplier only — not wired to any real Unit stat, same "no shared runtime yet to match" caveat WeaponPreview.tsx already documents for its own approximations. */
  powerMultiplier: number;
}

/**
 * The one scaling algorithm (§4.2): split the incoming budget between count
 * and power per `powerSplit`, resolve count via `minCostPerInstance`
 * (floored, clamped to [minCount, maxCount] — this is the self-limiting
 * mechanism, not an artificial cap), and represent whatever's left as a
 * flat per-instance power multiplier. Unspendable leftover from a failed
 * split (budget that can't afford one more whole instance) is simply
 * dropped, not folded into power — per §4.2, this preserves legible
 * thresholds ("suddenly there are more") rather than smoothing everything
 * into imperceptible continuous creep.
 */
export function resolveScaling(scaling: UnitScaling, budget: number): ScalingResolution {
  const countBudget = Math.max(0, budget) * (1 - scaling.powerSplit / 100);
  const affordable = scaling.minCostPerInstance > 0 ? Math.floor(countBudget / scaling.minCostPerInstance) : scaling.maxCount;
  const count = Math.min(scaling.maxCount, Math.max(scaling.minCount, affordable));
  const powerBudget = Math.max(0, budget) * (scaling.powerSplit / 100);
  const powerMultiplier = 1 + powerBudget / (scaling.minCostPerInstance * Math.max(count, 1));
  return { count, powerMultiplier };
}
