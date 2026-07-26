import { describe, expect, it } from "vitest";
import { clampHandleOffset, cubicBezierPoint, distanceBetween, resolveHandleIn, resolveHandleOut, resolveSegment } from "./bezier";
import type { AuthoredStep } from "./authoredTypes";

function step(x: number, y: number, handleIn: { x: number; y: number } | null = null, handleOut: { x: number; y: number } | null = null): AuthoredStep {
  return { id: "s", pos: { x, y }, time: 0, actionId: null, handleIn, handleOut };
}

describe("null handles", () => {
  it("default to the straight-line-equivalent control points, so an un-dragged path really is a straight line", () => {
    const from = step(0, 0);
    const to = step(300, 0);
    const { p0, p1, p2, p3 } = resolveSegment(from, to, 1);
    expect(p1).toEqual({ x: 100, y: 0 });
    expect(p2).toEqual({ x: 200, y: 0 });
    for (let u = 0; u <= 1; u += 0.1) {
      const point = cubicBezierPoint(p0, p1, p2, p3, u);
      expect(point.y).toBeCloseTo(0, 6);
      expect(point.x).toBeCloseTo(300 * u, 6);
    }
  });
});

describe("turnRate clamping", () => {
  it("caps a handle at turnRate x the segment's own length", () => {
    const from = step(0, 0, null, { x: 0, y: 1000 });
    const handle = resolveHandleOut(from, { x: 300, y: 0 }, 0.5);
    // Segment is 300 long, turnRate 0.5 -> at most 150 of handle.
    expect(distanceBetween(handle, from.pos)).toBeCloseTo(150, 6);
  });

  it("is enforced on read, so lowering a Unit's turnRate tightens curves already authored at a higher one", () => {
    const to = step(300, 0, { x: -1000, y: 0 });
    const loose = resolveHandleIn(to, { x: 0, y: 0 }, 1);
    const tight = resolveHandleIn(to, { x: 0, y: 0 }, 0.25);
    expect(distanceBetween(loose, to.pos)).toBeCloseTo(300, 6);
    expect(distanceBetween(tight, to.pos)).toBeCloseTo(75, 6);
  });

  it("leaves a handle shorter than the cap alone", () => {
    expect(clampHandleOffset({ x: 3, y: 4 }, 100)).toEqual({ x: 3, y: 4 });
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
