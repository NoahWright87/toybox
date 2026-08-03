import { describe, it, expect } from "vitest";
import { DEMO_LOOP_RADIUS, DEMO_WAYPOINTS, demoLoopSegments, lapSeconds, loopLength, positionAt, sampleLoop } from "./unitMovementPreview";

const STRAIGHT_LOOP_LENGTH = 4 * Math.hypot(DEMO_LOOP_RADIUS, DEMO_LOOP_RADIUS);

describe("demoLoopSegments", () => {
  it("is a closed loop — every segment ends where the next one starts", () => {
    const segments = demoLoopSegments(1);
    segments.forEach((segment, i) => {
      expect(segment.p3).toEqual(segments[(i + 1) % segments.length].p0);
    });
  });

  it("turnRate 0 collapses every handle onto its waypoint — the bare straight-line diamond", () => {
    const segments = demoLoopSegments(0);
    for (const segment of segments) {
      expect(segment.p1).toEqual(segment.p0);
      expect(segment.p2).toEqual(segment.p3);
      expect(segment.length).toBeCloseTo(Math.hypot(DEMO_LOOP_RADIUS, DEMO_LOOP_RADIUS), 4);
    }
    expect(loopLength(segments)).toBeCloseTo(STRAIGHT_LOOP_LENGTH, 4);
  });

  it("a higher turnRate bends the path out into a longer lap", () => {
    const lengths = [0, 0.5, 1, 1.5].map((rate) => loopLength(demoLoopSegments(rate)));
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
    }
  });

  it("stops responding past DEMO_HANDLE_REACH — the authored handles are the ceiling the clamp works against", () => {
    expect(loopLength(demoLoopSegments(2))).toBeCloseTo(loopLength(demoLoopSegments(5)), 4);
  });

  it("treats a negative turnRate as 0 rather than flipping the handles inside out", () => {
    expect(loopLength(demoLoopSegments(-1))).toBeCloseTo(STRAIGHT_LOOP_LENGTH, 4);
  });
});

describe("positionAt", () => {
  it("starts on the first waypoint and returns to it after exactly one lap", () => {
    const segments = demoLoopSegments(1);
    const total = loopLength(segments);
    expect(positionAt(segments, 0)).toEqual(DEMO_WAYPOINTS[0]);
    const wrapped = positionAt(segments, total);
    expect(wrapped.x).toBeCloseTo(DEMO_WAYPOINTS[0].x, 4);
    expect(wrapped.y).toBeCloseTo(DEMO_WAYPOINTS[0].y, 4);
  });

  it("wraps forwards and backwards rather than running off the end", () => {
    const segments = demoLoopSegments(1);
    const total = loopLength(segments);
    const mid = positionAt(segments, total / 3);
    for (const laps of [4, -4]) {
      const wrapped = positionAt(segments, total / 3 + total * laps);
      expect(wrapped.x).toBeCloseTo(mid.x, 4);
      expect(wrapped.y).toBeCloseTo(mid.y, 4);
    }
  });

  it("passes through each waypoint in turn on a straight-line lap", () => {
    const segments = demoLoopSegments(0);
    const legLength = Math.hypot(DEMO_LOOP_RADIUS, DEMO_LOOP_RADIUS);
    DEMO_WAYPOINTS.forEach((waypoint, i) => {
      const pos = positionAt(segments, legLength * i);
      expect(pos.x).toBeCloseTo(waypoint.x, 4);
      expect(pos.y).toBeCloseTo(waypoint.y, 4);
    });
  });
});

describe("sampleLoop", () => {
  it("heads clockwise — leaving the top waypoint means travelling right/east", () => {
    const { headingDeg } = sampleLoop(demoLoopSegments(0), 0);
    expect(headingDeg).toBeCloseTo(45, 1); // straight-line diamond: top corner to right corner
  });

  it("faces along the curve's own tangent at a rounded corner", () => {
    // With the handles at full reach the path leaves the top waypoint due east, not diagonally.
    const { headingDeg } = sampleLoop(demoLoopSegments(2), 0);
    expect(Math.abs(headingDeg)).toBeLessThan(0.5);
  });
});

describe("lapSeconds", () => {
  it("is the loop's length divided by speed", () => {
    const segments = demoLoopSegments(0);
    expect(lapSeconds(segments, 100)).toBeCloseTo(STRAIGHT_LOOP_LENGTH / 100, 4);
  });

  it("is null at speed 0 — a Unit that holds position never completes a lap", () => {
    expect(lapSeconds(demoLoopSegments(1), 0)).toBeNull();
  });
});
