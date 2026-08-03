/**
 * The synthetic demo circuit the Unit editor's Stats tab flies a Unit
 * around (`UnitMovementPreview.tsx`), so `speed` and `turnRate` are
 * something you can *watch* rather than two bare numbers. Same reasoning as
 * `actionPreview.ts` vs. an attack's arc/count/spacing fields: this genre
 * is visual, and a knob you can't see the effect of is a knob you tune by
 * guessing.
 *
 * **The circuit is a fixed diamond, not an authored path** — there's no
 * encounter in scope while editing a Unit, so the preview supplies its own
 * closed loop (roughly a third of a tile across, `editorScale.ts`'s
 * `TILE_UNIT` = 720) and the Unit laps it forever. Only the *shape of the
 * corners* and *how fast it travels* come from the Unit.
 *
 * **Both stats mean exactly what they mean in a real encounter.**
 * - `speed` is px/sec along the curve, and a segment is paced by its own
 *   arc length ÷ speed — the identical model `encounterTiming.ts` uses to
 *   derive a real step's duration and `movementPreview.ts` uses to
 *   interpolate along it.
 * - `turnRate` clamps each bezier handle to a multiple of its segment's
 *   straight-line length, via `bezier.ts`'s own `clampHandleOffset` — the
 *   one place that rule lives, so the preview can't drift from what the
 *   encounter canvas actually draws.
 *
 * The one thing the demo *adds* is deliberately over-long handles
 * (`DEMO_HANDLE_REACH` × the segment length, pointed along the loop's
 * tangent at each waypoint). A real step's handles default to the
 * straight-line-equivalent position, which no `turnRate` above 1/3 ever
 * clamps — so a demo built on defaults would sit stone-still while the knob
 * turned. Authoring handles past every plausible `turnRate` instead means
 * the clamp is always the thing deciding the shape: 0 draws the bare
 * sharp-cornered diamond, and higher values bend the corners out into
 * progressively wider, swoopier arcs.
 */
import { clampHandleOffset, cubicBezierLength, cubicBezierPoint, distanceBetween } from "./bezier";
import type { Vec2 } from "./encounterTypes";

/** Half-width of the demo diamond, in the same world units as an encounter canvas (TILE_UNIT = 720 across). */
export const DEMO_LOOP_RADIUS = 70;

/** Authored handle length as a multiple of the segment's straight-line length — past the largest `turnRate` any seeded Unit uses (1.5), so the knob keeps visibly doing something across its whole useful range. */
export const DEMO_HANDLE_REACH = 2;

/** Corners of the demo circuit, clockwise from the top. A diamond (rather than a ring of many points) because four hard corners are where a turn-rate difference reads most clearly. */
export const DEMO_WAYPOINTS: Vec2[] = [
  { x: 0, y: -DEMO_LOOP_RADIUS },
  { x: DEMO_LOOP_RADIUS, y: 0 },
  { x: 0, y: DEMO_LOOP_RADIUS },
  { x: -DEMO_LOOP_RADIUS, y: 0 },
];

export interface DemoSegment {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
  /** Arc length of this segment — what paces travel along it (length ÷ speed), exactly as `encounterTiming.ts` times a real one. */
  length: number;
}

/** Heading (degrees, 0 = +x/right, 90 = +y/down) used when the circuit has no length to derive one from — same convention and same "there's no principled direction here" stance as `movementPreview.ts`'s own stationary fallback. */
const FALLBACK_HEADING_DEG = 90;

/** Distance (world units) used to numerically differentiate the loop for its heading — small relative to the circuit, large enough to stay clear of floating-point noise. Mirrors `movementPreview.ts`'s HEADING_EPSILON_SEC in spirit. */
const HEADING_EPSILON_UNITS = 0.5;

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-6 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

/** Direction the loop is travelling *through* waypoint `i` — the chord between its two neighbours, which is what makes a handle laid along it bend the path rather than just stretch a straight line. */
function tangentAt(i: number): Vec2 {
  const count = DEMO_WAYPOINTS.length;
  const prev = DEMO_WAYPOINTS[(i - 1 + count) % count];
  const next = DEMO_WAYPOINTS[(i + 1) % count];
  return normalize(sub(next, prev));
}

/** The demo circuit's four bezier segments at a given `turnRate` — see the file header for why the handles are authored long and left to the clamp. */
export function demoLoopSegments(turnRate: number): DemoSegment[] {
  const count = DEMO_WAYPOINTS.length;
  const segments: DemoSegment[] = [];
  for (let i = 0; i < count; i++) {
    const from = DEMO_WAYPOINTS[i];
    const to = DEMO_WAYPOINTS[(i + 1) % count];
    const segmentLength = distanceBetween(from, to);
    const maxLength = Math.max(0, turnRate) * segmentLength;
    const reach = DEMO_HANDLE_REACH * segmentLength;
    const out = clampHandleOffset(scale(tangentAt(i), reach), maxLength);
    const back = clampHandleOffset(scale(tangentAt((i + 1) % count), -reach), maxLength);
    const p0 = from;
    const p1 = { x: from.x + out.x, y: from.y + out.y };
    const p2 = { x: to.x + back.x, y: to.y + back.y };
    const p3 = to;
    segments.push({ p0, p1, p2, p3, length: cubicBezierLength(p0, p1, p2, p3) });
  }
  return segments;
}

export function loopLength(segments: DemoSegment[]): number {
  return segments.reduce((total, s) => total + s.length, 0);
}

export interface LoopSample {
  pos: Vec2;
  headingDeg: number;
}

/** Position along the circuit at `distance` world units travelled, wrapping around the loop as many times as needed (negative distances wrap backwards). Within a segment, distance maps linearly onto the bezier parameter — the same approximation `movementPreview.ts` makes for a real step, so a lap here is paced exactly the way an encounter's path is. */
export function positionAt(segments: DemoSegment[], distance: number): Vec2 {
  const total = loopLength(segments);
  if (total <= 0) return DEMO_WAYPOINTS[0];
  let remaining = ((distance % total) + total) % total;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // The last segment absorbs any leftover from floating-point drift rather than falling off the end of the list.
    if (remaining > segment.length && i < segments.length - 1) {
      remaining -= segment.length;
      continue;
    }
    const u = segment.length > 0 ? Math.min(1, Math.max(0, remaining / segment.length)) : 0;
    return cubicBezierPoint(segment.p0, segment.p1, segment.p2, segment.p3, u);
  }
  return DEMO_WAYPOINTS[0];
}

/** Position *and* direction of travel at `distance`, the direction numerically differentiated from the same curve — a Unit in the preview always points where it's going (the `faceMovement` case), since that's what makes a turn read as a turn. */
export function sampleLoop(segments: DemoSegment[], distance: number): LoopSample {
  const pos = positionAt(segments, distance);
  const ahead = positionAt(segments, distance + HEADING_EPSILON_UNITS);
  const dx = ahead.x - pos.x;
  const dy = ahead.y - pos.y;
  if (Math.hypot(dx, dy) < 1e-6) return { pos, headingDeg: FALLBACK_HEADING_DEG };
  return { pos, headingDeg: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** Seconds for one full lap at `speed` px/sec, or null when the Unit can't move at all (speed 0 — it just holds position, which is a legitimate authoring choice for a turret). */
export function lapSeconds(segments: DemoSegment[], speed: number): number | null {
  if (speed <= 0) return null;
  return loopLength(segments) / speed;
}
