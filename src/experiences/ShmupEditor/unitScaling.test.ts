import { describe, it, expect } from "vitest";
import { createDefaultScaling, resolveScaling, type UnitScaling } from "./unitScaling";

function scaling(patch: Partial<UnitScaling>): UnitScaling {
  return { ...createDefaultScaling(), ...patch };
}

describe("resolveScaling", () => {
  it("stays at minCount (1) when maxCount is 1, regardless of budget", () => {
    const s = scaling({ minCount: 1, maxCount: 1 });
    expect(resolveScaling(s, 0).count).toBe(1);
    expect(resolveScaling(s, 1000).count).toBe(1);
  });

  it("buys more count as budget grows, floored by minCostPerInstance", () => {
    const s = scaling({ minCount: 1, maxCount: 10, minCostPerInstance: 5, powerSplit: 0 });
    expect(resolveScaling(s, 0).count).toBe(1); // clamped up to minCount
    expect(resolveScaling(s, 12).count).toBe(2); // floor(12/5)=2
    expect(resolveScaling(s, 24).count).toBe(4); // floor(24/5)=4
  });

  it("clamps count at maxCount even with huge budget", () => {
    const s = scaling({ minCount: 1, maxCount: 3, minCostPerInstance: 1, powerSplit: 0 });
    expect(resolveScaling(s, 1000).count).toBe(3);
  });

  it("powerSplit=100 spends nothing on count beyond minCount", () => {
    const s = scaling({ minCount: 1, maxCount: 10, minCostPerInstance: 1, powerSplit: 100 });
    expect(resolveScaling(s, 500).count).toBe(1);
    expect(resolveScaling(s, 500).powerMultiplier).toBeGreaterThan(1);
  });

  it("powerSplit=0 never boosts power beyond 1x", () => {
    const s = scaling({ minCount: 1, maxCount: 10, minCostPerInstance: 1, powerSplit: 0 });
    expect(resolveScaling(s, 500).powerMultiplier).toBe(1);
  });

  it("never drops below minCount even if the curve resolves lower", () => {
    const s = scaling({ minCount: 2, maxCount: 5, minCostPerInstance: 100, powerSplit: 0 });
    expect(resolveScaling(s, 0).count).toBe(2);
  });
});
