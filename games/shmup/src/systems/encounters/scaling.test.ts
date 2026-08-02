import { describe, expect, it } from "vitest";
import { applyPingPong, resolveScaling, resolveScalingSlots, spawnDelayOffsetsSec } from "./scaling";
import type { AuthoredScaling } from "./authoredTypes";

function scaling(overrides: Partial<AuthoredScaling> = {}): AuthoredScaling {
  return {
    maxCount: 1,
    minCostPerInstance: 1,
    spawnDelayMs: 0,
    shape: "curve",
    curvePoints: [],
    curveEnd: { x: 0, y: 800 },
    vTip: { x: 0, y: 800 },
    vWidth: 640,
    gridWidth: 900,
    gridDepth: 640,
    ringRadius: 500,
    pingPong: false,
    pingPongOverride: null,
    ...overrides,
  };
}

describe("resolveScaling", () => {
  it("spawns nothing when Difficulty can't afford even one instance — the gate that makes an 'elite' placement late-game", () => {
    expect(resolveScaling(scaling({ minCostPerInstance: 20 }), 5)).toEqual({ count: 0, power: 0 });
  });

  it("spawns nothing at all at Difficulty 0, which is why the playtest never defaults there", () => {
    expect(resolveScaling(scaling(), 0).count).toBe(0);
  });

  it("buys as many instances as the budget affords, up to maxCount", () => {
    expect(resolveScaling(scaling({ maxCount: 8, minCostPerInstance: 3 }), 12).count).toBe(4);
  });

  it("caps count at maxCount", () => {
    expect(resolveScaling(scaling({ maxCount: 3, minCostPerInstance: 1 }), 100).count).toBe(3);
  });

  it("keeps raising power once count saturates, instead of discarding the surplus", () => {
    const s = scaling({ maxCount: 2, minCostPerInstance: 1 });
    expect(resolveScaling(s, 10)).toEqual({ count: 2, power: 5 });
    expect(resolveScaling(s, 100)).toEqual({ count: 2, power: 50 });
  });

  it("floors power, rounding in the player's favour", () => {
    expect(resolveScaling(scaling({ maxCount: 3, minCostPerInstance: 1 }), 10).power).toBe(3);
  });
});

describe("spawnDelayOffsetsSec", () => {
  it("staggers each slot's clock behind the one before it", () => {
    expect(spawnDelayOffsetsSec({ spawnDelayMs: 250 }, 3)).toEqual([0, 0.25, 0.5]);
  });

  it("is simultaneous at a zero delay", () => {
    expect(spawnDelayOffsetsSec({ spawnDelayMs: 0 }, 3)).toEqual([0, 0, 0]);
  });
});

describe("resolveScalingSlots", () => {
  const origin = { x: 360, y: -100 };

  it("is the origin alone when nothing is being duplicated", () => {
    expect(resolveScalingSlots(scaling(), origin, 1)).toEqual([origin]);
  });

  it("is empty at a resolved count of zero", () => {
    expect(resolveScalingSlots(scaling(), origin, 0)).toEqual([]);
  });

  it("spreads a curve from the origin to its authored end", () => {
    const slots = resolveScalingSlots(scaling({ shape: "curve", curveEnd: { x: 0, y: 400 } }), origin, 3);
    expect(slots[0]).toEqual(origin);
    expect(slots[2].y).toBeCloseTo(origin.y + 400, 6);
    expect(slots[1].y).toBeCloseTo(origin.y + 200, 6);
  });

  it("puts the V's apex at the origin with symmetric arms", () => {
    const slots = resolveScalingSlots(scaling({ shape: "v" }), origin, 3);
    expect(slots[1]).toEqual(origin); // the middle parameter is the apex
    expect(slots[0].x - origin.x).toBeCloseTo(-(slots[2].x - origin.x), 6);
  });

  it("centres a ring on its authored offset at its authored radius", () => {
    const slots = resolveScalingSlots(scaling({ shape: "ring", ringRadius: 100 }), origin, 4);
    for (const slot of slots) {
      expect(Math.hypot(slot.x - origin.x, slot.y - origin.y)).toBeCloseTo(100, 6);
    }
  });

  it("centres a grid block on the origin", () => {
    const slots = resolveScalingSlots(scaling({ shape: "grid", gridWidth: 200, gridDepth: 100 }), origin, 4);
    const avgX = slots.reduce((n, s) => n + s.x, 0) / slots.length;
    expect(avgX).toBeCloseTo(origin.x, 6);
  });
});

describe("applyPingPong", () => {
  it("is inert when not enabled", () => {
    const slots = [{ x: 100, y: 0 }];
    expect(applyPingPong(slots, scaling({ pingPong: false }), 720)).toEqual(slots);
  });

  it("mirrors the whole set across the tile's centre by default", () => {
    const out = applyPingPong([{ x: 100, y: 5 }], scaling({ pingPong: true }), 720);
    expect(out).toEqual([
      { x: 100, y: 5 },
      { x: 620, y: 5 },
    ]);
  });

  it("mirrors across an explicit axis when overridden", () => {
    const out = applyPingPong([{ x: 100, y: 0 }], scaling({ pingPong: true, pingPongOverride: 200 }), 720);
    expect(out[1].x).toBe(300);
  });
});
