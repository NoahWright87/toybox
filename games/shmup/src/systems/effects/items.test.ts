import { describe, it, expect } from "vitest";
import { itemModsForOwned } from "./items";
import type { ItemDef, OwnedItem } from "./types";

const SPEED_TONIC: ItemDef = {
  id: "speed-tonic",
  name: "Speed Tonic",
  mods: [{ kind: "flat", stat: "playerSpeed", amount: 10 }],
  scalesWith: ["playerSpeed"],
};

const LUCKY_CHARM: ItemDef = {
  id: "lucky-charm",
  name: "Lucky Charm",
  mods: [{ kind: "percent", stat: "evasion", amount: 0.05 }],
  maxStacks: 3,
  scalesWith: ["evasion"],
};

describe("itemModsForOwned", () => {
  it("uncapped items scale linearly with count (unlimited slots, no cap)", () => {
    const owned: OwnedItem = { item: SPEED_TONIC, count: 4 };
    expect(itemModsForOwned(owned)).toEqual([{ kind: "flat", stat: "playerSpeed", amount: 40 }]);
  });

  it("a single copy returns the bundle's mods unscaled", () => {
    const owned: OwnedItem = { item: SPEED_TONIC, count: 1 };
    expect(itemModsForOwned(owned)).toEqual(SPEED_TONIC.mods);
  });

  it("clamps stacking at maxStacks once exceeded", () => {
    const atCap: OwnedItem = { item: LUCKY_CHARM, count: 3 };
    const overCap: OwnedItem = { item: LUCKY_CHARM, count: 10 };
    expect(itemModsForOwned(overCap)).toEqual(itemModsForOwned(atCap));
    expect(itemModsForOwned(atCap)[0].amount).toBeCloseTo(0.15, 10);
  });

  it("zero copies contributes nothing", () => {
    expect(itemModsForOwned({ item: SPEED_TONIC, count: 0 })).toEqual([
      { kind: "flat", stat: "playerSpeed", amount: 0 },
    ]);
  });
});
