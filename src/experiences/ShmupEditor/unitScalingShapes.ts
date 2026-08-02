/**
 * Pure geometry for a scaled instance's duplicate slot positions
 * (unitScaling.ts, E3 #193 — "Design Handoff v2" §6). Every duplicate
 * replays the instance's whole step/attack sequence anchored to one of
 * these slots — this file only computes *where*, not behavior.
 *
 * All handle fields on `UnitScaling` are offsets from the instance's own
 * position (`originPos` below), so these functions take that position as
 * an explicit parameter rather than baking it into the stored data — same
 * convention as `bezier.ts`'s `resolveHandleIn`/`resolveHandleOut`.
 */
import { distanceBetween } from "./bezier";
import type { Vec2 } from "./encounterTypes";
import type { UnitScaling } from "./unitScaling";

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Evenly-spaced parameters from -1 to 1, `count` of them — 0 (the center) for a lone individual. Mirrors spanPercents' role in the earlier (reverted) spawn-shape geometry. */
function symmetricParams(count: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => -1 + (2 * i) / (count - 1));
}

/** A point at `distance` along a polyline through `points`, measured from the first point. Clamps to the polyline's ends. */
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

function curveSlots(scaling: UnitScaling, originPos: Vec2, count: number): Vec2[] {
  const points = [originPos, ...scaling.curvePoints.map((p) => add(originPos, p)), add(originPos, scaling.curveEnd)];
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceBetween(points[i - 1], points[i]);
  if (count === 1) return [originPos];
  return Array.from({ length: count }, (_, i) => pointAlongPolyline(points, (total * i) / (count - 1)));
}

function vSlots(scaling: UnitScaling, originPos: Vec2, count: number): Vec2[] {
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

function gridSlots(scaling: UnitScaling, originPos: Vec2, count: number): Vec2[] {
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

function ringSlots(scaling: UnitScaling, originPos: Vec2, count: number): Vec2[] {
  const center = originPos;
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return { x: center.x + Math.cos(angle) * scaling.ringRadius, y: center.y + Math.sin(angle) * scaling.ringRadius };
  });
}

/** World-space slot positions for `count` duplicates of an instance anchored at `originPos` — count=1 always returns just `[originPos]` (the no-scaling base case) regardless of shape. */
export function resolveScalingSlots(scaling: UnitScaling, originPos: Vec2, count: number): Vec2[] {
  if (count <= 1) return [originPos];
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

/** Mirrors the resolved slot set across `pingPongOverride` (an explicit world-space X) or, by default, the owning tile's own center axis — appends a second full set, per §6's "free, no extra authoring" default. */
export function applyPingPong(positions: Vec2[], scaling: UnitScaling, tileWidthPx: number): Vec2[] {
  if (!scaling.pingPong) return positions;
  const axisX = scaling.pingPongOverride ?? tileWidthPx / 2;
  return [...positions, ...positions.map((p) => ({ x: 2 * axisX - p.x, y: p.y }))];
}
