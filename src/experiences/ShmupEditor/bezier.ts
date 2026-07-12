/**
 * Cubic bezier math for the Encounter editor's per-segment movement curves
 * (specs/shmup-editor.md's Timing section) — replaced the old per-Action
 * straightLine/wave/spiral movement kinds with a single curve model: every
 * segment between two steps is a cubic bezier, shaped by each step's
 * optional `handleIn`/`handleOut` (encounterTypes.ts), driven by the
 * owning Unit's `speed`/`turnRate` (unitTypes.ts) rather than anything
 * chosen per-Action. `encounterTiming.ts` uses this for arc-length-based
 * duration; `movementPreview.ts` uses it for position interpolation;
 * `EncounterEditor.tsx` uses it for rendering the curve and its draggable
 * handle dots.
 *
 * **A null handle defaults to the straight-line-equivalent position** — a
 * fresh step (or one whose handle was never dragged) renders and behaves
 * exactly like a straight line, so authoring a sequence without touching
 * handles at all matches the old straight-line behavior with zero extra
 * effort. Only once a handle is actually dragged does the segment curve.
 *
 * **`turnRate` caps how far a handle can extend, relative to the segment's
 * own straight-line length** — `turnRate: 1` allows a handle up to 100% of
 * the segment length (a fairly pronounced bend); a stiffer/slower-turning
 * Unit gets a lower `turnRate` and can only author gentler curves. This is
 * a purely geometric constraint, not a physics simulation — it's enforced
 * wherever a handle is *read* (`resolveHandleOut`/`resolveHandleIn`), not
 * just where it's written, so lowering a Unit's `turnRate` after curves
 * were authored at a higher one tightens every curve consistently rather
 * than leaving stale, now-invalid handle data lying around.
 */
import type { EncounterStep, Vec2 } from "./encounterTypes";

/** Fraction of the segment length a null handle defaults to, evenly spacing P1/P2 along the straight line — this is exactly what makes an un-dragged curve behave like a straight line. */
const DEFAULT_HANDLE_FRACTION = 1 / 3;

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}
function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function distanceBetween(a: Vec2, b: Vec2): number {
  return length(sub(a, b));
}

/** Clamps `offset` to at most `maxLength`, preserving its direction. */
export function clampHandleOffset(offset: Vec2, maxLength: number): Vec2 {
  const len = length(offset);
  if (len <= maxLength || len < 1e-6) return offset;
  return scale(offset, maxLength / len);
}

/** The resolved absolute position of `step`'s outgoing handle (P1 of the bezier toward `next`) — defaults to 1/3 of the way toward `next` when `handleOut` is null, clamped by `turnRate`. */
export function resolveHandleOut(step: EncounterStep, next: Vec2, turnRate: number): Vec2 {
  const segmentLength = distanceBetween(step.pos, next);
  const maxLength = turnRate * segmentLength;
  const offset = step.handleOut ?? scale(sub(next, step.pos), DEFAULT_HANDLE_FRACTION);
  return add(step.pos, clampHandleOffset(offset, maxLength));
}

/** The resolved absolute position of `step`'s incoming handle (P2 of the bezier arriving from `prev`) — defaults to 1/3 of the way back toward `prev` when `handleIn` is null, clamped by `turnRate`. */
export function resolveHandleIn(step: EncounterStep, prev: Vec2, turnRate: number): Vec2 {
  const segmentLength = distanceBetween(step.pos, prev);
  const maxLength = turnRate * segmentLength;
  const offset = step.handleIn ?? scale(sub(prev, step.pos), DEFAULT_HANDLE_FRACTION);
  return add(step.pos, clampHandleOffset(offset, maxLength));
}

export interface BezierSegment {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
}

/** The 4 control points of the cubic bezier from `from` to `to`, both ends resolved/clamped per the Unit's `turnRate`. */
export function resolveSegment(from: EncounterStep, to: EncounterStep, turnRate: number): BezierSegment {
  return {
    p0: from.pos,
    p1: resolveHandleOut(from, to.pos, turnRate),
    p2: resolveHandleIn(to, from.pos, turnRate),
    p3: to.pos,
  };
}

/** Position at parameter `u` (0 = start, 1 = end) along a cubic bezier. */
export function cubicBezierPoint(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, u: number): Vec2 {
  const mu = 1 - u;
  const a = mu * mu * mu;
  const b = 3 * mu * mu * u;
  const c = 3 * mu * u * u;
  const d = u * u * u;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** No closed-form solution for a general cubic bezier's arc length — approximated by sampling the curve as a polyline and summing segment lengths. 32 samples is plenty for a game-authoring tool's timing/rendering purposes, not a CAD-grade tolerance. */
const ARC_LENGTH_SAMPLES = 32;

export function cubicBezierLength(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, samples = ARC_LENGTH_SAMPLES): number {
  let total = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const point = cubicBezierPoint(p0, p1, p2, p3, i / samples);
    total += distanceBetween(prev, point);
    prev = point;
  }
  return total;
}
