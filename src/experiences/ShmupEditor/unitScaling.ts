/**
 * Per-instance scaling (E3 #193 — "Design Handoff v2" §4.2/§6, corrected
 * twice now; see git history for both prior passes). Scaling is a **field
 * on an already-placed `EncounterUnit` instance** (`encounterTypes.ts`),
 * not a new kind of thing with its own origin — you place a Unit and
 * author its behavior via the existing step/attack timeline exactly as
 * before, then optionally open its Scaling tab to procedurally duplicate
 * that exact instance. Every duplicate replays the instance's **entire**
 * step/attack sequence independently, anchored to its own slot
 * (convoy-style) — this file only computes *where* those slots are and
 * *how many* there are, not their behavior.
 *
 * **There is only one currency, Difficulty, at every level of the tree —
 * "power" is not a separate thing, it's just the Difficulty this instance
 * hands down to whatever it itself spawns.** A Level gives a Tile some
 * Difficulty; the Tile spreads it evenly across whatever it spawns; each
 * spawned instance resolves its own `count`/`power` from its own share and
 * passes `power` on down the same way (to its Weapons' spawned bullets,
 * and eventually — once that's designed — to its own stats). The editor
 * doesn't need to know what produces the incoming Difficulty value or what
 * `power` will eventually affect; it only needs this one resolution step.
 *
 * **`resolveScaling` — the whole algorithm, corrected from two earlier
 * (wrong) attempts:**
 * 1. A first pass split the incoming budget by a separate authored
 *    `powerSplit` percentage plus a `minCostPerInstance` floor — two
 *    knobs doing overlapping jobs, confusing in the UI, and mathematically
 *    broken: once `count` saturated at `maxCount`, any further Difficulty
 *    increase was simply discarded (routed to neither pool), so a maxed-out
 *    swarm became permanently unresponsive to difficulty past that point.
 * 2. The actual model has **one pool**, not two: `minCostPerInstance` only
 *    answers "how many of these can this budget afford, at minimum" — it
 *    is a minimum viable power *threshold*, not an amount that gets spent.
 *    Once `count` is known, the *entire* incoming Difficulty (not a
 *    leftover remainder) is redistributed evenly across it. `powerSplit`
 *    doesn't exist; the split falls out entirely from the relationship
 *    between `minCostPerInstance` and `maxCount`. There is no saturation
 *    bug: once `count` hits `maxCount`, `power` keeps rising with
 *    Difficulty forever (`D ÷ count` with `count` now fixed), nothing is
 *    ever discarded except the sub-1 remainder of the final division
 *    (floored, deliberately rounding in the player's favor).
 * 3. `count`'s true floor is **zero**, not one — an instance whose
 *    `minCostPerInstance` exceeds the incoming Difficulty simply doesn't
 *    spawn at all. This is a deliberate, useful property, not an edge case
 *    to guard against: an "elite" instance with a high cost naturally
 *    doesn't appear until Difficulty is high enough to afford it, with no
 *    separate difficulty-range-gating system needed for that case. The
 *    placed instance still exists as authored content either way — a
 *    resolved `count` of 0 just means nothing spawns from it *at this
 *    particular Difficulty*, which the Scaling panel's preview slider
 *    already surfaces directly (zero ghost dots).
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
  /** >1 is what enables the rest of this panel (shape/handles/ping-pong) — at 1 (the default), scaling is a no-op and the instance behaves exactly as before this feature existed. The floor is always 1 here (the instance you actually placed) — `resolveScaling`'s *resolved* count can still go to 0 at low Difficulty, that's a runtime/preview outcome, not an authoring bound. */
  maxCount: number;
  /** The minimum viable power (a share of Difficulty) one instance needs to justify existing at all — determines both whether this spawns (count is 0 below this) and, together with `maxCount`, how quickly count grows vs. how quickly power grows once count saturates. Low = cheap = swarms readily; high = expensive = rare/late-game/miniboss-leaning. */
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
    maxCount: 1,
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
  /** How many duplicates this instance resolves to at the given Difficulty — can be 0 (too little Difficulty to afford even one). */
  count: number;
  /** The Difficulty share each resulting instance passes down to whatever it itself spawns — the *entire* incoming Difficulty divided evenly across `count`, not a separate pool. 0 when `count` is 0 (nothing to pass anything to). */
  power: number;
}

/**
 * The one scaling algorithm — see file header for the two prior (wrong)
 * attempts this corrects. `count` is however many instances this budget
 * can afford at `minCostPerInstance` each, capped at `maxCount`; `power`
 * is the *entire* incoming Difficulty split evenly across however many
 * instances resulted, floored (rounds in the player's favor — an enemy is
 * never made stronger by a rounding artifact).
 */
export function resolveScaling(scaling: UnitScaling, difficulty: number): ScalingResolution {
  const d = Math.max(0, difficulty);
  const affordable = scaling.minCostPerInstance > 0 ? Math.floor(d / scaling.minCostPerInstance) : scaling.maxCount;
  const count = Math.min(scaling.maxCount, Math.max(0, affordable));
  const power = count > 0 ? Math.floor(d / count) : 0;
  return { count, power };
}
