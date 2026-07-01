/**
 * Reroll costs (economy.spec.todo.md), shared by level-up picks and shop
 * visits: increasing gold per reroll within one visit; a high Ratings tier
 * comps a few free rerolls (fame perk). Hype is never spent as currency.
 */
import { TUNING } from "../../tuning";

/** Gold cost of the Nth *paid* reroll this visit (0-based, after any free allowance is used up). */
export function rerollCost(paidRerollIndex: number): number {
  const { rerollCostBase, rerollCostGrowth } = TUNING.economy;
  return rerollCostBase * Math.pow(rerollCostGrowth, Math.max(0, paidRerollIndex));
}

/** Free reroll allowance this visit, from the player's current Ratings tier rank (0 = Nobody .. 7 = Kevin Bacon). */
export function freeRerollAllowance(ratingsRank: number): number {
  const table = TUNING.economy.freeRerollsByRatingsRank;
  const idx = Math.min(table.length - 1, Math.max(0, Math.floor(ratingsRank)));
  return table[idx];
}

/**
 * Gold cost of the next reroll, given how many rerolls (free + paid) already
 * happened this visit. The first `freeRerollAllowance(ratingsRank)` rerolls
 * of a visit are free; every one after that follows the increasing curve
 * above, restarting from `rerollCost(0)`.
 */
export function nextRerollCost(rerollsUsedThisVisit: number, ratingsRank: number): number {
  const allowance = freeRerollAllowance(ratingsRank);
  if (rerollsUsedThisVisit < allowance) return 0;
  return rerollCost(rerollsUsedThisVisit - allowance);
}
