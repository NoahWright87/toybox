/**
 * Level-up stat picks (economy.spec.todo.md's hard rule): each pick offers 4
 * MAIN stats only, uniform random — no Luck/Ratings/brand weighting (that's
 * the item/weapon offer system, `./offers.ts`). Reroll just draws a fresh
 * uniform 4; exotic stats never appear here (stats.spec.md).
 */
import { TUNING } from "../../tuning";
import { MAIN_STAT_IDS } from "../stats";
import type { MainStatId, StatModifier } from "../stats";

/** Picks `count` distinct main stats uniformly at random (no replacement within one offer). */
export function rollLevelUpOffers(
  count: number = TUNING.economy.levelUpOfferCount,
  rng: () => number = Math.random
): MainStatId[] {
  const pool = [...MAIN_STAT_IDS];
  const picked: MainStatId[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

/** The flat StatModifier granted by picking `stat` once (TUNING.economy.mainStatPickAmount's per-pick sizing). */
export function mainStatPickModifier(stat: MainStatId): StatModifier {
  return { kind: "flat", stat, amount: TUNING.economy.mainStatPickAmount[stat], source: "levelup" };
}

/** Persistent mods for a whole career's worth of level-up picks (CareerState.statPicks -> StatModifier[] for resolveLoadout). */
export function statPickMods(picks: Partial<Record<MainStatId, number>>): StatModifier[] {
  return (Object.entries(picks) as [MainStatId, number][])
    .filter(([, count]) => count > 0)
    .map(([stat, count]) => ({
      kind: "flat" as const,
      stat,
      amount: TUNING.economy.mainStatPickAmount[stat] * count,
      source: "levelup",
    }));
}
