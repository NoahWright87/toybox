import { describe, it, expect } from "vitest";
import { cubicBezierLength, cubicBezierPoint, minCurveRadius } from "./bezier";

describe("cubicBezierPoint", () => {
  it("starts at p0 and ends at p3", () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 10, y: 50 };
    const p2 = { x: 90, y: -50 };
    const p3 = { x: 100, y: 0 };
    expect(cubicBezierPoint(p0, p1, p2, p3, 0)).toEqual(p0);
    expect(cubicBezierPoint(p0, p1, p2, p3, 1)).toEqual(p3);
  });

  it("with handles exactly on the straight line, the whole curve is that straight line", () => {
    const p0 = { x: 0, y: 0 };
    const p3 = { x: 300, y: 0 };
    const p1 = { x: 100, y: 0 };
    const p2 = { x: 200, y: 0 };
    const mid = cubicBezierPoint(p0, p1, p2, p3, 0.5);
    expect(mid.x).toBeCloseTo(150);
    expect(mid.y).toBeCloseTo(0);
  });

  it("bulges toward a handle placed off the straight line", () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 50, y: 100 }; // pulls the curve up
    const p2 = { x: 100, y: 0 };
    const p3 = { x: 150, y: 0 };
    const early = cubicBezierPoint(p0, p1, p2, p3, 0.25);
    expect(early.y).toBeGreaterThan(0); // curve bulges up near the start, toward p1
  });
});

describe("cubicBezierLength", () => {
  it("matches the straight-line distance when handles are collinear", () => {
    const p0 = { x: 0, y: 0 };
    const p3 = { x: 300, y: 0 };
    const p1 = { x: 100, y: 0 };
    const p2 = { x: 200, y: 0 };
    expect(cubicBezierLength(p0, p1, p2, p3)).toBeCloseTo(300, 1);
  });

  it("is longer than the straight-line distance when the curve bulges out", () => {
    const p0 = { x: 0, y: 0 };
    const p3 = { x: 300, y: 0 };
    const p1 = { x: 100, y: 150 };
    const p2 = { x: 200, y: 150 };
    const straight = 300;
    expect(cubicBezierLength(p0, p1, p2, p3)).toBeGreaterThan(straight);
  });
});

describe("minCurveRadius", () => {
  it("is Infinity for a straight line — nothing bends, so nothing constrains it", () => {
    expect(minCurveRadius({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 })).toBe(Infinity);
  });

  it("approximates a circular arc's own radius", () => {
    // The standard 4-point cubic approximation of a quarter circle of radius 100.
    const k = 100 * 0.5523;
    const radius = minCurveRadius({ x: 100, y: 0 }, { x: 100, y: k }, { x: k, y: 100 }, { x: 0, y: 100 });
    expect(radius).toBeGreaterThan(97);
    expect(radius).toBeLessThan(103);
  });

  it("reports a tighter radius the harder the curve bends", () => {
    const gentle = minCurveRadius({ x: 0, y: 0 }, { x: 100, y: 20 }, { x: 200, y: 20 }, { x: 300, y: 0 });
    const sharp = minCurveRadius({ x: 0, y: 0 }, { x: 100, y: 200 }, { x: 200, y: 200 }, { x: 300, y: 0 });
    expect(sharp).toBeLessThan(gentle);
  });
});
