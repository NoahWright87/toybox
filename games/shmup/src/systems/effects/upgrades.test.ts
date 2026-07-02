import { describe, it, expect } from "vitest";
import { weaponModsAtTier, weaponFocusModsAtTier, weaponUpgradeCost, brandDiscount } from "./upgrades";
import { TUNING } from "../../tuning";
import type { WeaponDef } from "./types";

const PEA_SHOOTER: WeaponDef = {
  id: "pea-shooter",
  name: "Pea Shooter",
  brand: "grease-monkey",
  firingArc: "forward",
  targetType: "both",
  projectileSpeed: 600,
  scalesWith: ["damage", "pierce"],
  mods: [
    { base: { kind: "flat", stat: "damage", amount: 5 }, perLevel: 1 },
    { base: { kind: "flat", stat: "pierce", amount: 0, source: "pea-shooter" }, perLevel: 0.5 },
  ],
};

interface ModsAtTierCase {
  name: string;
  given: { tier: number };
  then: { mods: ReturnType<typeof weaponModsAtTier> };
}

const MODS_AT_TIER_CASES: ModsAtTierCase[] = [
  {
    name: "statValue(tier) = base + perLevel * tier per modifier",
    given: { tier: 4 },
    then: {
      mods: [
        { kind: "flat", stat: "damage", amount: 5 + 1 * 4 },
        { kind: "flat", stat: "pierce", amount: 0 + 0.5 * 4, source: "pea-shooter" },
      ],
    },
  },
  {
    name: "tier 0 returns exactly the base modifiers",
    given: { tier: 0 },
    then: {
      mods: [
        { kind: "flat", stat: "damage", amount: 5 },
        { kind: "flat", stat: "pierce", amount: 0, source: "pea-shooter" },
      ],
    },
  },
];

describe("weaponModsAtTier", () => {
  it.each(MODS_AT_TIER_CASES)("$name", ({ given, then }) => {
    expect(weaponModsAtTier(PEA_SHOOTER, given.tier)).toEqual(then.mods);
  });

  it("fractional perLevel accumulates without rounding (qualitative jumps emerge naturally)", () => {
    // +0.5 pierce/level -> "+1" every other upgrade, but the raw value stays fractional here.
    const mods = weaponModsAtTier(PEA_SHOOTER, 1);
    expect(mods[1].amount).toBe(0.5);
  });
});

describe("weaponFocusModsAtTier", () => {
  const FOCUS_RIFLE: WeaponDef = {
    id: "focus-rifle",
    name: "Focus Rifle",
    firingArc: "forward",
    targetType: "both",
    projectileSpeed: 600,
    scalesWith: ["attackSpeed"],
    mods: [{ base: { kind: "flat", stat: "damage", amount: 3 }, perLevel: 1 }],
    // Wide spray unfocused -> a tighter, faster stream while Focus is held (chassis.spec.md).
    focusedMods: [{ base: { kind: "percent", stat: "attackSpeed", amount: 0.3 }, perLevel: 0.05 }],
  };

  it("scales focusedMods by tier the same way weaponModsAtTier scales mods", () => {
    expect(weaponFocusModsAtTier(FOCUS_RIFLE, 4)).toEqual([
      { kind: "percent", stat: "attackSpeed", amount: 0.3 + 0.05 * 4 },
    ]);
  });

  it("returns nothing for a weapon with no focused-fire variant", () => {
    expect(weaponFocusModsAtTier(PEA_SHOOTER, 4)).toEqual([]);
  });
});

interface BrandDiscountCase {
  name: string;
  given: { ownedBrandCount: number };
  then: { discount: number };
}

const BRAND_DISCOUNT_CASES: BrandDiscountCase[] = [
  {
    name: "zero owned contributes no discount",
    given: { ownedBrandCount: 0 },
    then: { discount: 0 },
  },
  {
    name: "scales with owned brand count",
    given: { ownedBrandCount: 1 },
    then: { discount: TUNING.weapons.brandDiscountPerItem },
  },
  {
    name: "never exceeds the discount cap even with a huge owned count",
    given: { ownedBrandCount: 1000 },
    then: { discount: TUNING.weapons.brandDiscountCap },
  },
];

describe("brandDiscount", () => {
  it.each(BRAND_DISCOUNT_CASES)("$name", ({ given, then }) => {
    expect(brandDiscount(given.ownedBrandCount)).toBeCloseTo(then.discount, 10);
  });
});

interface UpgradeCostCase {
  name: string;
  given: { tier: number; ownedBrandCount: number };
  then: { cost: number };
}

const { upgradeCostBase, upgradeCostGrowth } = TUNING.weapons;

const UPGRADE_COST_CASES: UpgradeCostCase[] = [
  {
    name: "cost(0) is exactly costBase with no brand discount",
    given: { tier: 0, ownedBrandCount: 0 },
    then: { cost: upgradeCostBase },
  },
  {
    name: "cost grows exponentially with tier",
    given: { tier: 3, ownedBrandCount: 0 },
    then: { cost: upgradeCostBase * Math.pow(upgradeCostGrowth, 3) },
  },
  {
    name: "the brand discount applies multiplicatively",
    given: { tier: 2, ownedBrandCount: 2 },
    then: { cost: upgradeCostBase * Math.pow(upgradeCostGrowth, 2) * (1 - brandDiscount(2)) },
  },
];

describe("weaponUpgradeCost", () => {
  it.each(UPGRADE_COST_CASES)("$name", ({ given, then }) => {
    expect(weaponUpgradeCost(given.tier, given.ownedBrandCount)).toBeCloseTo(then.cost, 10);
  });

  it("a brand discount strictly lowers the cost relative to no discount", () => {
    const undiscounted = weaponUpgradeCost(2, 0);
    const discounted = weaponUpgradeCost(2, 2);
    expect(discounted).toBeLessThan(undiscounted);
  });
});
