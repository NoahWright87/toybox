import { describe, it, expect } from "vitest";
import { freeRerollAllowance, nextRerollCost, rerollCost } from "./rerolls";
import { TUNING } from "../../tuning";

describe("rerollCost", () => {
  it("the first paid reroll costs exactly rerollCostBase", () => {
    expect(rerollCost(0)).toBe(TUNING.economy.rerollCostBase);
  });

  it("grows exponentially with the paid reroll index", () => {
    expect(rerollCost(3)).toBeCloseTo(
      TUNING.economy.rerollCostBase * Math.pow(TUNING.economy.rerollCostGrowth, 3),
      10
    );
  });
});

describe("freeRerollAllowance", () => {
  it("Nobody (rank 0) gets no free rerolls", () => {
    expect(freeRerollAllowance(0)).toBe(TUNING.economy.freeRerollsByRatingsRank[0]);
  });

  it("a high Ratings rank grants more free rerolls than a low one", () => {
    expect(freeRerollAllowance(7)).toBeGreaterThan(freeRerollAllowance(0));
  });

  it("clamps out-of-range ranks to the table's ends", () => {
    expect(freeRerollAllowance(-3)).toBe(TUNING.economy.freeRerollsByRatingsRank[0]);
    const last = TUNING.economy.freeRerollsByRatingsRank.length - 1;
    expect(freeRerollAllowance(999)).toBe(TUNING.economy.freeRerollsByRatingsRank[last]);
  });
});

describe("nextRerollCost", () => {
  it("is free while within the Ratings tier's free-reroll allowance", () => {
    const rank = TUNING.economy.freeRerollsByRatingsRank.findIndex((n) => n >= 2);
    expect(nextRerollCost(0, rank)).toBe(0);
    expect(nextRerollCost(1, rank)).toBe(0);
  });

  it("starts the paid curve fresh (from rerollCost(0)) right after the free allowance runs out", () => {
    const rank = TUNING.economy.freeRerollsByRatingsRank.findIndex((n) => n === 1);
    expect(nextRerollCost(1, rank)).toBeCloseTo(rerollCost(0), 10);
    expect(nextRerollCost(2, rank)).toBeCloseTo(rerollCost(1), 10);
  });

  it("with zero free rerolls, the very first reroll is already paid", () => {
    expect(nextRerollCost(0, 0)).toBeCloseTo(rerollCost(0), 10);
  });
});
