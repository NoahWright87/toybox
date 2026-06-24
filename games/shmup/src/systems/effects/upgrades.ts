/**
 * Gold-based weapon upgrades (weapons.spec.todo.md): tiered, no tier cap,
 * exponentially scaling cost is the practical ceiling. Brand commitment
 * makes upgrades cheaper, capped, via `TUNING.weapons.brandDiscountCap`.
 */
import { TUNING } from "../../tuning";
import type { StatModifier } from "../stats";
import type { WeaponDef } from "./types";

/**
 * statValue(tier) = base + perLevel * tier, applied per scaling modifier.
 * Fractional `perLevel` accumulates in the returned `amount` — rounding for
 * display/effect is the caller's job (weapons.spec.todo.md), not this engine's.
 */
export function weaponModsAtTier(weapon: WeaponDef, tier: number): StatModifier[] {
  return weapon.mods.map(({ base, perLevel }) => ({
    ...base,
    amount: base.amount + perLevel * tier,
  }));
}

/** brandDiscount = min(cap, perItem * ownedCount(brand)) (weapons.spec.todo.md). */
export function brandDiscount(ownedBrandCount: number): number {
  const { brandDiscountPerItem, brandDiscountCap } = TUNING.weapons;
  return Math.min(brandDiscountCap, brandDiscountPerItem * Math.max(0, ownedBrandCount));
}

/**
 * cost(tier) = costBase * costGrowth^tier * (1 - brandDiscount) — the next
 * upgrade's price, i.e. the cost to go from `tier` to `tier + 1`. costBase/
 * costGrowth are the single shared cost curve in `TUNING.weapons`
 * (tuning.spec.todo.md lists them as tuning-module levers, not per-weapon).
 * `ownedBrandCount` is the player's count of distinct brand items owned
 * across weapons/items (items-and-brands.spec.todo.md's brand affinity),
 * not this weapon's own tier.
 */
export function weaponUpgradeCost(tier: number, ownedBrandCount = 0): number {
  const { upgradeCostBase, upgradeCostGrowth } = TUNING.weapons;
  const discount = brandDiscount(ownedBrandCount);
  return upgradeCostBase * Math.pow(upgradeCostGrowth, tier) * (1 - discount);
}
