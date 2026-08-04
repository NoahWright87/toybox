/**
 * The demo routes the Unit editor's Stats tab flies a Unit around
 * (`UnitMovementPreview.tsx`), so `speed`, `minSpeed` and
 * `turnRateDegPerSec` are something you can *watch* rather than three bare
 * numbers.
 *
 * **They are solved by the same `pathSolver.ts` an encounter uses**, on
 * routes sized against a real tile (`TILE_UNIT` = 720). That's the whole
 * value of it: the Stats tab isn't showing a decorative animation, it's
 * showing precisely what this Unit will do when an encounter author drops
 * it on a route of that shape.
 *
 * - A Unit that can stop drives the legs dead straight and **pivots** at
 *   each corner, standing still while it rotates.
 * - A Unit that can't stop **swings wide** through the corners it can't
 *   make, on a curve that never bends tighter than its `minTurnRadius`.
 *
 * **There are several routes rather than one** (Noah: "give me more options
 * of routes to visualize... they should include all the things a person
 * might try to do") because no single shape asks a Unit every question. A
 * lap of a square says nothing about turning around; a hairpin says nothing
 * about holding a sustained curve; a straight line says nothing at all
 * until it ends. Each route below isolates one of those, and `mixed` puts
 * them in a row.
 *
 * Every route declares its own `viewRadius` rather than sharing one zoom:
 * the shapes have genuinely different extents, and a route that only fills
 * the middle third of the canvas wastes the resolution where the
 * interesting part is. It's fixed per route, never fitted to the solved
 * path — auto-fitting would rescale the picture as you turned a dial, which
 * makes the very change you're looking for impossible to see.
 *
 * A lap is a *timed* schedule rather than a distance sweep, because a pivot
 * is a pause: each leg costs its pivot plus its travel, and travel is the
 * solved arc length divided by the speed that leg's tightest bend actually
 * allows (`turning.ts`'s `speedThroughRadius` — the same rule
 * `encounterTiming.ts` times a real encounter with).
 */
import { cubicBezierPoint } from "./bezier";
import { limitsFor, solvePathCached, type SolvedPath, type SolvedSegment } from "./pathSolver";
import { signedAngleDelta, speedThroughRadius } from "./turning";
import type { Vec2 } from "./encounterTypes";

/** Half-width of the demo shapes, in the same world units as an encounter canvas. ~⅖ of a tile. */
export const DEMO_LOOP_RADIUS = 150;

const R = DEMO_LOOP_RADIUS;

export interface DemoRoute {
  id: string;
  /** Shown in the Stats tab's route picker. */
  label: string;
  /** One-line description of what this shape is asking of the Unit. */
  about: string;
  /** Waypoints, flown in order and then looped back to the first. */
  waypoints: Vec2[];
  /** Half the world-space extent the canvas shows for this route — see the file header on why it's per route and fixed. */
  viewRadius: number;
}

/** `n` points evenly spaced round a circle of radius `radius`, starting at the top and going clockwise. */
function ring(n: number, radius: number, startDeg = -90): Vec2[] {
  return Array.from({ length: n }, (_, i) => {
    const rad = ((startDeg + (360 * i) / n) * Math.PI) / 180;
    return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
  });
}

/**
 * The catalogue. Ordered roughly easiest-to-hardest, so scanning the picker
 * top to bottom asks progressively more of the Unit.
 */
export const DEMO_ROUTES: DemoRoute[] = [
  {
    id: "line",
    label: "Straight line",
    about: "Corner to corner and straight back — nothing but a 180 at each end.",
    // Two waypoints, looped: out along the diagonal and back down it. The
    // purest test there is of "can this thing turn around, and what does it
    // cost" — a tank stops and rotates, a jet needs a whole teardrop.
    waypoints: [
      { x: -R, y: R },
      { x: R, y: -R },
    ],
    viewRadius: 290,
  },
  {
    id: "circle",
    label: "Circle",
    about: "One sustained curve — moving and turning at the same time, forever.",
    // Eight points on a ring: an arc Unit holds a continuous turn the whole
    // way round, which is the one thing a corner-based route can't show.
    waypoints: ring(8, R),
    viewRadius: 230,
  },
  {
    id: "diamond",
    label: "Diamond",
    about: "Four identical 90° corners on the diagonals.",
    waypoints: ring(4, R),
    viewRadius: 260,
  },
  {
    id: "square",
    label: "Square",
    about: "Four identical 90° corners, with longer straights between them.",
    waypoints: [
      { x: -R, y: -R },
      { x: R, y: -R },
      { x: R, y: R },
      { x: -R, y: R },
    ],
    viewRadius: 270,
  },
  {
    id: "star",
    label: "Five-point star",
    about: "Five 144° turns in quick succession — punishing for anything heavy.",
    // A pentagram: the five points of a ring visited every *other* point.
    waypoints: [0, 2, 4, 1, 3].map((i) => ring(5, R)[i]),
    viewRadius: 280,
  },
  {
    id: "mixed",
    label: "Bit of everything",
    about: "Long straights, a 180, two 135s and three 90s — the whole spread in one lap.",
    // Out along the diagonal, a full 180 back down it, then a lap of the
    // square. One shape, four difficulties of turn, so a Unit that takes a
    // gentle bend happily but wallows through a hairpin looks different from
    // one that doesn't.
    waypoints: [
      { x: -R, y: R }, // bottom left — the start, and where the lap closes
      { x: R, y: -R }, // top right, out along the diagonal
      { x: -R, y: R }, // back down the same diagonal: a 180 at the far end
      { x: -R, y: -R }, // top left, beginning the lap
      { x: R, y: -R }, // top right
      { x: R, y: R }, // bottom right, then back to the start
    ],
    viewRadius: 290,
  },
];

/** Opens on the route that asks the most questions at once. */
export const DEFAULT_DEMO_ROUTE_ID = "mixed";

export function demoRouteById(id: string): DemoRoute {
  return DEMO_ROUTES.find((route) => route.id === id) ?? DEMO_ROUTES[DEMO_ROUTES.length - 1];
}

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
  route: DemoRoute;
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

/** Solves one demo route for these stats and builds its lap schedule. */
export function buildDemoLap(stats: UnitMotionStats, route: DemoRoute = demoRouteById(DEFAULT_DEMO_ROUTE_ID)): DemoLap {
  const limits = limitsFor(stats);
  const points = route.waypoints.map((pos) => ({ pos, handleIn: null, handleOut: null }));
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

  return { route, solved, legs, totalSec: clock, minTurnRadius: limits.minTurnRadius, pivots: limits.minTurnRadius <= 0 };
}

export interface LapSample {
  pos: Vec2;
  headingDeg: number;
  /** True while the Unit is stopped rotating rather than travelling — the preview dims its motion trail so a pivot reads as a pivot. */
  pivoting: boolean;
}

/** Where the Unit is, and which way it points, `tSec` into an endlessly repeating lap. */
export function sampleDemoLap(lap: DemoLap, tSec: number): LapSample {
  const fallback: LapSample = { pos: lap.route.waypoints[0] ?? { x: 0, y: 0 }, headingDeg: 0, pivoting: false };
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
