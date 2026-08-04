/**
 * Turns a list of authored waypoints into a path the Unit can physically
 * fly, given its `minSpeed`/`turnRateDegPerSec` (`turning.ts`).
 *
 * **Waypoints are hard constraints; the shape between them is derived.**
 * A Unit passes through every authored waypoint; how it gets between them
 * is derived from what it can physically fly. The editor never rejects a
 * placement — it solves for the closest flyable path, draws it, and times
 * it — so the runtime's job is simply to reproduce that same solve.
 *
 * ## Two policies, chosen by whether the Unit can stop
 *
 * - **Pivot units (`minSpeed === 0`, radius 0).** Legs stay straight and
 *   the Unit turns on the spot at each corner, paying `pivotSeconds` of
 *   standing still. A tank drives in lines and rotates; nothing about its
 *   route is impossible, it just costs time.
 * - **Arc units (`minSpeed > 0`).** The path is made tangent-continuous
 *   and bent to respect `minTurnRadius` everywhere. There is no corner to
 *   round off, because a corner never gets built: the tangent through a
 *   waypoint is shared by the segments either side of it.
 *
 * ## How an arc path is solved
 *
 * 1. **Tangent direction per waypoint** — chordal Catmull-Rom
 *    (`normalize(next - prev)`), the standard smooth-through-points
 *    choice. This alone solves the 90° corner above: the jet arrives at
 *    the corner already heading 45°, so it dips wide *before* the
 *    waypoint and bulges wide *after* it instead of turning in place.
 *    An author-dragged handle overrides the direction for its waypoint.
 * 2. **Handle length** — starts at a third of the chord (which reproduces
 *    a straight line when the tangents are chord-aligned, so an
 *    unremarkable path looks exactly like it always did) and is searched
 *    over a range, taking the value **closest to the default** that keeps
 *    the whole segment at or above `minTurnRadius`. Longer handles spread
 *    a turn over more distance; too long folds the curve into a loop,
 *    which is tighter again, so nearest-to-default is the right tie-break
 *    rather than largest-or-smallest.
 * 3. **Tangent relaxation, only if that fails** — rotate the offending
 *    waypoints' tangents by the *smallest* deviation that makes their
 *    segments flyable. Kept off the happy path deliberately: it's the
 *    expensive step, and a solution found by step 2 is the one the author
 *    will find least surprising.
 * 4. **Best effort** — if the geometry is genuinely impossible (waypoints
 *    60 units apart with a 90° turn and a 89-unit minimum radius), the
 *    solve keeps whatever came closest and reports `feasible: false`. The
 *    path still exists and is still drawn; nothing is rejected.
 *
 * Solves are memoized (`solvePathCached`): the runtime asks for an
 * instance's path on every frame of its life, and re-searching curvature
 * samples 60 times a second for a path that never changes would be pure
 * waste.
 *
 * **The runtime twin of `src/experiences/ShmupEditor/pathSolver.ts`** —
 * re-declared rather than imported (no shared runtime code between the two
 * packages), and required to stay byte-for-byte equivalent in behavior:
 * the editor draws and times this exact path, so any divergence here is
 * the game playing something other than what was authored.
 */
import { cubicBezierLength, minCurveRadius, type BezierSegment } from "./bezier";
import { minTurnRadius, pivotSeconds, signedAngleDelta } from "./turning";
import type { Vec2 } from "./authoredTypes";

/** Structurally satisfied by `AuthoredStep` — the solver only needs position plus the optional hand-dragged handles. */
export interface PathPoint {
  pos: Vec2;
  handleIn?: Vec2 | null;
  handleOut?: Vec2 | null;
}

export interface MotionLimits {
  /** `turning.ts`'s `minTurnRadius` — 0 means "pivots in place, no corner is too sharp". */
  minTurnRadius: number;
  turnRateDegPerSec: number;
}

/** The turning limits a Unit imposes on any path it's placed on. Structurally typed rather than taking `UnitDef`, so this module stays free of the editor's own data model (it's mirrored into the game). */
export function limitsFor(unit: { minSpeed: number; speed: number; turnRateDegPerSec: number }): MotionLimits {
  return {
    // A Unit whose top speed is 0 never travels at all, so its "minimum sustained speed" is moot — treat it as a pivoter rather than handing the solver a turning circle it can't use.
    minTurnRadius: unit.speed <= 0 ? 0 : minTurnRadius(Math.min(unit.minSpeed, unit.speed), unit.turnRateDegPerSec),
    turnRateDegPerSec: unit.turnRateDegPerSec,
  };
}

export interface SolvedSegment extends BezierSegment {
  /** Arc length, world units — what `encounterTiming.ts` divides by speed. */
  length: number;
  /** Tightest radius anywhere along this segment. */
  minRadius: number;
  /** Whether that tightest radius clears the Unit's `minTurnRadius`. */
  feasible: boolean;
}

export interface SolvedPath {
  /** One per consecutive pair of waypoints; empty for a single-waypoint path. */
  segments: SolvedSegment[];
  /** Heading (deg) the Unit holds arriving at each waypoint. Index 0 mirrors its outgoing tangent (nothing arrives at the first one). */
  headingInDeg: number[];
  /** Heading (deg) the Unit holds leaving each waypoint. The last mirrors its incoming tangent. */
  headingOutDeg: number[];
  /** Seconds spent stationary rotating at each waypoint — always 0 for an arc Unit, whose tangents are continuous by construction. */
  pivotSec: number[];
  /** False when some segment couldn't be solved within the Unit's turning limits — informational, never a blocker. */
  feasible: boolean;
}

/** Fraction of the chord a handle defaults to — the value that makes chord-aligned tangents draw an exactly straight line. */
const DEFAULT_HANDLE_FRACTION = 1 / 3;

/** Handle-length multipliers tried when a segment is too tight, ordered by how far they stray from the default so the first feasible hit is also the least surprising. */
const SCALE_CANDIDATES = [1, 1.2, 0.8, 1.5, 0.6, 1.9, 2.4, 0.45, 3, 3.8, 4.6];

/** Tangent rotations (degrees, each tried both ways) during relaxation, smallest deviation first. */
const RELAX_STEPS_DEG = [5, 10, 18, 28, 40, 55, 75, 95, 120, 150, 180];

/** Rounds of the relaxation sweep. Two is enough for a waypoint's fix to propagate to its neighbours and settle; more just costs time on paths that are impossible anyway. */
const RELAX_ROUNDS = 2;

/** Two waypoints closer than this count as the same place — a dwell, with no direction of travel to derive. */
const POSITION_EPSILON = 0.5;

/**
 * A closed path wraps: its last waypoint connects back to its first, and
 * every waypoint (including those two) takes its tangent from its
 * neighbours *around* the loop. Encounter paths are always open — a Unit
 * flies in, flies out. This exists for `UnitMovementPreview.tsx`'s demo
 * circuit, which has to lap forever without a seam where the heading jumps.
 */
export interface PathOptions {
  closed?: boolean;
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
function len(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}
function dirDeg(v: Vec2): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}
function fromDeg(deg: number, length: number): Vec2 {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * length, y: Math.sin(rad) * length };
}

/** The author's dragged direction for a waypoint, if any — `handleOut` wins, else `handleIn` reversed (it points back toward the previous waypoint). Null when neither was dragged or the drag is degenerate. */
function overrideDirDeg(point: PathPoint): number | null {
  if (point.handleOut && len(point.handleOut) > 1e-3) return dirDeg(point.handleOut);
  if (point.handleIn && len(point.handleIn) > 1e-3) return dirDeg({ x: -point.handleIn.x, y: -point.handleIn.y });
  return null;
}

/** Index of the waypoint after `i`, or -1 when `i` is the open path's last. */
function nextIndex(points: PathPoint[], i: number, closed: boolean): number {
  if (i < points.length - 1) return i + 1;
  return closed ? 0 : -1;
}

/** Index of the waypoint before `i`, or -1 when `i` is the open path's first. */
function prevIndex(points: PathPoint[], i: number, closed: boolean): number {
  if (i > 0) return i - 1;
  return closed ? points.length - 1 : -1;
}

/** How many segments a path of this many waypoints has — one fewer than the waypoints, or exactly as many when it loops back on itself. */
function segmentCount(points: PathPoint[], closed: boolean): number {
  return closed ? points.length : points.length - 1;
}

/** Chordal Catmull-Rom direction through waypoint `i`: the line between its neighbours, which is what threads a smooth curve through all three. An open path's endpoints have only one neighbour, so they take that chord. */
function autoTangentDeg(points: PathPoint[], i: number, closed = false): number {
  const prev = points[prevIndex(points, i, closed)];
  const next = points[nextIndex(points, i, closed)];
  if (prev && next) {
    const across = sub(next.pos, prev.pos);
    if (len(across) > POSITION_EPSILON) return dirDeg(across);
    // Neighbours in the same place: this waypoint is the apex of a hairpin
    // (out and straight back). Catmull-Rom degenerates here, and its
    // fallback — heading back the way it came — is the one direction no
    // Unit can fly at any radius, forcing the whole reversal to happen
    // *before* the apex as one enormous loop. The perpendicular instead
    // splits the reversal into two ordinary quarter-turns either side of
    // it: a teardrop, which is how a real thing turns around.
    const inbound = sub(points[i].pos, prev.pos);
    if (len(inbound) > POSITION_EPSILON) return dirDeg(inbound) + 90;
  }
  if (next && len(sub(next.pos, points[i].pos)) > POSITION_EPSILON) return dirDeg(sub(next.pos, points[i].pos));
  if (prev && len(sub(points[i].pos, prev.pos)) > POSITION_EPSILON) return dirDeg(sub(points[i].pos, prev.pos));
  return 0;
}

function buildSegment(points: PathPoint[], i: number, j: number, outDeg: number, inDegNext: number, scale: number): SolvedSegment {
  const from = points[i].pos;
  const to = points[j].pos;
  const chord = len(sub(to, from));
  const outLen = (points[i].handleOut ? len(points[i].handleOut!) : chord * DEFAULT_HANDLE_FRACTION) * scale;
  const inLen = (points[j].handleIn ? len(points[j].handleIn!) : chord * DEFAULT_HANDLE_FRACTION) * scale;
  const p1 = { x: from.x + fromDeg(outDeg, outLen).x, y: from.y + fromDeg(outDeg, outLen).y };
  // p2 sits *back* along the arrival tangent, so the curve enters the next waypoint heading that way.
  const back = fromDeg(inDegNext, -inLen);
  const p2 = { x: to.x + back.x, y: to.y + back.y };
  const minRadius = minCurveRadius(from, p1, p2, to);
  return { p0: from, p1, p2, p3: to, length: cubicBezierLength(from, p1, p2, to), minRadius, feasible: true };
}

/** Best handle scale for one segment: the candidate nearest the default that clears `minTurnRadius`, or — when none does — whichever came closest to clearing it. */
function solveSegment(points: PathPoint[], i: number, j: number, outDeg: number, inDegNext: number, limits: MotionLimits): SolvedSegment {
  const chord = len(sub(points[j].pos, points[i].pos));
  if (chord <= POSITION_EPSILON) {
    const at = points[i].pos;
    return { p0: at, p1: at, p2: at, p3: points[j].pos, length: 0, minRadius: Infinity, feasible: true };
  }
  let best: SolvedSegment | null = null;
  for (const scale of SCALE_CANDIDATES) {
    const candidate = buildSegment(points, i, j, outDeg, inDegNext, scale);
    if (candidate.minRadius >= limits.minTurnRadius) return candidate;
    if (!best || candidate.minRadius > best.minRadius) best = candidate;
    if (limits.minTurnRadius <= 0) break; // unconstrained: the default scale is always the answer
  }
  return { ...best!, feasible: false };
}

/**
 * Straight legs, corners paid for in pivot time. No curvature constraint
 * exists for a Unit that can stop, so the only thing to compute is how
 * long each corner takes it to rotate through.
 */
function solvePivotPath(points: PathPoint[], limits: MotionLimits, closed: boolean): SolvedPath {
  const headingOutDeg: number[] = [];
  const headingInDeg: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const override = overrideDirDeg(points[i]);
    const next = points[nextIndex(points, i, closed)];
    const prev = points[prevIndex(points, i, closed)];
    const outChord = next && len(sub(next.pos, points[i].pos)) > POSITION_EPSILON ? dirDeg(sub(next.pos, points[i].pos)) : null;
    const inChord = prev && len(sub(points[i].pos, prev.pos)) > POSITION_EPSILON ? dirDeg(sub(points[i].pos, prev.pos)) : null;
    // A dragged handle curves the leg; otherwise a pivot Unit drives it dead straight.
    headingOutDeg.push(override ?? outChord ?? inChord ?? 0);
    headingInDeg.push(inChord ?? outChord ?? override ?? 0);
  }
  const segments: SolvedSegment[] = [];
  for (let i = 0; i < segmentCount(points, closed); i++) {
    const j = nextIndex(points, i, closed);
    // The arrival tangent is the next waypoint's own incoming heading, which for an un-dragged path is this leg's chord — i.e. a straight line.
    segments.push(solveSegment(points, i, j, headingOutDeg[i], overrideDirDeg(points[j]) ?? headingInDeg[j], limits));
  }
  // Nothing arrives at an open path's first waypoint, so it has no turn to make there.
  const pivotSec = points.map((_, i) => (i === 0 && !closed ? 0 : pivotSeconds(signedAngleDelta(headingInDeg[i], headingOutDeg[i]), limits.turnRateDegPerSec)));
  return { segments, headingInDeg, headingOutDeg, pivotSec, feasible: true };
}

/** Solve every segment against the current tangent set. */
function solveAll(points: PathPoint[], tangentsDeg: number[], limits: MotionLimits, closed: boolean): SolvedSegment[] {
  const segments: SolvedSegment[] = [];
  for (let i = 0; i < segmentCount(points, closed); i++) {
    const j = nextIndex(points, i, closed);
    segments.push(solveSegment(points, i, j, tangentsDeg[i], tangentsDeg[j], limits));
  }
  return segments;
}

/** The worst (tightest) radius among the segments touching waypoint `i`. */
function worstAdjacentRadius(segments: SolvedSegment[], i: number, closed: boolean): number {
  const before = segments[i > 0 ? i - 1 : closed ? segments.length - 1 : -1] ?? null;
  const after = segments[i] ?? null;
  return Math.min(before?.minRadius ?? Infinity, after?.minRadius ?? Infinity);
}

/**
 * Rotate the tangents of waypoints whose segments are still too tight,
 * by the smallest deviation that fixes them. Only reached when the length
 * search alone couldn't solve the path — see the file header on why this
 * is deliberately not part of the happy path.
 */
function relaxTangents(points: PathPoint[], tangentsDeg: number[], limits: MotionLimits, closed: boolean): number[] {
  const tangents = [...tangentsDeg];
  for (let round = 0; round < RELAX_ROUNDS; round++) {
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      const segments = solveAll(points, tangents, limits, closed);
      if (worstAdjacentRadius(segments, i, closed) >= limits.minTurnRadius) continue;
      const original = tangents[i];
      let bestDeg = original;
      let bestRadius = worstAdjacentRadius(segments, i, closed);
      let solved = false;
      for (const stepDeg of RELAX_STEPS_DEG) {
        for (const sign of [1, -1]) {
          tangents[i] = original + stepDeg * sign;
          const radius = worstAdjacentRadius(solveAll(points, tangents, limits, closed), i, closed);
          if (radius >= limits.minTurnRadius) {
            bestDeg = tangents[i];
            solved = true;
            break;
          }
          if (radius > bestRadius) {
            bestRadius = radius;
            bestDeg = tangents[i];
          }
        }
        if (solved) break;
      }
      tangents[i] = bestDeg;
      if (bestDeg !== original) changed = true;
    }
    if (!changed) break;
  }
  return tangents;
}

/** Tangent-continuous path bent to stay within the Unit's turning circle — see the file header for the four steps. */
function solveArcPath(points: PathPoint[], limits: MotionLimits, closed: boolean): SolvedPath {
  let tangentsDeg = points.map((point, i) => overrideDirDeg(point) ?? autoTangentDeg(points, i, closed));
  let segments = solveAll(points, tangentsDeg, limits, closed);
  if (segments.some((s) => !s.feasible)) {
    const relaxed = relaxTangents(points, tangentsDeg, limits, closed);
    const relaxedSegments = solveAll(points, relaxed, limits, closed);
    // Keep the relaxed solve only if it actually helped — a hopeless path shouldn't also be a wandering one.
    const worstBefore = Math.min(...segments.map((s) => s.minRadius));
    const worstAfter = Math.min(...relaxedSegments.map((s) => s.minRadius));
    if (worstAfter > worstBefore) {
      tangentsDeg = relaxed;
      segments = relaxedSegments;
    }
  }
  return {
    segments,
    headingInDeg: [...tangentsDeg],
    headingOutDeg: [...tangentsDeg],
    pivotSec: points.map(() => 0), // tangent-continuous by construction: there is nothing to pivot through
    feasible: segments.every((s) => s.feasible),
  };
}

export function solvePath(points: PathPoint[], limits: MotionLimits, options: PathOptions = {}): SolvedPath {
  // Two waypoints can close: out and straight back, which is a legitimate
  // shape (a patrol between two points) and the purest test of a reversal.
  const closed = options.closed === true && points.length >= 2;
  if (points.length === 0) return { segments: [], headingInDeg: [], headingOutDeg: [], pivotSec: [], feasible: true };
  if (points.length === 1) return { segments: [], headingInDeg: [0], headingOutDeg: [0], pivotSec: [0], feasible: true };
  return limits.minTurnRadius <= 0 ? solvePivotPath(points, limits, closed) : solveArcPath(points, limits, closed);
}

// ── Effective handles (what the solve actually used) ───────────────────────

/**
 * The handle offset the solve *actually* used leaving waypoint `index` —
 * which is the author's dragged handle only when the Unit could fly it,
 * and otherwise the nearest thing it can.
 *
 * This is what the editor's handle dot follows while you drag (so the dot
 * visibly refuses to bend past the Unit's turning circle) and what gets
 * written back on release, so the stored handle always matches the path
 * on screen rather than silently disagreeing with it.
 */
export function effectiveHandleOut(solved: SolvedPath, points: PathPoint[], index: number): Vec2 | null {
  const segment = solved.segments[index];
  if (!segment) return null;
  return { x: segment.p1.x - points[index].pos.x, y: segment.p1.y - points[index].pos.y };
}

/** The handle offset the solve used arriving at waypoint `index` — see `effectiveHandleOut`. */
export function effectiveHandleIn(solved: SolvedPath, points: PathPoint[], index: number): Vec2 | null {
  const segment = solved.segments[index - 1];
  if (!segment) return null;
  return { x: segment.p2.x - points[index].pos.x, y: segment.p2.y - points[index].pos.y };
}

// ── Memoization ────────────────────────────────────────────────────────────

/**
 * The editor re-solves on every render (canvas draw, timeline scrub, dial
 * tick) and the game re-solves per instance; the solve itself is a search
 * over curvature samples. This keeps the last handful of results so a
 * re-render with unchanged inputs is a map lookup.
 *
 * A plain insertion-ordered `Map` capped at `MEMO_LIMIT`, evicting oldest
 * — not a true LRU, which isn't worth the bookkeeping for a cache this
 * small and this hot on a single working set.
 */
const MEMO_LIMIT = 64;
const memo = new Map<string, SolvedPath>();

function signature(points: PathPoint[], limits: MotionLimits): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  const parts = points.map((p) => {
    const handles = `${p.handleOut ? `${round(p.handleOut.x)},${round(p.handleOut.y)}` : ""}|${p.handleIn ? `${round(p.handleIn.x)},${round(p.handleIn.y)}` : ""}`;
    return `${round(p.pos.x)},${round(p.pos.y)}:${handles}`;
  });
  return `${round(limits.minTurnRadius)}/${round(limits.turnRateDegPerSec)}#${parts.join(";")}`;
}

/** `solvePath` with memoization — use this everywhere in render/animation paths. */
export function solvePathCached(points: PathPoint[], limits: MotionLimits, options: PathOptions = {}): SolvedPath {
  const key = `${options.closed ? "closed" : "open"}${signature(points, limits)}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const solved = solvePath(points, limits, options);
  memo.set(key, solved);
  if (memo.size > MEMO_LIMIT) {
    const oldest = memo.keys().next();
    if (!oldest.done) memo.delete(oldest.value);
  }
  return solved;
}
