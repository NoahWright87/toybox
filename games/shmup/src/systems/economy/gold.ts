/**
 * Gold economy (economy.spec.todo.md): physical, skill-gated wealth. Credit
 * Score does double duty — it scales both interest (this module) and fresh
 * gold gain on every coin caught — rather than adding a 17th main stat.
 */
import { TUNING } from "../../tuning";

/** goldGainMult(creditScore) — creditScore is a raw additive fraction (base 0), same convention as Luck feeding rarityLuck. */
export function goldGainMult(creditScore: number): number {
  return 1 + TUNING.economy.creditScoreGoldGainScale * Math.max(0, creditScore);
}

/** One coin's banked value once caught, scaled by the player's gold-gain (Credit Score). */
export function coinValue(baseValue: number, creditScore: number): number {
  return baseValue * goldGainMult(creditScore);
}

/** Interest rate this break, scaled by Credit Score. */
export function interestRate(creditScore: number): number {
  const { interestBaseRate, interestCreditScoreScale } = TUNING.economy;
  return interestBaseRate * (1 + interestCreditScoreScale * Math.max(0, creditScore));
}

/** Interest earned on the current bank this break — caller adds it to the bank (or use `applyInterest` directly). */
export function interestEarned(bankedGold: number, creditScore: number): number {
  return Math.max(0, bankedGold) * interestRate(creditScore);
}

/** Applies one break's interest, clamped at the (effectively-off) cap — "hoarding to compound" (economy.spec.todo.md). */
export function applyInterest(bankedGold: number, creditScore: number): number {
  return Math.min(TUNING.economy.goldCap, bankedGold + interestEarned(bankedGold, creditScore));
}

/** Whether this kill also throws a bonus "tip" coin onto the field — the crowd rewarding high-Hype play. */
export function rollsTip(hypeFrac: number, rng: () => number = Math.random): boolean {
  return hypeFrac >= TUNING.economy.tipsHypeThreshold && rng() < TUNING.economy.tipsChance;
}
