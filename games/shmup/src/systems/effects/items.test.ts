import { describe, it, expect } from "vitest";
import { itemModsForOwned } from "./items";
import type { ItemDef, OwnedItem } from "./types";

const speedTonic: ItemDef = {
  id: "speed-tonic",
  name: "Speed Tonic",
  mods: [{ kind: "flat", stat: "playerSpeed", amount: 10 }],
  scalesWith: ["playerSpeed"],
};

const luckyCharmMax3: ItemDef = {
  id: "lucky-charm",
  name: "Lucky Charm",
  mods: [{ kind: "percent", stat: "evasion", amount: 0.05 }],
  maxStacks: 3,
  scalesWith: ["evasion"],
};

interface Case {
  name: string;
  given: { item: ItemDef; ownedCount: number };
  then: { resultAmount: number };
}

const CASES: Case[] = [
  {
    name: "uncapped item scales linearly with owned count",
    given: { item: speedTonic, ownedCount: 4 },
    then: { resultAmount: 40 },
  },
  {
    name: "a single copy returns the bundle's mod unscaled",
    given: { item: speedTonic, ownedCount: 1 },
    then: { resultAmount: 10 },
  },
  {
    name: "stacking clamps at maxStacks",
    given: { item: luckyCharmMax3, ownedCount: 3 },
    then: { resultAmount: 0.15 },
  },
  {
    name: "owning more than maxStacks still clamps at maxStacks",
    given: { item: luckyCharmMax3, ownedCount: 10 },
    then: { resultAmount: 0.15 },
  },
  {
    name: "zero copies contributes nothing",
    given: { item: speedTonic, ownedCount: 0 },
    then: { resultAmount: 0 },
  },
];

describe("itemModsForOwned", () => {
  it.each(CASES)("$name", ({ given, then }) => {
    const owned: OwnedItem = { item: given.item, count: given.ownedCount };
    const [mod] = itemModsForOwned(owned);
    expect(mod.amount).toBeCloseTo(then.resultAmount, 10);
  });
});
