import { describe, it, expect } from "vitest";
import { applyPingPong, resolveScalingSlots } from "./unitScalingShapes";
import { createDefaultScaling, type UnitScaling } from "./unitScaling";

const ORIGIN = { x: 50, y: 50 };

function scaling(patch: Partial<UnitScaling>): UnitScaling {
  return { ...createDefaultScaling(), ...patch };
}

describe("resolveScalingSlots", () => {
  it("count=1 always returns just the origin, regardless of shape", () => {
    for (const shape of ["curve", "v", "grid", "ring"] as const) {
      expect(resolveScalingSlots(scaling({ shape }), ORIGIN, 1)).toEqual([ORIGIN]);
    }
  });

  it("curve with no intermediate points is a straight line from origin to curveEnd", () => {
    const s = scaling({ shape: "curve", curvePoints: [], curveEnd: { x: 0, y: 100 } });
    const slots = resolveScalingSlots(s, ORIGIN, 3);
    expect(slots[0]).toEqual(ORIGIN);
    expect(slots[2]).toEqual({ x: 50, y: 150 });
    expect(slots[1].y).toBeCloseTo(100); // midpoint
  });

  it("curve threads through an intermediate control point", () => {
    const s = scaling({ shape: "curve", curvePoints: [{ x: 100, y: 0 }], curveEnd: { x: 0, y: 100 } });
    const slots = resolveScalingSlots(s, ORIGIN, 3);
    expect(slots[0]).toEqual(ORIGIN);
    expect(slots[2]).toEqual({ x: 50, y: 150 });
  });

  it("v shape has its apex at the origin and is symmetric around it", () => {
    const s = scaling({ shape: "v", vTip: { x: 0, y: 100 }, vWidth: 80 });
    const slots = resolveScalingSlots(s, ORIGIN, 5);
    expect(slots[2]).toEqual(ORIGIN); // center individual sits at the apex
    expect(distance(slots[0], ORIGIN)).toBeCloseTo(distance(slots[4], ORIGIN));
  });

  it("grid arranges points in rows/cols centered on the origin", () => {
    const s = scaling({ shape: "grid", gridWidth: 100, gridDepth: 100 });
    const slots = resolveScalingSlots(s, ORIGIN, 4);
    expect(slots).toHaveLength(4);
    const xs = new Set(slots.map((p) => Math.round(p.x)));
    expect(xs.size).toBe(2);
  });

  it("ring distributes points evenly around a center at the given radius", () => {
    const s = scaling({ shape: "ring", ringRadius: 50 });
    const slots = resolveScalingSlots(s, ORIGIN, 4);
    expect(slots).toHaveLength(4);
    for (const p of slots) {
      expect(distance(p, ORIGIN)).toBeCloseTo(50, 5);
    }
  });
});

describe("applyPingPong", () => {
  it("returns the same set unchanged when pingPong is false", () => {
    const s = scaling({ pingPong: false });
    const positions = [{ x: 10, y: 10 }];
    expect(applyPingPong(positions, s, 200)).toEqual(positions);
  });

  it("mirrors across the tile's own center by default", () => {
    const s = scaling({ pingPong: true, pingPongOverride: null });
    const positions = [{ x: 30, y: 10 }];
    const result = applyPingPong(positions, s, 200);
    expect(result).toEqual([{ x: 30, y: 10 }, { x: 170, y: 10 }]);
  });

  it("mirrors across the override axis when set", () => {
    const s = scaling({ pingPong: true, pingPongOverride: 40 });
    const positions = [{ x: 30, y: 10 }];
    const result = applyPingPong(positions, s, 200);
    expect(result).toEqual([{ x: 30, y: 10 }, { x: 50, y: 10 }]);
  });
});

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
