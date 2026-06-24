/**
 * Data shapes for the effect-composition engine (weapons.spec.todo.md,
 * items-and-brands.spec.todo.md, F4 #132). Weapons and items are DATA
 * consumed by this engine — adding content never touches engine code.
 * Reads exclusively from the F3 stat schema (`../stats`); introduces no
 * parallel stat definitions.
 */
import type { BrandId } from "../../content/brands";
import type { StatId, StatModifier } from "../stats";

/** Where a weapon fires relative to the ship (weapons.spec.todo.md). */
export type FiringArc = "forward" | "behind" | "sides";

/** Which enemy classes a weapon can hit — gates which weapons matter. */
export type TargetType = "ground" | "air" | "both";

/**
 * A modifier whose amount grows with weapon tier:
 *   statValue(tier) = base.amount + perLevel * tier
 * `base` fixes kind/stat/category/source across tiers; only `amount` scales.
 * Fractional `perLevel` is intentional (weapons.spec.todo.md) — qualitative
 * jumps emerge from fractional bonuses crossing an integer, not a separate
 * milestone mechanic.
 */
export interface ScalingModifier {
  base: StatModifier;
  perLevel: number;
}

/**
 * A weapon is data: a base type + attached modifiers, firing arc, target
 * type, and per-stat scaling for the explicit-display contract
 * (weapons.spec.todo.md). Tiered gold upgrades read `mods` via
 * `systems/effects/upgrades.ts` against the shared cost curve in
 * `TUNING.weapons` (`upgradeCostBase`/`upgradeCostGrowth`) — there is no
 * tier cap; only `brand` differentiates a weapon's discount.
 */
export interface WeaponDef {
  id: string;
  name: string;
  brand?: BrandId;
  firingArc: FiringArc;
  targetType: TargetType;
  /** Per-weapon authored property — projectile speed is NOT a player stat (stats.spec.md). */
  projectileSpeed: number;
  /** Stats this weapon's tooltip should display itself scaling with. */
  scalesWith: StatId[];
  mods: ScalingModifier[];
}

/**
 * An item is data: a passive modifier bundle over the shared stat pool
 * (items-and-brands.spec.todo.md). No upgrade mechanic — items stack by
 * owning more copies, capped by `maxStacks` when present.
 */
export interface ItemDef {
  id: string;
  name: string;
  brand?: BrandId;
  mods: StatModifier[];
  maxStacks?: number;
  scalesWith: StatId[];
}

/** A weapon owned in one of the chassis's weapon slots, at a given upgrade tier. */
export interface OwnedWeapon {
  weapon: WeaponDef;
  tier: number;
}

/** An item owned in some quantity (unlimited item slots — items-and-brands.spec.todo.md). */
export interface OwnedItem {
  item: ItemDef;
  count: number;
}

/**
 * Per-projectile behavior produced by composing pierce/bounce/fork/chain/
 * blast (weapons.spec.todo.md) — feeds `AvgTargetsHit` in the DPS formula
 * (combat.spec.todo.md), never `HIT` itself.
 */
export interface ProjectileBehavior {
  /**
   * Damage fraction (relative to one full-damage HIT) delivered to each
   * discrete target, in hit order, for one fired projectile — already
   * expanded for fork's parallel copies.
   */
  hitFractions: number[];
  /**
   * Average extra targets caught by blast splash on top of `hitFractions`.
   * A density-based expectation (`TUNING.weapons.blastTargetsPerPx`), not a
   * discrete count — placeholder pending F6's real spatial query.
   */
  blastBonusTargets: number;
  /** combat.spec.todo.md's AvgTargetsHit for this projectile. */
  avgTargetsHit: number;
  /** Total damage-fraction throughput across all targets, relative to one HIT. */
  totalDamageFraction: number;
}
