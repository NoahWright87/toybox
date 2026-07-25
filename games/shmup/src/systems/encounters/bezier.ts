/**
 * Cubic-bezier math for authored encounter movement — the runtime twin of
 * `src/experiences/ShmupEditor/bezier.ts`. Every segment between two steps
 * is a cubic bezier shaped by each step's optional `handleIn`/`handleOut`,
 * with a null handle defaulting to the straight-line-equivalent control
 * point (so an un-dragged path behaves exactly like a straight line) and
 * the owning Unit's `turnRate` capping how far a handle may extend.
 *
 * This has to match the editor's math *exactly* — the whole point of the
 * editor's timeline scrubber is that what it shows is what the game plays.
 * `bezier.test.ts` pins the specific behaviors (null-handle default,
 * turnRate clamping) that identity depends on. Re-declared rather than
 * imported for the same reason as `authoredTypes.ts`: no shared runtime
 * code between the two packages.
 */
import type { AuthoredStep, Vec2 } from "./authoredTypes";

/** Fraction of the segment length a null handle defaults to, evenly spacing P1/P2 along the straight line. */
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

export function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Clamps `offset` to at most `maxLength`, preserving direction. */
export function clampHandleOffset(offset: Vec2, maxLength: number): Vec2 {
  const len = Math.hypot(offset.x, offset.y);
  if (len <= maxLength || len < 1e-6) return offset;
  return scale(offset, maxLength / len);
}

/** Absolute position of `step`'s outgoing handle (P1 of the bezier toward `next`). */
export function resolveHandleOut(step: AuthoredStep, next: Vec2, turnRate: number): Vec2 {
  const maxLength = turnRate * distanceBetween(step.pos, next);
  const offset = step.handleOut ?? scale(sub(next, step.pos), DEFAULT_HANDLE_FRACTION);
  return add(step.pos, clampHandleOffset(offset, maxLength));
}

/** Absolute position of `step`'s incoming handle (P2 of the bezier arriving from `prev`). */
export function resolveHandleIn(step: AuthoredStep, prev: Vec2, turnRate: number): Vec2 {
  const maxLength = turnRate * distanceBetween(step.pos, prev);
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
export function resolveSegment(from: AuthoredStep, to: AuthoredStep, turnRate: number): BezierSegment {
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
