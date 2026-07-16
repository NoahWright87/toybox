import { describe, it, expect } from "vitest";
import { createSpawnNode, resolvePowerMultiplier, resolveSpawnCount, type SpawnNodeDef } from "./spawnTypes";
import type { CurveDef } from "./difficultyCurve";

function node(patch: Partial<SpawnNodeDef>): SpawnNodeDef {
  return { ...createSpawnNode(0, { x: 0, y: 0 }, "unit-1"), ...patch };
}

describe("resolveSpawnCount", () => {
  it("clamps a flat curve's output into [minCount, maxCount]", () => {
    const n = node({ minCount: 2, maxCount: 5, countCurve: { type: "flat", base: 1, rate: 0, cap: 0, thresholds: [] } });
    expect(resolveSpawnCount(n, 0)).toBe(2);
  });

  it("clamps a linear curve's output at the max as budget grows", () => {
    const curve: CurveDef = { type: "linear", base: 1, rate: 1, cap: 0, thresholds: [] };
    const n = node({ minCount: 1, maxCount: 8, countCurve: curve });
    expect(resolveSpawnCount(n, 0)).toBe(1);
    expect(resolveSpawnCount(n, 4)).toBe(5);
    expect(resolveSpawnCount(n, 100)).toBe(8);
  });

  it("rounds to a whole individual", () => {
    const curve: CurveDef = { type: "linear", base: 1, rate: 0.5, cap: 0, thresholds: [] };
    const n = node({ minCount: 0, maxCount: 10, countCurve: curve });
    expect(resolveSpawnCount(n, 1)).toBe(2); // 1.5 rounds to 2
  });

  it("never goes negative even if minCount/curve are misconfigured", () => {
    const curve: CurveDef = { type: "flat", base: -5, rate: 0, cap: 0, thresholds: [] };
    const n = node({ minCount: -3, maxCount: 5, countCurve: curve });
    expect(resolveSpawnCount(n, 0)).toBe(0);
  });
});

describe("resolvePowerMultiplier", () => {
  it("is always 1 when powerSplit is 0, regardless of budget", () => {
    const n = node({ powerSplit: 0 });
    expect(resolvePowerMultiplier(n, 0)).toBe(1);
    expect(resolvePowerMultiplier(n, 100)).toBe(1);
  });

  it("scales up with budget when powerSplit is 100", () => {
    const n = node({ powerSplit: 100 });
    expect(resolvePowerMultiplier(n, 0)).toBe(1);
    expect(resolvePowerMultiplier(n, 100)).toBe(2);
  });

  it("splits proportionally between 0 and 100", () => {
    const n = node({ powerSplit: 50 });
    expect(resolvePowerMultiplier(n, 100)).toBe(1.5);
  });
});
