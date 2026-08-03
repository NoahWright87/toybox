import { describe, it, expect } from "vitest";
import { DEMO_LOOP_RADIUS, DEMO_WAYPOINTS, buildDemoLap, sampleDemoLap, type UnitMotionStats } from "./unitMovementPreview";

const TANK: UnitMotionStats = { speed: 70, minSpeed: 0, turnRateDegPerSec: 30 };
const JET: UnitMotionStats = { speed: 220, minSpeed: 130, turnRateDegPerSec: 90 };
const TURRET: UnitMotionStats = { speed: 0, minSpeed: 0, turnRateDegPerSec: 120 };

describe("buildDemoLap", () => {
  it("closes the loop — four waypoints, four legs, ending back at the start", () => {
    const lap = buildDemoLap(JET);
    expect(lap.legs).toHaveLength(DEMO_WAYPOINTS.length);
    expect(lap.legs[lap.legs.length - 1].segment.p3).toEqual(DEMO_WAYPOINTS[0]);
  });

  it("a Unit that can stop pivots the corners and drives the legs straight", () => {
    const lap = buildDemoLap(TANK);
    expect(lap.pivots).toBe(true);
    expect(lap.minTurnRadius).toBe(0);
    // 90 deg corners at 30 deg/sec.
    for (const leg of lap.legs) expect(leg.pivotSec).toBeCloseTo(3, 4);
    for (const leg of lap.legs) expect(leg.segment.length).toBeCloseTo(Math.hypot(DEMO_LOOP_RADIUS, DEMO_LOOP_RADIUS), 1);
  });

  it("a Unit that cannot stop never pivots and never bends tighter than its turning circle", () => {
    const lap = buildDemoLap(JET);
    expect(lap.pivots).toBe(false);
    expect(lap.minTurnRadius).toBeGreaterThan(80);
    for (const leg of lap.legs) {
      expect(leg.pivotSec).toBe(0);
      expect(leg.segment.minRadius).toBeGreaterThanOrEqual(lap.minTurnRadius);
    }
  });

  it("gives a Unit that cannot move at all a lap it still visibly travels", () => {
    const lap = buildDemoLap(TURRET);
    expect(lap.totalSec).toBeGreaterThan(0);
    expect(Number.isFinite(lap.totalSec)).toBe(true);
  });

  it("a slower Unit takes longer round the same circuit", () => {
    const slow = buildDemoLap({ speed: 40, minSpeed: 15, turnRateDegPerSec: 8 });
    const quick = buildDemoLap({ speed: 240, minSpeed: 140, turnRateDegPerSec: 100 });
    expect(slow.totalSec).toBeGreaterThan(quick.totalSec);
  });

  it("charges a slow-turning pivoter more lap time than a fast-turning one", () => {
    const slow = buildDemoLap({ speed: 70, minSpeed: 0, turnRateDegPerSec: 15 });
    const fast = buildDemoLap({ speed: 70, minSpeed: 0, turnRateDegPerSec: 180 });
    expect(slow.totalSec).toBeGreaterThan(fast.totalSec);
  });
});

describe("sampleDemoLap", () => {
  it("starts on the first waypoint and returns there after a full lap", () => {
    const lap = buildDemoLap(JET);
    expect(sampleDemoLap(lap, 0).pos).toEqual(DEMO_WAYPOINTS[0]);
    const wrapped = sampleDemoLap(lap, lap.totalSec);
    expect(wrapped.pos.x).toBeCloseTo(DEMO_WAYPOINTS[0].x, 4);
    expect(wrapped.pos.y).toBeCloseTo(DEMO_WAYPOINTS[0].y, 4);
  });

  it("wraps forwards and backwards rather than running off the end", () => {
    const lap = buildDemoLap(JET);
    const mid = sampleDemoLap(lap, lap.totalSec / 3);
    for (const laps of [3, -3]) {
      const wrapped = sampleDemoLap(lap, lap.totalSec / 3 + lap.totalSec * laps);
      expect(wrapped.pos.x).toBeCloseTo(mid.pos.x, 4);
      expect(wrapped.pos.y).toBeCloseTo(mid.pos.y, 4);
    }
  });

  it("holds position while pivoting, and turns while it does", () => {
    const lap = buildDemoLap(TANK);
    const quarterIn = sampleDemoLap(lap, 0.25);
    const halfIn = sampleDemoLap(lap, 1.5);
    expect(quarterIn.pivoting).toBe(true);
    expect(halfIn.pivoting).toBe(true);
    expect(halfIn.pos).toEqual(quarterIn.pos); // stationary through the turn
    expect(halfIn.headingDeg).not.toBeCloseTo(quarterIn.headingDeg, 1); // but rotating through it
  });

  it("travels once the pivot is paid for", () => {
    const lap = buildDemoLap(TANK);
    const moving = sampleDemoLap(lap, lap.legs[0].pivotSec + 0.5);
    expect(moving.pivoting).toBe(false);
    expect(moving.pos).not.toEqual(DEMO_WAYPOINTS[0]);
  });

  it("an arc Unit is never sampled mid-pivot, because it has none", () => {
    const lap = buildDemoLap(JET);
    for (let i = 0; i < 40; i++) {
      expect(sampleDemoLap(lap, (lap.totalSec * i) / 40).pivoting).toBe(false);
    }
  });
});
