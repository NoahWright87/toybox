/**
 * The demo circuit the Unit editor's Stats tab flies a Unit around
 * (`UnitMovementPreview.tsx`), so `speed`, `minSpeed` and
 * `turnRateDegPerSec` are something you can *watch* rather than three bare
 * numbers.
 *
 * **It is solved by the same `pathSolver.ts` an encounter uses**, on the
 * fixed circuit below (~⅖ of a tile across; `TILE_UNIT` = 720). That's the
 * whole value of it: the Stats tab isn't showing a decorative animation,
 * it's showing precisely what this Unit will do when an encounter author
 * drops it on a route with corners in it.
 *
 * - A Unit that can stop drives the legs dead straight and **pivots** at
 *   each corner, standing still while it rotates.
 * - A Unit that can't stop **swings wide** through the corners it can't
 *   make, on a curve that never bends tighter than its `minTurnRadius`.
 *
 * The circuit is sized so that an ordinary Unit clears the 90° corners
 * comfortably and only the hairpin really tests it. Scaled down far
 * enough, *every* corner exceeds a fast Unit's turning circle and the
 * whole path collapses into indistinguishable loops — which shows the
 * sharp/gentle ordering the shape exists to demonstrate.
 *
 * The lap is a *timed* schedule rather than a distance sweep, because a
 * pivot is a pause: each leg costs its pivot plus its travel, and travel
 * is the solved arc length divided by the speed that leg's tightest bend
 * actually allows (`turning.ts`'s `speedThroughRadius` — the same rule
 * `encounterTiming.ts` times a real encounter with).
 */
import { cubicBezierPoint } from "./bezier";
import { limitsFor, solvePathCached, type SolvedPath, type SolvedSegment } from "./pathSolver";
import { signedAngleDelta, speedThroughRadius } from "./turning";
import type { Vec2 } from "./encounterTypes";

/** Half-width of the demo square, in the same world units as an encounter canvas. */
export const DEMO_LOOP_RADIUS = 150;

/**
 * The demo circuit: **out along the diagonal, a full 180 back down it,
 * then a lap of the square** (Noah — "so there are sharp turns and gentle
 * ones"). One shape, four difficulties of turn:
 *
 * - the **180 at the top right** is the hardest thing a Unit can be asked
 *   to do, and the clearest demonstration of the difference between the
 *   two handling classes — a tank stops dead and rotates on the spot,
 *   while a jet can only answer it by swinging way out and coming back;
 * - the two **135s at the bottom left**, entering and leaving the lap;
 * - three ordinary **90s** round the square;
 * - and the long diagonals and sides in between, where nothing is being
 *   asked of it and it simply runs.
 *
 * Four identical corners (the previous diamond) couldn't show any of that
 * ordering: every turn cost the same, so nothing distinguished a Unit that
 * handles a gentle bend well but a hairpin badly.
 */
const R = DEMO_LOOP_RADIUS;
export const DEMO_WAYPOINTS: Vec2[] = [
  { x: -R, y: R }, // bottom left — the start, and where the lap closes
  { x: R, y: -R }, // top right, out along the diagonal
  { x: -R, y: R }, // back down the same diagonal: a 180 at the far end
  { x: -R, y: -R }, // top left, beginning the lap
  { x: R, y: -R }, // top right
  { x: R, y: R }, // bottom right, then back to the start
];

/** Speed used to pace the demo when a Unit's own is 0 — a turret still has a turn rate worth watching, and a lap that never advances would show nothing at all. */
const STATIONARY_DEMO_SPEED = 60;

export interface DemoLeg {
  segment: SolvedSegment;
  /** Seconds spent rotating on the spot at this leg's *starting* waypoint before setting off. */
  pivotSec: number;
  /** Seconds spent travelling the segment, at the speed its tightest bend allows. */
  travelSec: number;
  /** Lap time at which this leg's pivot begins. */
  startSec: number;
}

export interface DemoLap {
  solved: SolvedPath;
  legs: DemoLeg[];
  totalSec: number;
  /** The tightest circle this Unit can hold — 0 when it pivots instead. Drawn as a reference ring. */
  minTurnRadius: number;
  /** True when the Unit corners by stopping and rotating rather than arcing. */
  pivots: boolean;
}

export interface UnitMotionStats {
  speed: number;
  minSpeed: number;
  turnRateDegPerSec: number;
}

/** Solves the demo circuit for these stats and builds its lap schedule. */
export function buildDemoLap(stats: UnitMotionStats): DemoLap {
  const limits = limitsFor(stats);
  const points = DEMO_WAYPOINTS.map((pos) => ({ pos, handleIn: null, handleOut: null }));
  const solved = solvePathCached(points, limits, { closed: true });
  const cruise = stats.speed > 0 ? stats.speed : STATIONARY_DEMO_SPEED;

  const legs: DemoLeg[] = [];
  let clock = 0;
  solved.segments.forEach((segment, i) => {
    const pivotSec = solved.pivotSec[i] ?? 0;
    const speed = speedThroughRadius(segment.minRadius, Math.min(stats.minSpeed, cruise), cruise, stats.turnRateDegPerSec);
    const travelSec = segment.length / Math.max(1, speed);
    legs.push({ segment, pivotSec, travelSec, startSec: clock });
    clock += pivotSec + travelSec;
  });

  return { solved, legs, totalSec: clock, minTurnRadius: limits.minTurnRadius, pivots: limits.minTurnRadius <= 0 };
}

export interface LapSample {
  pos: Vec2;
  headingDeg: number;
  /** True while the Unit is stopped rotating rather than travelling — the preview dims its motion trail so a pivot reads as a pivot. */
  pivoting: boolean;
}

/** Where the Unit is, and which way it points, `tSec` into an endlessly repeating lap. */
export function sampleDemoLap(lap: DemoLap, tSec: number): LapSample {
  const fallback: LapSample = { pos: DEMO_WAYPOINTS[0], headingDeg: 0, pivoting: false };
  if (lap.legs.length === 0 || lap.totalSec <= 0) return fallback;
  const t = ((tSec % lap.totalSec) + lap.totalSec) % lap.totalSec;

  for (let i = 0; i < lap.legs.length; i++) {
    const leg = lap.legs[i];
    const local = t - leg.startSec;
    if (local < 0 || local > leg.pivotSec + leg.travelSec) continue;

    if (local <= leg.pivotSec && leg.pivotSec > 0) {
      const from = lap.solved.headingInDeg[i];
      const to = lap.solved.headingOutDeg[i];
      return { pos: leg.segment.p0, headingDeg: from + signedAngleDelta(from, to) * (local / leg.pivotSec), pivoting: true };
    }

    const u = leg.travelSec > 0 ? Math.min(1, (local - leg.pivotSec) / leg.travelSec) : 0;
    const { p0, p1, p2, p3 } = leg.segment;
    const pos = cubicBezierPoint(p0, p1, p2, p3, u);
    const ahead = cubicBezierPoint(p0, p1, p2, p3, Math.min(1, u + 0.01));
    const dx = ahead.x - pos.x;
    const dy = ahead.y - pos.y;
    const headingDeg = Math.hypot(dx, dy) < 1e-6 ? lap.solved.headingOutDeg[i] : (Math.atan2(dy, dx) * 180) / Math.PI;
    return { pos, headingDeg, pivoting: false };
  }
  return fallback;
}
