import { describe, it, expect } from "vitest";
import {
  UPGRADES,
  emptyUpgradeCounts,
  upgradeCost,
  computeDerivedStats,
  rerollCost,
  rollShopOffers,
  parseSaveData,
  DEFAULT_SAVE,
  REROLL_BASE_COST,
  getUpgrade,
} from "./upgrades";
import { mulberry32, DIFFICULTIES } from "./levelGen";

describe("upgradeCost", () => {
  it("scales exponentially with owned count", () => {
    const def = getUpgrade("wide-paddle");
    const cost0 = upgradeCost(def, 0, 1);
    const cost1 = upgradeCost(def, 1, 1);
    const cost2 = upgradeCost(def, 2, 1);
    expect(cost0).toBe(def.baseCost);
    expect(cost1).toBeGreaterThan(cost0);
    expect(cost2).toBeGreaterThan(cost1);
  });

  it("applies the difficulty price multiplier", () => {
    const def = getUpgrade("vitality");
    const normal = upgradeCost(def, 0, DIFFICULTIES.normal.priceMult);
    const hard = upgradeCost(def, 0, DIFFICULTIES.hard.priceMult);
    const easy = upgradeCost(def, 0, DIFFICULTIES.easy.priceMult);
    expect(hard).toBeGreaterThan(normal);
    expect(easy).toBeLessThan(normal);
  });
});

describe("rerollCost", () => {
  it("increases with each reroll used", () => {
    expect(rerollCost(0, 1)).toBe(REROLL_BASE_COST);
    expect(rerollCost(1, 1)).toBeGreaterThan(rerollCost(0, 1));
    expect(rerollCost(2, 1)).toBeGreaterThan(rerollCost(1, 1));
  });
});

describe("computeDerivedStats", () => {
  it("returns no bonuses for empty counts", () => {
    const derived = computeDerivedStats(emptyUpgradeCounts());
    expect(derived.paddleWidthBonus).toBe(0);
    expect(derived.scoreMultiplier).toBe(1);
    expect(derived.ballSpeedMultiplier).toBe(1);
    expect(derived.homing).toBe(false);
    expect(derived.extraBalls).toBe(0);
  });

  it("stacks bonuses with owned counts", () => {
    const counts = emptyUpgradeCounts();
    counts["wide-paddle"] = 3;
    counts.greed = 2;
    counts.homing = 1;
    counts["extra-ball"] = 1;
    const derived = computeDerivedStats(counts);
    expect(derived.paddleWidthBonus).toBe(30);
    expect(derived.scoreMultiplier).toBeCloseTo(1.3);
    expect(derived.ballSpeedMultiplier).toBeCloseTo(1.1);
    expect(derived.homing).toBe(true);
    expect(derived.extraBalls).toBe(1);
  });
});

describe("rollShopOffers", () => {
  it("excludes upgrades that are already at max stacks", () => {
    const counts = emptyUpgradeCounts();
    for (const def of UPGRADES) counts[def.id] = def.maxStacks;
    const offers = rollShopOffers(counts, mulberry32(1), DIFFICULTIES.normal);
    expect(offers.length).toBe(0);
  });

  it("returns up to the requested number of unique offers", () => {
    const offers = rollShopOffers(emptyUpgradeCounts(), mulberry32(1), DIFFICULTIES.normal, 3);
    expect(offers.length).toBe(3);
    const ids = new Set(offers.map((o) => o.def.id));
    expect(ids.size).toBe(3);
  });
});

describe("parseSaveData", () => {
  it("returns defaults for missing or invalid data", () => {
    expect(parseSaveData(undefined)).toEqual(DEFAULT_SAVE);
    expect(parseSaveData("not json")).toEqual(DEFAULT_SAVE);
  });

  it("migrates a legacy plain integer high score", () => {
    const save = parseSaveData("1234");
    expect(save.highScore).toBe(1234);
    expect(save.bestLevel).toBe(0);
  });

  it("round-trips full save data", () => {
    const data = {
      highScore: 500,
      bestLevel: 7,
      gamesPlayed: 3,
      paddleColor: "purple",
      difficulty: "hard" as const,
    };
    expect(parseSaveData(JSON.stringify(data))).toEqual(data);
  });
});
