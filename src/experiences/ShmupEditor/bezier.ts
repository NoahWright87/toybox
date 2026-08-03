/**
 * Cubic bezier primitives for the Encounter editor's movement curves
 * (specs/shmup-editor.md's Timing section) — every segment between two
 * steps is a cubic bezier, shaped by each step's optional `handleIn`/
 * `handleOut` (encounterTypes.ts). `encounterTiming.ts` uses this for
 * arc-length-based duration; `movementPreview.ts` for position
 * interpolation; `EncounterEditor.tsx` for rendering the curve and its
 * draggable handle dots.
 *
 * **Where the control points come from is `pathSolver.ts`'s job, not this
 * file's.** This module used to own that too, via a `resolveSegment(from,
 * to, turnRate)` that placed each handle and clamped it to `turnRate ×` the
 * segment's straight-line length. That clamp is gone with the stat it was
 * named for (see `turning.ts`): it could only ever shorten a handle, which
 * on the default colinear handle changes nothing at all, and it had no way
 * to reach the *junction between* two segments — where the actual turn
 * happens. Handle placement now needs to see a waypoint's neighbours on
 * both sides, so it moved up a level to a whole-path solve.
 *
 * What stays here is the math with no opinions: evaluate a cubic, measure
 * its arc length, and measure its tightest bend (`minCurveRadius`) so the
 * solver can tell whether a Unit could physically fly it.
 */
import type { Vec2 } from "./encounterTypes";

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function distanceBetween(a: Vec2, b: Vec2): number {
  return length(sub(a, b));
}

export interface BezierSegment {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
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

/** First derivative (velocity) of the cubic at `u` — the curve's tangent direction, and half of what `minCurveRadius` needs. */
export function cubicBezierDerivative(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, u: number): Vec2 {
  const mu = 1 - u;
  return {
    x: 3 * mu * mu * (p1.x - p0.x) + 6 * mu * u * (p2.x - p1.x) + 3 * u * u * (p3.x - p2.x),
    y: 3 * mu * mu * (p1.y - p0.y) + 6 * mu * u * (p2.y - p1.y) + 3 * u * u * (p3.y - p2.y),
  };
}

/** Second derivative of the cubic at `u`. */
export function cubicBezierSecondDerivative(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, u: number): Vec2 {
  const mu = 1 - u;
  return {
    x: 6 * mu * (p2.x - 2 * p1.x + p0.x) + 6 * u * (p3.x - 2 * p2.x + p1.x),
    y: 6 * mu * (p2.y - 2 * p1.y + p0.y) + 6 * u * (p3.y - 2 * p2.y + p1.y),
  };
}

/** Samples used when scanning a segment for its tightest bend. Coarser than a CAD tolerance on purpose — this runs inside a pointermove handler while a handle is being dragged. */
const CURVATURE_SAMPLES = 48;

/**
 * The **tightest** radius of curvature anywhere along the segment, world
 * units — `Infinity` for a straight line. This is the number a Unit's
 * `minTurnRadius` (`turning.ts`) is checked against: a segment is flyable
 * exactly when this is at least that radius.
 *
 * Sampled rather than solved. A cubic's curvature extremum has a closed
 * form only via the roots of a quartic, and the failure mode of sampling
 * (missing a spike narrower than 1/48 of the curve) is far gentler than
 * the failure mode of a numerically fragile root solve.
 */
export function minCurveRadius(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, samples = CURVATURE_SAMPLES): number {
  let tightest = Infinity;
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const d1 = cubicBezierDerivative(p0, p1, p2, p3, u);
    const d2 = cubicBezierSecondDerivative(p0, p1, p2, p3, u);
    const speed = length(d1);
    if (speed < 1e-6) continue; // a cusp/stationary point carries no meaningful curvature reading
    const curvature = Math.abs(d1.x * d2.y - d1.y * d2.x) / (speed * speed * speed);
    if (curvature > 1e-9) tightest = Math.min(tightest, 1 / curvature);
  }
  return tightest;
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
