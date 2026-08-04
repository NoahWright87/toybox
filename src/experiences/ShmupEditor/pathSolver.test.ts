import { describe, it, expect } from "vitest";
import { solvePath, solvePathCached, type MotionLimits, type PathPoint } from "./pathSolver";
import { cubicBezierPoint } from "./bezier";
import { minTurnRadius } from "./turning";

const at = (x: number, y: number): PathPoint => ({ pos: { x, y }, handleIn: null, handleOut: null });

/** A jet: 140 minimum speed, 90 deg/sec — it cannot hold a circle tighter than ~89 units. */
const JET: MotionLimits = { minTurnRadius: minTurnRadius(140, 90), turnRateDegPerSec: 90 };
/** A tank: stops and pivots, so nothing is geometrically off-limits. */
const TANK: MotionLimits = { minTurnRadius: minTurnRadius(0, 30), turnRateDegPerSec: 30 };
const BATTLESHIP: MotionLimits = { minTurnRadius: minTurnRadius(15, 8), turnRateDegPerSec: 8 };

function samples(seg: { p0: { x: number; y: number }; p1: { x: number; y: number }; p2: { x: number; y: number }; p3: { x: number; y: number } }, n = 40) {
  return Array.from({ length: n + 1 }, (_, i) => cubicBezierPoint(seg.p0, seg.p1, seg.p2, seg.p3, i / n));
}

describe("minTurnRadius wiring", () => {
  it("a jet's turning circle is speed / angular rate", () => {
    expect(JET.minTurnRadius).toBeCloseTo(140 / (Math.PI / 2), 1);
    expect(JET.minTurnRadius).toBeGreaterThan(88);
    expect(JET.minTurnRadius).toBeLessThan(90);
  });

  it("anything that can stop has no turning circle at all", () => {
    expect(TANK.minTurnRadius).toBe(0);
  });
});

describe("solvePath — pivot units (minSpeed 0)", () => {
  const corner = [at(0, 0), at(300, 0), at(300, 300)];

  it("drives straight legs — the path never leaves the lines between waypoints", () => {
    const solved = solvePath(corner, TANK);
    for (const point of samples(solved.segments[0])) {
      expect(Math.abs(point.y)).toBeLessThan(0.01);
    }
    for (const point of samples(solved.segments[1])) {
      expect(Math.abs(point.x - 300)).toBeLessThan(0.01);
    }
  });

  it("charges a corner in pivot time instead of bending the route", () => {
    const solved = solvePath(corner, TANK);
    expect(solved.pivotSec[0]).toBe(0); // nothing arrives at the first waypoint
    expect(solved.pivotSec[1]).toBeCloseTo(90 / 30, 4); // a 90 deg corner at 30 deg/sec
    expect(solved.feasible).toBe(true);
  });

  it("a faster-turning Unit pays less for the same corner", () => {
    const heli = solvePath(corner, { minTurnRadius: 0, turnRateDegPerSec: 180 });
    expect(heli.pivotSec[1]).toBeCloseTo(0.5, 4);
  });

  it("treats an effectively-instant turner as costing nothing", () => {
    const infantry = solvePath(corner, { minTurnRadius: 0, turnRateDegPerSec: 720 });
    expect(infantry.pivotSec[1]).toBe(0);
  });
});

describe("solvePath — arc units (minSpeed > 0)", () => {
  const corner = [at(0, 0), at(300, 0), at(300, 300)];

  it("swings wide through a corner it cannot turn on the spot", () => {
    const solved = solvePath(corner, JET);
    expect(solved.feasible).toBe(true);
    // Noah's example: the jet dips into negative Y before the corner...
    const dip = Math.min(...samples(solved.segments[0]).map((p) => p.y));
    expect(dip).toBeLessThan(-10);
    // ...and bulges past x=300 after it, rather than turning in place.
    const bulge = Math.max(...samples(solved.segments[1]).map((p) => p.x));
    expect(bulge).toBeGreaterThan(310);
  });

  it("still passes exactly through every authored waypoint", () => {
    const solved = solvePath(corner, JET);
    expect(solved.segments[0].p0).toEqual({ x: 0, y: 0 });
    expect(solved.segments[0].p3).toEqual({ x: 300, y: 0 });
    expect(solved.segments[1].p0).toEqual({ x: 300, y: 0 });
    expect(solved.segments[1].p3).toEqual({ x: 300, y: 300 });
  });

  it("never bends tighter than the Unit's turning circle", () => {
    const jet = solvePath(corner, JET);
    for (const segment of jet.segments) expect(segment.minRadius).toBeGreaterThanOrEqual(JET.minTurnRadius);
    const ship = solvePath(corner, BATTLESHIP);
    for (const segment of ship.segments) expect(segment.minRadius).toBeGreaterThanOrEqual(BATTLESHIP.minTurnRadius);
  });

  it("a heavier Unit swings wider through the same corner", () => {
    const jetDip = Math.min(...samples(solvePath(corner, JET).segments[0]).map((p) => p.y));
    const shipDip = Math.min(...samples(solvePath(corner, BATTLESHIP).segments[0]).map((p) => p.y));
    expect(shipDip).toBeLessThan(jetDip);
  });

  it("never pivots — its tangents are continuous by construction", () => {
    const solved = solvePath(corner, JET);
    expect(solved.pivotSec.every((s) => s === 0)).toBe(true);
    expect(solved.headingInDeg[1]).toBeCloseTo(solved.headingOutDeg[1], 6);
  });

  it("leaves an already-gentle path alone", () => {
    // A straight run needs no bending at all: the solved curve stays on the line.
    const straight = solvePath([at(0, 0), at(0, 400), at(0, 800)], JET);
    for (const segment of straight.segments) {
      for (const point of samples(segment)) expect(Math.abs(point.x)).toBeLessThan(0.01);
    }
    expect(straight.feasible).toBe(true);
  });

  it("rescues a hairpin by relaxing tangents", () => {
    const hairpin = [at(0, 0), at(300, 0), at(0, 60)];
    const solved = solvePath(hairpin, JET);
    expect(solved.feasible).toBe(true);
    for (const segment of solved.segments) expect(segment.minRadius).toBeGreaterThanOrEqual(JET.minTurnRadius);
  });

  it("turns around in a teardrop when a route doubles back on itself", () => {
    // Out and *exactly* back: the apex's two neighbours are the same point, so
    // the usual next-minus-previous tangent is degenerate there.
    const there = at(0, 0);
    const andBack = [there, at(300, -300), { ...there }, at(-200, 0)];
    const solved = solvePath(andBack, JET);
    expect(solved.feasible).toBe(true);
    for (const segment of solved.segments) expect(segment.minRadius).toBeGreaterThanOrEqual(JET.minTurnRadius);
    // The reversal is split either side of the apex rather than crammed in
    // before it, so the excursion past the far waypoint stays modest.
    const beyond = Math.max(...samples(solved.segments[0]).concat(samples(solved.segments[1])).map((p) => p.x));
    expect(beyond).toBeLessThan(300 + 2 * JET.minTurnRadius);
  });

  it("reports best effort — never throws or rejects — when the geometry is impossible", () => {
    // 60 units between waypoints with a 90 deg turn cannot be flown at an 89-unit radius by anything.
    const impossible = solvePath([at(0, 0), at(60, 0), at(60, 60)], JET);
    expect(impossible.feasible).toBe(false);
    expect(impossible.segments).toHaveLength(2);
    expect(impossible.segments[0].p3).toEqual({ x: 60, y: 0 }); // still hits the waypoints
  });
});

describe("solvePath — authored handles", () => {
  it("honours a dragged handle's direction", () => {
    const points: PathPoint[] = [{ pos: { x: 0, y: 0 }, handleIn: null, handleOut: { x: 0, y: -100 } }, at(300, 0)];
    const solved = solvePath(points, TANK);
    expect(solved.headingOutDeg[0]).toBeCloseTo(-90, 4);
    expect(Math.min(...samples(solved.segments[0]).map((p) => p.y))).toBeLessThan(-20);
  });

  it("clamps a dragged handle the Unit could not fly back to something it can", () => {
    // Straight up out of the start, on a due-east leg, is a hairpin an arc Unit can't hold.
    const points: PathPoint[] = [{ pos: { x: 0, y: 0 }, handleIn: null, handleOut: { x: 0, y: -100 } }, at(300, 0), at(300, 300)];
    const solved = solvePath(points, JET);
    for (const segment of solved.segments) expect(segment.minRadius).toBeGreaterThanOrEqual(JET.minTurnRadius);
  });
});

describe("a Unit that can stop, on a hand-curved path", () => {
  // Three waypoints in a right angle, with the corner's handles dragged out
  // along the bisector — i.e. the author asked for a rounded corner.
  const rounded: PathPoint[] = [
    at(0, 0),
    { pos: { x: 300, y: 0 }, handleIn: { x: -80, y: -80 }, handleOut: { x: 80, y: 80 } },
    at(300, 300),
  ];

  it("sweeps the corner instead of stopping at it — a tank can turn while driving", () => {
    const solved = solvePath(rounded, TANK);
    expect(solved.pivotSec[1]).toBe(0);
    // Both legs genuinely bend rather than being straight lines to the corner.
    for (const segment of solved.segments) expect(segment.minRadius).toBeLessThan(Infinity);
  });

  it("still pivots at a corner whose handles were never touched", () => {
    const solved = solvePath([at(0, 0), at(300, 0), at(300, 300)], TANK);
    expect(solved.pivotSec[1]).toBeGreaterThan(0);
    for (const segment of solved.segments) expect(segment.minRadius).toBe(Infinity);
  });

  it("arrives on the same heading it leaves, so nothing snaps mid-curve", () => {
    const solved = solvePath(rounded, TANK);
    expect(solved.headingInDeg[1]).toBeCloseTo(solved.headingOutDeg[1], 6);
    // ...and that heading is the one the author dragged, not the chord.
    expect(solved.headingOutDeg[1]).toBeCloseTo(45, 6);
  });
});

describe("degenerate input", () => {
  it("handles an empty, single, and dwelling path", () => {
    expect(solvePath([], JET).segments).toHaveLength(0);
    expect(solvePath([at(5, 5)], JET).segments).toHaveLength(0);
    const dwell = solvePath([at(10, 10), at(10, 10)], JET);
    expect(dwell.segments[0].length).toBe(0);
    expect(dwell.feasible).toBe(true);
  });
});

describe("solvePathCached", () => {
  it("returns an identical result to the uncached solve, and reuses it", () => {
    const points = [at(0, 0), at(300, 0), at(300, 300)];
    const first = solvePathCached(points, JET);
    const second = solvePathCached([at(0, 0), at(300, 0), at(300, 300)], JET);
    expect(second).toBe(first); // same object: the memo hit
    expect(first.segments.map((s) => s.length)).toEqual(solvePath(points, JET).segments.map((s) => s.length));
  });

  it("does not reuse a result across different motion limits", () => {
    const points = [at(0, 0), at(300, 0), at(300, 300)];
    expect(solvePathCached(points, JET)).not.toBe(solvePathCached(points, BATTLESHIP));
  });
});
