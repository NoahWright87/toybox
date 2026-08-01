/**
 * Per-instance procedural duplication — the runtime twin of the editor's
 * `unitScaling.ts` + `unitScalingShapes.ts` (E3 #193).
 *
 * There is **one currency, Difficulty, at every level of the tree.** A
 * level hands a tile some Difficulty; the tile spreads it across what it
 * spawns; each placed instance resolves its own `count` and `power` from
 * its share and passes `power` down to whatever *it* spawns. `power` isn't
 * a second pool — it's just the Difficulty this instance hands onward.
 *
 * `resolveScaling` is the whole algorithm, and its two sharp edges are
 * load-bearing rather than accidental:
 * - **`count`'s floor is zero, not one.** An instance whose
 *   `minCostPerInstance` exceeds the incoming Difficulty simply doesn't
 *   spawn — that's how an "elite" placement gates itself out of low-D runs
 *   with no separate difficulty-range system. It also means a playtest at
 *   Difficulty 0 spawns *nothing at all*, which is why the encounter picker
 *   defaults to a non-zero Difficulty.
 * - **Once `count` saturates at `maxCount`, `power` keeps rising forever**
 *   (`D / count` with `count` now fixed). Nothing is discarded but the
 *   sub-1 remainder of the final division, floored in the player's favor.
 *
 * Every duplicate replays the instance's entire step/Part-action sequence
 * independently, anchored to its own slot (convoy-style). This file only
 * computes *where* those slots are and *how many* there are.
 */
import { distanceBetween } from "./bezier";
import type { AuthoredScaling, Vec2 } from "./authoredTypes";

export interface ScalingResolution {
  /** How many duplicates this instance resolves to — can be 0. */
  count: number;
  /** The Difficulty share each resulting instance passes down to whatever it spawns. 0 when `count` is 0. */
  power: number;
}

export function resolveScaling(scaling: AuthoredScaling, difficulty: number): ScalingResolution {
  const d = Math.max(0, difficulty);
  const affordable = scaling.minCostPerInstance > 0 ? Math.floor(d / scaling.minCostPerInstance) : scaling.maxCount;
  const count = Math.min(scaling.maxCount, Math.max(0, affordable));
  const power = count > 0 ? Math.floor(d / count) : 0;
  return { count, power };
}

/** Seconds each duplicate slot's own local clock trails slot 0 by. */
export function spawnDelayOffsetsSec(scaling: Pick<AuthoredScaling, "spawnDelayMs">, count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => (i * scaling.spawnDelayMs) / 1000);
}

// ── Slot geometry ──────────────────────────────────────────────────────────

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Evenly-spaced parameters from -1 to 1, `count` of them — 0 (the center) for a lone individual. */
function symmetricParams(count: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => -1 + (2 * i) / (count - 1));
}

/** A point at `distance` along a polyline through `points`, measured from the first. Clamps to the ends. */
function pointAlongPolyline(points: Vec2[], distance: number): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || distance <= 0) return points[0];
  let remaining = distance;
  for (let i = 1; i < points.length; i++) {
    const segLength = distanceBetween(points[i - 1], points[i]);
    if (remaining <= segLength) return lerp(points[i - 1], points[i], segLength > 0 ? remaining / segLength : 0);
    remaining -= segLength;
  }
  return points[points.length - 1];
}

function curveSlots(scaling: AuthoredScaling, originPos: Vec2, count: number): Vec2[] {
  const points = [originPos, ...scaling.curvePoints.map((p) => add(originPos, p)), add(originPos, scaling.curveEnd)];
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceBetween(points[i - 1], points[i]);
  return Array.from({ length: count }, (_, i) => pointAlongPolyline(points, (total * i) / (count - 1)));
}

function vSlots(scaling: AuthoredScaling, originPos: Vec2, count: number): Vec2[] {
  const apex = originPos;
  const tip = add(originPos, scaling.vTip);
  const dir = sub(tip, apex);
  const dirLen = distanceBetween(apex, tip) || 1;
  const perp: Vec2 = { x: -dir.y / dirLen, y: dir.x / dirLen };
  const half = scaling.vWidth / 2;
  const leftEnd = sub(tip, { x: perp.x * half, y: perp.y * half });
  const rightEnd = add(tip, { x: perp.x * half, y: perp.y * half });
  return symmetricParams(count).map((t) => (t < 0 ? lerp(apex, leftEnd, -t) : lerp(apex, rightEnd, t)));
}

function gridSlots(scaling: AuthoredScaling, originPos: Vec2, count: number): Vec2[] {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const colFrac = cols > 1 ? col / (cols - 1) : 0.5;
    const rowFrac = rows > 1 ? row / (rows - 1) : 0.5;
    return { x: originPos.x + (colFrac - 0.5) * scaling.gridWidth, y: originPos.y + (rowFrac - 0.5) * scaling.gridDepth };
  });
}

function ringSlots(scaling: AuthoredScaling, originPos: Vec2, count: number): Vec2[] {
  const center = originPos; // always the instance's own position
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return { x: center.x + Math.cos(angle) * scaling.ringRadius, y: center.y + Math.sin(angle) * scaling.ringRadius };
  });
}

/** Slot positions for `count` duplicates anchored at `originPos` (the instance's own first-step position). `count <= 1` is always just the origin, whatever the shape. */
export function resolveScalingSlots(scaling: AuthoredScaling, originPos: Vec2, count: number): Vec2[] {
  if (count <= 1) return count <= 0 ? [] : [originPos];
  switch (scaling.shape) {
    case "curve":
      return curveSlots(scaling, originPos, count);
    case "v":
      return vSlots(scaling, originPos, count);
    case "grid":
      return gridSlots(scaling, originPos, count);
    case "ring":
      return ringSlots(scaling, originPos, count);
    default:
      return Array.from({ length: count }, () => originPos);
  }
}

/** Mirrors the resolved slot set across `pingPongOverride` (an explicit tile-local X) or, by default, the tile's own center axis — appending a second full set. */
export function applyPingPong(positions: Vec2[], scaling: AuthoredScaling, tileWidthPx: number): Vec2[] {
  if (!scaling.pingPong) return positions;
  const axisX = scaling.pingPongOverride ?? tileWidthPx / 2;
  return [...positions, ...positions.map((p) => ({ x: 2 * axisX - p.x, y: p.y }))];
}
