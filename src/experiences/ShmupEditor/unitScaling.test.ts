import { describe, it, expect } from "vitest";
import { createDefaultScaling, resolveScaling, spawnDelayOffsetsSec, type UnitScaling } from "./unitScaling";

function scaling(patch: Partial<UnitScaling>): UnitScaling {
  return { ...createDefaultScaling(), ...patch };
}

describe("resolveScaling", () => {
  it("D=50, cost=25, maxCount>=2 -> 2 instances worth 25 Difficulty each", () => {
    const s = scaling({ maxCount: 5 });
    expect(resolveScaling(s, 25, 50)).toEqual({ count: 2, power: 25 });
  });

  it("D=50, cost=45 -> a single instance gets the whole 50, not just its 45 cost", () => {
    const s = scaling({ maxCount: 5 });
    expect(resolveScaling(s, 45, 50)).toEqual({ count: 1, power: 50 });
  });

  it("D=50, cost=5, maxCount>=10 -> 10 instances worth 5 each", () => {
    const s = scaling({ maxCount: 10 });
    expect(resolveScaling(s, 5, 50)).toEqual({ count: 10, power: 5 });
  });

  it("D=50, cost=5, maxCount=4 (cap binds before affordability) -> 4 instances splitting the whole 50", () => {
    const s = scaling({ maxCount: 4 });
    expect(resolveScaling(s, 5, 50)).toEqual({ count: 4, power: 12 }); // floor(50/4)=12, remainder dropped
  });

  it("count floors at 0 when Difficulty can't afford even one instance (elite/late-game gating)", () => {
    const s = scaling({ maxCount: 5 });
    expect(resolveScaling(s, 1000, 50)).toEqual({ count: 0, power: 0 });
  });

  it("maxCount=1 always passes the entire Difficulty down, regardless of cost (miniboss case)", () => {
    const s = scaling({ maxCount: 1 });
    expect(resolveScaling(s, 1, 10)).toEqual({ count: 1, power: 10 });
    expect(resolveScaling(s, 1, 1000)).toEqual({ count: 1, power: 1000 });
  });

  it("power keeps growing with Difficulty even after count saturates at maxCount (no wasted budget)", () => {
    const s = scaling({ maxCount: 5 });
    expect(resolveScaling(s, 2, 20).count).toBe(5); // saturated
    expect(resolveScaling(s, 2, 20).power).toBe(4); // 20/5
    expect(resolveScaling(s, 2, 50).count).toBe(5); // still capped
    expect(resolveScaling(s, 2, 50).power).toBe(10); // 50/5 -- grew, nothing discarded
  });

  it("negative Difficulty is treated as zero", () => {
    const s = scaling({ maxCount: 5 });
    expect(resolveScaling(s, 1, -10)).toEqual({ count: 0, power: 0 });
  });
});

describe("spawnDelayOffsetsSec", () => {
  it("slot 0 always trails by 0 (the base instance, no delay)", () => {
    const s = scaling({ spawnDelayMs: 500 });
    expect(spawnDelayOffsetsSec(s, 3)[0]).toBe(0);
  });

  it("each successive slot trails by one more spawnDelayMs, in seconds", () => {
    const s = scaling({ spawnDelayMs: 250 });
    expect(spawnDelayOffsetsSec(s, 4)).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it("returns an empty array for count 0 or negative", () => {
    const s = scaling({ spawnDelayMs: 100 });
    expect(spawnDelayOffsetsSec(s, 0)).toEqual([]);
    expect(spawnDelayOffsetsSec(s, -2)).toEqual([]);
  });

  it("all offsets are 0 when spawnDelayMs is 0 (simultaneous spawns)", () => {
    const s = scaling({ spawnDelayMs: 0 });
    expect(spawnDelayOffsetsSec(s, 3)).toEqual([0, 0, 0]);
  });
});
