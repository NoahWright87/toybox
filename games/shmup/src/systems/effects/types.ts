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
  /**
   * Per-weapon authored property (weapons.spec.todo.md): when a shot's pierce
   * exceeds 100%, the overflow forks into a new projectile carrying
   * `(pierce - 100%) * pierceDecay`. Defaults to `TUNING.weapons.defaultPierceDecay`
   * when omitted; always clamped to `TUNING.weapons.maxPierceDecay` so forking
   * can't runaway. Low values (a slug-throwing weapon) discourage forking and
   * stay single-target; high values (chain lightning) lean into forking hard.
   */
  pierceDecay?: number;
  /**
   * Per-weapon authored property: a forked line's heading (when Pierce
   * overflows past 100%) is drawn from a cone of this full width, in
   * degrees, around the forking bullet's heading at the moment of impact —
   * not fully at random. Defaults to `TUNING.weapons.defaultForkConeDeg`
   * when omitted. A narrow cone keeps forks reading as "this weapon, but
   * more of it"; a wide one sprays them.
   */
  forkConeDeg?: number;
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
 * Per-projectile behavior produced by decomposing Pierce (weapons.spec.todo.md):
 * at or below 100% pierce, damage decays per impact along a single line; above
 * 100%, the overflow forks into additional full-damage lines. This is the pure
 * damage-decay math only — real targeting, rotation, and per-enemy hit-list
 * bookkeeping against actual entities is F6's job, not this engine's.
 */
export interface ProjectileBehavior {
  /**
   * Count of additional lines spawned by forking, each dealing full
   * (undecayed) damage forever along its own path. A count only — F6 decides
   * how many real targets each line actually hits.
   */
  flatLineCount: number;
  /**
   * Damage fraction (relative to one full-damage HIT) for the one remaining
   * line's successive impacts, in order. Always starts with the guaranteed
   * first hit (1); decays toward 0 as pierce is spent.
   */
  tailHitFractions: number[];
  /**
   * Extra splash targets per impact from blast radius, on top of the line(s)
   * above. A density-based expectation (`TUNING.weapons.blastTargetsPerPx`),
   * not a discrete count — placeholder pending F6's real spatial query.
   */
  blastBonusTargetsPerHit: number;
  /** Damage fraction (relative to one full-damage HIT) each blast-bonus target takes. */
  blastDamageFraction: number;
}
