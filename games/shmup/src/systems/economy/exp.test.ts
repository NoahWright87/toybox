import { describe, it, expect } from "vitest";
import { applyExpGain, expToNextLevel } from "./exp";
import { TUNING } from "../../tuning";

describe("expToNextLevel", () => {
  it("equals expCurveBase at level 1", () => {
    expect(expToNextLevel(1)).toBe(TUNING.economy.expCurveBase);
  });

  it("grows exponentially with level", () => {
    expect(expToNextLevel(3)).toBeCloseTo(
      TUNING.economy.expCurveBase * Math.pow(TUNING.economy.expCurveGrowth, 2),
      10
    );
  });

  it("clamps level below 1 to 1", () => {
    expect(expToNextLevel(0)).toBe(expToNextLevel(1));
    expect(expToNextLevel(-5)).toBe(expToNextLevel(1));
  });
});

describe("applyExpGain", () => {
  it("accrues exp without leveling when under the threshold", () => {
    const result = applyExpGain({ level: 1, exp: 0 }, 5);
    expect(result).toEqual({ level: 1, exp: 5, levelsGained: 0 });
  });

  it("levels up exactly once when exp meets the threshold", () => {
    const needed = expToNextLevel(1);
    const result = applyExpGain({ level: 1, exp: 0 }, needed);
    expect(result.level).toBe(2);
    expect(result.levelsGained).toBe(1);
    expect(result.exp).toBeCloseTo(0, 10);
  });

  it("batches multiple level-ups from one large gain (never partial)", () => {
    const gain = expToNextLevel(1) + expToNextLevel(2) + expToNextLevel(3) + 3;
    const result = applyExpGain({ level: 1, exp: 0 }, gain);
    expect(result.level).toBe(4);
    expect(result.levelsGained).toBe(3);
    expect(result.exp).toBeCloseTo(3, 10);
  });

  it("carries over existing partial progress", () => {
    const needed = expToNextLevel(2);
    const result = applyExpGain({ level: 2, exp: needed - 4 }, 4);
    expect(result.level).toBe(3);
    expect(result.levelsGained).toBe(1);
    expect(result.exp).toBeCloseTo(0, 10);
  });

  it("ignores a negative/zero gain rather than reducing exp", () => {
    expect(applyExpGain({ level: 1, exp: 5 }, -10)).toEqual({ level: 1, exp: 5, levelsGained: 0 });
    expect(applyExpGain({ level: 1, exp: 5 }, 0)).toEqual({ level: 1, exp: 5, levelsGained: 0 });
  });
});
