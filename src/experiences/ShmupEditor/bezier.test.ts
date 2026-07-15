import { describe, it, expect } from "vitest";
import { clampHandleOffset, cubicBezierLength, cubicBezierPoint, resolveHandleIn, resolveHandleOut, resolveSegment } from "./bezier";
import type { EncounterStep } from "./encounterTypes";

function step(pos: { x: number; y: number }, overrides: Partial<EncounterStep> = {}): EncounterStep {
  return { id: "s", pos, visible: true, time: 0, speedMultiplier: 1, handleIn: null, handleOut: null, ...overrides };
}

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

describe("clampHandleOffset", () => {
  it("leaves a short offset untouched", () => {
    const offset = { x: 10, y: 0 };
    expect(clampHandleOffset(offset, 100)).toEqual(offset);
  });

  it("scales an overlong offset down to maxLength, preserving direction", () => {
    const offset = { x: 100, y: 0 };
    const clamped = clampHandleOffset(offset, 25);
    expect(clamped.x).toBeCloseTo(25);
    expect(clamped.y).toBeCloseTo(0);
  });
});

describe("resolveHandleOut / resolveHandleIn", () => {
  it("defaults to 1/3 of the way toward the other endpoint when handleOut is null", () => {
    const from = step({ x: 0, y: 0 });
    const resolved = resolveHandleOut(from, { x: 300, y: 0 }, 1);
    expect(resolved).toEqual({ x: 100, y: 0 });
  });

  it("defaults to 1/3 of the way back toward the other endpoint when handleIn is null", () => {
    const to = step({ x: 300, y: 0 });
    const resolved = resolveHandleIn(to, { x: 0, y: 0 }, 1);
    expect(resolved).toEqual({ x: 200, y: 0 });
  });

  it("uses the authored handleOut offset when present, clamped by turnRate", () => {
    const from = step({ x: 0, y: 0 }, { handleOut: { x: 0, y: 500 } }); // way off to the side
    const resolved = resolveHandleOut(from, { x: 300, y: 0 }, 0.5); // turnRate 0.5 -> max 150px
    expect(resolved.x).toBeCloseTo(0);
    expect(resolved.y).toBeCloseTo(150);
  });

  it("a zero-length segment clamps handles to zero regardless of authored offset", () => {
    const from = step({ x: 50, y: 50 }, { handleOut: { x: 0, y: 500 } });
    const resolved = resolveHandleOut(from, { x: 50, y: 50 }, 5); // same position -> maxLength 0
    expect(resolved).toEqual({ x: 50, y: 50 });
  });
});

describe("resolveSegment", () => {
  it("produces a straight-line-equivalent segment when both steps have null handles", () => {
    const from = step({ x: 0, y: 0 });
    const to = step({ x: 300, y: 0 });
    const seg = resolveSegment(from, to, 1);
    const mid = cubicBezierPoint(seg.p0, seg.p1, seg.p2, seg.p3, 0.5);
    expect(mid).toEqual({ x: 150, y: 0 });
  });
});
