import { describe, it, expect } from "vitest";
import { generateShopStock, ownedBrandCounts } from "./shop";
import type { ShopStockInput } from "./shop";
import type { OfferContext } from "./offers";
import type { ItemDef, OwnedItem, OwnedWeapon, WeaponDef } from "../effects";
import { MAX_WEAPON_SLOTS } from "../effects";
import { TUNING } from "../../tuning";

const WEAPON_A: WeaponDef = {
  id: "weapon-a",
  name: "Weapon A",
  brand: "grease-monkey",
  tier: "common",
  firingArc: "forward",
  targetType: "both",
  projectileSpeed: 500,
  scalesWith: ["damage"],
  mods: [],
};

const ITEM_COMMON: ItemDef = {
  id: "item-common",
  name: "Item Common",
  tier: "common",
  mods: [{ kind: "flat", stat: "luck", amount: 0.1 }],
  scalesWith: ["luck"],
};

const ITEM_CAPPED: ItemDef = {
  id: "item-capped",
  name: "Item Capped",
  tier: "common",
  maxStacks: 2,
  mods: [{ kind: "flat", stat: "evasion", amount: 0.02 }],
  scalesWith: ["evasion"],
};

const baseCtx: OfferContext = { luck: 0, D: 0, ratingsRank: 3, ownedBrandCounts: {} };

function input(overrides: Partial<ShopStockInput> = {}): ShopStockInput {
  return {
    weaponPool: [WEAPON_A],
    itemPool: [ITEM_COMMON, ITEM_CAPPED],
    ownedWeapons: [],
    ownedItems: [],
    slotCount: 2,
    ctx: baseCtx,
    ...overrides,
  };
}

describe("generateShopStock", () => {
  it("draws the requested slot count from the combined weapon+item pool", () => {
    const stock = generateShopStock(input({ slotCount: 2, rng: () => 0.99 }));
    expect(stock.length).toBeGreaterThan(0);
    expect(stock.length).toBeLessThanOrEqual(2);
    for (const entry of stock) {
      expect(entry.kind === "weapon" ? entry.weapon?.id : entry.item?.id).toBeDefined();
    }
  });

  it("omits weapons entirely once all chassis slots are full", () => {
    const fullWeapons: OwnedWeapon[] = Array.from({ length: MAX_WEAPON_SLOTS }, () => ({ weapon: WEAPON_A, tier: 0 }));
    const stock = generateShopStock(input({ ownedWeapons: fullWeapons, slotCount: 5, rng: () => 0 }));
    expect(stock.every((entry) => entry.kind === "item")).toBe(true);
  });

  it("stops offering an item once it's at maxStacks", () => {
    const ownedItems: OwnedItem[] = [{ item: ITEM_CAPPED, count: ITEM_CAPPED.maxStacks! }];
    const stock = generateShopStock(input({ ownedItems, itemPool: [ITEM_CAPPED], weaponPool: [], slotCount: 3, rng: () => 0 }));
    expect(stock).toEqual([]);
  });
});

describe("ownedBrandCounts", () => {
  it("counts one per owned weapon slot regardless of upgrade tier", () => {
    const weapons: OwnedWeapon[] = [
      { weapon: WEAPON_A, tier: 0 },
      { weapon: WEAPON_A, tier: 5 },
    ];
    expect(ownedBrandCounts(weapons, [])["grease-monkey"]).toBe(2);
  });

  it("counts the full stack count for owned items", () => {
    const brandedItem: ItemDef = { ...ITEM_COMMON, brand: "masochist" };
    const items: OwnedItem[] = [{ item: brandedItem, count: 4 }];
    expect(ownedBrandCounts([], items)["masochist"]).toBe(4);
  });

  it("ignores unbranded weapons/items", () => {
    expect(ownedBrandCounts([{ weapon: { ...WEAPON_A, brand: undefined }, tier: 0 }], [{ item: ITEM_COMMON, count: 1 }])).toEqual({});
  });
});

describe("TUNING.economy shop slot sizing", () => {
  it("dedicated shop nodes offer more slots than the baseline break shop", () => {
    expect(TUNING.economy.shopNodeSlots).toBeGreaterThan(TUNING.economy.shopBaselineSlots);
  });
});
