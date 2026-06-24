import { describe, it, expect } from "vitest";
import { weaponModsAtTier, weaponUpgradeCost, brandDiscount } from "./upgrades";
import { TUNING } from "../../tuning";
import type { WeaponDef } from "./types";

const PEA_SHOOTER: WeaponDef = {
  id: "pea-shooter",
  name: "Pea Shooter",
  brand: "grease-monkey",
  firingArc: "forward",
  targetType: "both",
  projectileSpeed: 600,
  scalesWith: ["damage", "fork"],
  mods: [
    { base: { kind: "flat", stat: "damage", amount: 5 }, perLevel: 1 },
    { base: { kind: "flat", stat: "fork", amount: 0, source: "pea-shooter" }, perLevel: 0.5 },
  ],
};

describe("weaponModsAtTier", () => {
  it("statValue(tier) = base + perLevel * tier per modifier", () => {
    const mods = weaponModsAtTier(PEA_SHOOTER, 4);
    expect(mods).toEqual([
      { kind: "flat", stat: "damage", amount: 5 + 1 * 4 },
      { kind: "flat", stat: "fork", amount: 0 + 0.5 * 4, source: "pea-shooter" },
    ]);
  });

  it("tier 0 returns exactly the base modifiers", () => {
    expect(weaponModsAtTier(PEA_SHOOTER, 0)).toEqual([
      { kind: "flat", stat: "damage", amount: 5 },
      { kind: "flat", stat: "fork", amount: 0, source: "pea-shooter" },
    ]);
  });

  it("fractional perLevel accumulates without rounding (qualitative jumps emerge naturally)", () => {
    // +0.5 fork/level -> "+1" every other upgrade, but the raw value stays fractional here.
    const mods = weaponModsAtTier(PEA_SHOOTER, 1);
    expect(mods[1].amount).toBe(0.5);
  });
});

describe("brandDiscount", () => {
  it("scales with owned brand count up to the cap", () => {
    expect(brandDiscount(0)).toBe(0);
    expect(brandDiscount(1)).toBeCloseTo(TUNING.weapons.brandDiscountPerItem, 10);
  });

  it("never exceeds brandDiscountCap even with a huge owned count", () => {
    expect(brandDiscount(1000)).toBe(TUNING.weapons.brandDiscountCap);
  });
});

describe("weaponUpgradeCost", () => {
  it("cost(0) is exactly costBase with no brand discount", () => {
    expect(weaponUpgradeCost(0, 0)).toBe(TUNING.weapons.upgradeCostBase);
  });

  it("grows exponentially with tier", () => {
    const { upgradeCostBase, upgradeCostGrowth } = TUNING.weapons;
    expect(weaponUpgradeCost(3, 0)).toBeCloseTo(upgradeCostBase * Math.pow(upgradeCostGrowth, 3), 10);
  });

  it("applies the brand discount multiplicatively", () => {
    const undiscounted = weaponUpgradeCost(2, 0);
    const discounted = weaponUpgradeCost(2, 2);
    expect(discounted).toBeCloseTo(undiscounted * (1 - brandDiscount(2)), 10);
    expect(discounted).toBeLessThan(undiscounted);
  });
});
