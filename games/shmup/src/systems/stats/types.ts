/**
 * Stat schema — ground truth for every system that reads or modifies player
 * stats (combat F6, weapons/items F4, hype/ratings F7, economy F9, ...).
 * See specs/games/shmup/stats.spec.md.
 */

/** The 16 stats offered at level-up (economy.spec.todo.md), grouped per design doc. */
export const MAIN_STAT_IDS = [
  // Offense
  "damage",
  "attackSpeed",
  "critChance",
  "critDamage",
  // Defense
  "maxHp",
  "armor",
  "evasion",
  "maxShield",
  "hpRegen",
  "lifesteal",
  // Mobility
  "playerSpeed",
  "reflexes",
  // Economy
  "luck",
  "creditScore",
  "expGain",
  "magnetRadius",
] as const;

/**
 * Exotic stats — never offered at level-up, only granted by weapons/items/shop
 * (stats.spec.md). Still flow through the same StatDef table / computeStats
 * pipeline as the main stats.
 */
export const EXOTIC_STAT_IDS = [
  "pierce",
  "blastRadius",
  "homingStrength",
] as const;

export type MainStatId = (typeof MAIN_STAT_IDS)[number];
export type ExoticStatId = (typeof EXOTIC_STAT_IDS)[number];
export type StatId = MainStatId | ExoticStatId;

export type StatCategory = "offense" | "defense" | "mobility" | "economy" | "exotic";

/**
 * Every stat declares exactly one role/archetype (stats.spec.md):
 * - "unboundedMult" — additive within a category, categories multiply across. Infinite-in-spirit.
 * - "hyperbolic" — x/(x+K); approaches a cap, never reaches it.
 * - "flat" — additive flat value, optionally clamped (geometry caps, regen rates, counts).
 */
export type StatArchetype = "unboundedMult" | "hyperbolic" | "flat";

/** Display unit, used by formatStatValue() — the "formatter" referenced in the spec. */
export type StatUnit = "percent" | "multiplier" | "flat" | "px";

export interface StatDef {
  id: StatId;
  category: StatCategory;
  archetype: StatArchetype;
  /** Default base value, used when a caller's `base` map omits this stat. */
  base: number;
  /** Hyperbolic K constant (effective = raw / (raw + K)). Required when archetype is "hyperbolic". */
  K?: number;
  min?: number;
  max?: number;
  unit: StatUnit;
  /** Human-readable label (level-up offers, debug overlay, item tooltips). */
  display: string;
}

/** A flat add to a stat's base value. */
export interface FlatModifier {
  kind: "flat";
  stat: StatId;
  amount: number;
  /** Item/effect id this came from — for debug overlay / UI provenance, not used by the math. */
  source?: string;
}

/**
 * A percent bonus to a stat, scoped to a category. Within a category, percent
 * bonuses add; across categories, the resulting factors multiply
 * (combat.spec.todo.md's ConditionalMult: "+50% vs ground" + "+25% while grazing" -> x1.5 x x1.25).
 * Omit `category` (defaults to "global") for the common single-pool case, e.g. DamageMult.
 */
export interface PercentModifier {
  kind: "percent";
  stat: StatId;
  category?: string;
  amount: number;
  source?: string;
}

export type StatModifier = FlatModifier | PercentModifier;

export const DEFAULT_CATEGORY = "global";

/** Final effective value per stat, as produced by computeStats(). */
export type StatBlock = Record<StatId, number>;
