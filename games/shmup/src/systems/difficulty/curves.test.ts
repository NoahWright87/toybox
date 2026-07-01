import { describe, it, expect } from "vitest";
import { dmgCurve, densityCurve, hpCurve, rarityLuck, rewardCurve } from "./curves";
import { TUNING } from "../../tuning";

describe("hpCurve / dmgCurve", () => {
  it("both equal 1 at D=0 (no change from base)", () => {
    expect(hpCurve(0)).toBe(1);
    expect(dmgCurve(0)).toBe(1);
  });

  it("HP ramps faster than damage at the same D (per-stat curves, not a shared multiplier)", () => {
    const D = 40;
    const hpGrowth = hpCurve(D) - 1;
    const dmgGrowth = dmgCurve(D) - 1;
    expect(hpGrowth).toBeGreaterThan(dmgGrowth);
  });

  it("hpCurve accelerates (quadratic term) while dmgCurve decelerates (sqrt) as D grows", () => {
    const step1 = hpCurve(20) - hpCurve(10);
    const step2 = hpCurve(40) - hpCurve(30);
    expect(step2).toBeGreaterThan(step1);

    const dmgStep1 = dmgCurve(20) - dmgCurve(10);
    const dmgStep2 = dmgCurve(40) - dmgCurve(30);
    expect(dmgStep2).toBeLessThan(dmgStep1);
  });

  it("negative D is clamped to 0", () => {
    expect(hpCurve(-10)).toBe(1);
    expect(dmgCurve(-10)).toBe(1);
  });
});

describe("densityCurve", () => {
  it("is 1 at D=0", () => {
    expect(densityCurve(0)).toBe(1);
  });

  it("decreases (denser spawns) as D rises, floored at densityCurveMaxReduction", () => {
    expect(densityCurve(1000)).toBeCloseTo(1 - TUNING.difficulty.densityCurveMaxReduction, 10);
    expect(densityCurve(1000)).toBeGreaterThan(0);
  });
});

describe("rewardCurve", () => {
  it("is 1 at D=0 and grows with D (harder = richer)", () => {
    expect(rewardCurve(0)).toBe(1);
    expect(rewardCurve(50)).toBeGreaterThan(rewardCurve(10));
  });
});

describe("rarityLuck", () => {
  it("equals Luck at D=0", () => {
    expect(rarityLuck(3, 0)).toBe(3);
  });

  it("adds luckFromD * D on top of Luck", () => {
    expect(rarityLuck(3, 10)).toBeCloseTo(3 + TUNING.difficulty.luckFromD * 10, 10);
  });
});
