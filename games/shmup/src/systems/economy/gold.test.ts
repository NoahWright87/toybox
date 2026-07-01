import { describe, it, expect } from "vitest";
import { applyInterest, coinValue, goldGainMult, interestEarned, interestRate, rollsTip } from "./gold";
import { TUNING } from "../../tuning";

describe("goldGainMult", () => {
  it("is 1 at creditScore 0 (no bonus)", () => {
    expect(goldGainMult(0)).toBe(1);
  });

  it("scales with creditScore", () => {
    expect(goldGainMult(0.5)).toBeCloseTo(1 + TUNING.economy.creditScoreGoldGainScale * 0.5, 10);
  });

  it("negative creditScore never reduces gold gain below the baseline", () => {
    expect(goldGainMult(-2)).toBe(1);
  });
});

describe("coinValue", () => {
  it("scales the base value by goldGainMult", () => {
    expect(coinValue(10, 0.2)).toBeCloseTo(10 * goldGainMult(0.2), 10);
  });
});

describe("interestRate / interestEarned / applyInterest", () => {
  it("interestRate is the base rate at creditScore 0", () => {
    expect(interestRate(0)).toBe(TUNING.economy.interestBaseRate);
  });

  it("interestEarned is proportional to the bank and the rate", () => {
    expect(interestEarned(1000, 0)).toBeCloseTo(1000 * TUNING.economy.interestBaseRate, 10);
  });

  it("a bigger Credit Score compounds a bigger bank faster", () => {
    const lowScore = interestEarned(1000, 0);
    const highScore = interestEarned(1000, 1);
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it("applyInterest adds interestEarned onto the bank", () => {
    expect(applyInterest(1000, 0.5)).toBeCloseTo(1000 + interestEarned(1000, 0.5), 10);
  });

  it("applyInterest never exceeds the (effectively-off) gold cap", () => {
    expect(applyInterest(TUNING.economy.goldCap, 5)).toBe(TUNING.economy.goldCap);
  });

  it("a negative or zero bank earns no interest", () => {
    expect(interestEarned(0, 1)).toBe(0);
    expect(interestEarned(-100, 1)).toBe(0);
  });
});

describe("rollsTip", () => {
  it("never tips below the Hype threshold, regardless of roll", () => {
    expect(rollsTip(TUNING.economy.tipsHypeThreshold - 0.01, () => 0)).toBe(false);
  });

  it("tips above the threshold when the roll beats tipsChance", () => {
    expect(rollsTip(1, () => 0)).toBe(true);
  });

  it("doesn't tip above the threshold when the roll misses tipsChance", () => {
    expect(rollsTip(1, () => 0.999)).toBe(false);
  });
});
