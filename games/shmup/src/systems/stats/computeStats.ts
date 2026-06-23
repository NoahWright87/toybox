/**
 * Pure stat computation (stats.spec.md). Fixed pipeline per stat:
 *   flat adds -> sum additive % per category -> multiply categories
 *   -> archetype transform (hyperbolic, if applicable) -> clamp.
 *
 * No randomness, no I/O, no mutation of inputs — same inputs always produce
 * the same StatBlock. Callers own the caching cadence: persistentMods should
 * be recomputed only when something changes (pickup, upgrade); transientMods
 * layer on top and are expected to be recomputed on every condition flip
 * (e.g. start/stop grazing), not every frame.
 */
import { STAT_DEFS } from "./statDefs";
import { DEFAULT_CATEGORY } from "./types";
import type { StatBlock, StatDef, StatId, StatModifier } from "./types";

/**
 * Base + flat adds, run through the categories-multiply step, BEFORE the
 * archetype-specific transform. Exposed for systems that need the raw
 * accumulated value rather than computeStats()'s fully-transformed output —
 * e.g. Reflexes feeds two separate hyperbolic channels (bullets/movement)
 * with their own K constants, applied downstream by combat (F6 #134).
 */
export function aggregateRaw(
  statId: StatId,
  base: Partial<StatBlock>,
  mods: readonly StatModifier[]
): number {
  const def = STAT_DEFS[statId];
  const baseValue = base[statId] ?? def.base;

  let flatSum = 0;
  const percentByCategory = new Map<string, number>();

  for (const mod of mods) {
    if (mod.stat !== statId) continue;
    if (mod.kind === "flat") {
      flatSum += mod.amount;
    } else {
      const category = mod.category ?? DEFAULT_CATEGORY;
      percentByCategory.set(category, (percentByCategory.get(category) ?? 0) + mod.amount);
    }
  }

  let categoryMult = 1;
  for (const sum of percentByCategory.values()) {
    categoryMult *= 1 + sum;
  }
  return (baseValue + flatSum) * categoryMult;
}

function applyArchetype(def: StatDef, raw: number): number {
  let value = raw;
  if (def.archetype === "hyperbolic") {
    const K = def.K ?? 1;
    value = raw <= 0 ? 0 : raw / (raw + K);
  }
  if (def.min !== undefined) value = Math.max(def.min, value);
  if (def.max !== undefined) value = Math.min(def.max, value);
  return value;
}

/**
 * computeStats(base, persistentMods, transientMods) — the two modifier layers
 * are concatenated and run through the identical pipeline; "persistent" vs
 * "transient" is purely a caching-cadence distinction for the caller, not a
 * difference in math.
 */
export function computeStats(
  base: Partial<StatBlock> = {},
  persistentMods: readonly StatModifier[] = [],
  transientMods: readonly StatModifier[] = []
): StatBlock {
  const mods = [...persistentMods, ...transientMods];
  const result = {} as StatBlock;
  for (const statId of Object.keys(STAT_DEFS) as StatId[]) {
    const raw = aggregateRaw(statId, base, mods);
    result[statId] = applyArchetype(STAT_DEFS[statId], raw);
  }
  return result;
}
