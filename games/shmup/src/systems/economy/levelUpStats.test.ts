import { describe, it, expect } from "vitest";
import { mainStatPickModifier, rollLevelUpOffers, statPickMods } from "./levelUpStats";
import { MAIN_STAT_IDS } from "../stats";
import { TUNING } from "../../tuning";

describe("rollLevelUpOffers", () => {
  it("returns the configured offer count (4) by default", () => {
    expect(rollLevelUpOffers(undefined, () => 0)).toHaveLength(TUNING.economy.levelUpOfferCount);
  });

  it("never returns duplicate stats within one offer", () => {
    const offers = rollLevelUpOffers(4, () => 0.5);
    expect(new Set(offers).size).toBe(offers.length);
  });

  it("only ever offers MAIN stats, never exotics", () => {
    const offers = rollLevelUpOffers(16, () => Math.random());
    for (const stat of offers) {
      expect(MAIN_STAT_IDS).toContain(stat);
    }
  });

  it("clamps the requested count to the pool size (16 main stats)", () => {
    expect(rollLevelUpOffers(999, () => Math.random())).toHaveLength(MAIN_STAT_IDS.length);
  });
});

describe("mainStatPickModifier", () => {
  it("returns a flat modifier sized per TUNING.economy.mainStatPickAmount", () => {
    expect(mainStatPickModifier("damage")).toEqual({
      kind: "flat",
      stat: "damage",
      amount: TUNING.economy.mainStatPickAmount.damage,
      source: "levelup",
    });
  });
});

describe("statPickMods", () => {
  it("scales each stat's mod amount by how many times it was picked", () => {
    const mods = statPickMods({ damage: 3, maxHp: 1 });
    expect(mods).toContainEqual({
      kind: "flat",
      stat: "damage",
      amount: TUNING.economy.mainStatPickAmount.damage * 3,
      source: "levelup",
    });
    expect(mods).toContainEqual({
      kind: "flat",
      stat: "maxHp",
      amount: TUNING.economy.mainStatPickAmount.maxHp * 1,
      source: "levelup",
    });
  });

  it("omits stats with a zero or missing pick count", () => {
    const mods = statPickMods({ damage: 0, luck: 2 });
    expect(mods).toHaveLength(1);
    expect(mods[0].stat).toBe("luck");
  });

  it("returns an empty array for no picks", () => {
    expect(statPickMods({})).toEqual([]);
  });
});
