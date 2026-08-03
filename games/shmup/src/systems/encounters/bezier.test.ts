import { describe, expect, it } from "vitest";
import { cubicBezierPoint, minCurveRadius } from "./bezier";
import { limitsFor, solvePath } from "./pathSolver";
import type { AuthoredStep } from "./authoredTypes";

function step(x: number, y: number, handleIn: { x: number; y: number } | null = null, handleOut: { x: number; y: number } | null = null): AuthoredStep {
  return { id: `s${x},${y}`, pos: { x, y }, time: 0, actionId: null, handleIn, handleOut };
}

describe("null handles", () => {
  it("default to the straight-line-equivalent control points, so an un-dragged path really is a straight line", () => {
    const solved = solvePath([step(0, 0), step(300, 0)], limitsFor({ speed: 200, minSpeed: 0, turnRateDegPerSec: 90 }));
    const { p0, p1, p2, p3 } = solved.segments[0];
    expect(p1).toEqual({ x: 100, y: 0 });
    expect(p2).toEqual({ x: 200, y: 0 });
    for (let u = 0; u <= 1; u += 0.1) {
      const point = cubicBezierPoint(p0, p1, p2, p3, u);
      expect(point.y).toBeCloseTo(0, 6);
      expect(point.x).toBeCloseTo(300 * u, 6);
    }
  });
});

describe("cubicBezierPoint", () => {
  it("starts at p0 and ends at p3", () => {
    const p = [
      { x: 0, y: 0 },
      { x: 10, y: 50 },
      { x: 90, y: 50 },
      { x: 100, y: 0 },
    ] as const;
    expect(cubicBezierPoint(p[0], p[1], p[2], p[3], 0)).toEqual({ x: 0, y: 0 });
    expect(cubicBezierPoint(p[0], p[1], p[2], p[3], 1)).toEqual({ x: 100, y: 0 });
  });

  it("bends toward its control points in between", () => {
    const mid = cubicBezierPoint({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 }, 0.5);
    expect(mid.y).toBeGreaterThan(0);
  });
});

describe("minCurveRadius", () => {
  it("is Infinity for a straight line", () => {
    expect(minCurveRadius({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 })).toBe(Infinity);
  });

  it("approximates a circular arc's own radius, matching the editor's twin", () => {
    const k = 100 * 0.5523;
    const radius = minCurveRadius({ x: 100, y: 0 }, { x: 100, y: k }, { x: k, y: 100 }, { x: 0, y: 100 });
    expect(radius).toBeGreaterThan(97);
    expect(radius).toBeLessThan(103);
  });
});
