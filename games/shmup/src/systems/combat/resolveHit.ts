/**
 * Damage-per-hit (combat.spec.todo.md):
 *   HIT = (Base + Flat) x DamageMult x CritFactor x ConditionalMult
 *
 * stats.damage (an "unboundedMult" F3 stat — see stats.spec.md) already
 * folds (Base + Flat) x DamageMult: TUNING.stats.damageBase is the Base,
 * weapon/item flat mods are the Flat, and percent mods are DamageMult's
 * additive-within-category / multiplicative-across-category pool. This
 * module applies the one piece `special(crit, DR)` explicitly defers to
 * combat: the crit roll. ConditionalMult stays at 1 until a conditional-tag
 * system (e.g. "+50% vs ground") exists; no system in this repo grants one
 * yet.
 */
import type { DamageStats } from "./types";

export interface CritRoll {
  numCrits: number;
  critFactor: number;
}

/**
 * NumCrits = floor(CritChance) + (rand() < frac(CritChance) ? 1 : 0)
 * CritFactor = (1 + CritDamage) ^ NumCrits
 * Crit chance is uncapped (stats.spec.md) — 250% is 2 guaranteed crits plus
 * a 50% chance of a 3rd, not clamped to 100%.
 */
export function rollCrit(critChance: number, critDamage: number, rng: () => number = Math.random): CritRoll {
  const guaranteed = Math.floor(critChance);
  const frac = critChance - guaranteed;
  const numCrits = guaranteed + (rng() < frac ? 1 : 0);
  const critFactor = Math.pow(1 + critDamage, numCrits);
  return { numCrits, critFactor };
}

/**
 * Resolved once per shot fired (weapons.spec.todo.md: "Crit is resolved once
 * per shot fired, baked into the base HIT upstream... never re-rolled per
 * pierce impact or per fork") — callers fire this once per shot and reuse
 * the result for every line/fork that shot produces.
 */
export function resolveHit(stats: DamageStats, rng: () => number = Math.random): number {
  const { critFactor } = rollCrit(stats.critChance, stats.critDamage, rng);
  return stats.damage * critFactor;
}
