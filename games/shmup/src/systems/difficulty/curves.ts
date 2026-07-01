/**
 * Per-stat curves — "one input, non-uniform response" (run-structure.spec.todo.md).
 * Every curve returns a multiplier: 1 at D=0 (no change from base), growing
 * with D at its own authored rate. HP ramps fast (linear + quadratic term),
 * damage ramps slow (sqrt), so HP pools grow much faster than the damage
 * that has to chew through them as a run goes on.
 */
import { TUNING } from "../../tuning";

/** Fast ramp: HP pools balloon at high D so fights get longer, not just deadlier. */
export function hpCurve(D: number): number {
  const d = Math.max(0, D);
  return 1 + TUNING.difficulty.hpCurveLinearPerD * d + TUNING.difficulty.hpCurveQuadPerD * d * d;
}

/** Slow ramp: damage per hit trails HP badly, keeping fights survivable at high D. */
export function dmgCurve(D: number): number {
  const d = Math.max(0, D);
  return 1 + TUNING.difficulty.dmgCurvePerSqrtD * Math.sqrt(d);
}

export function speedCurve(D: number): number {
  return 1 + TUNING.difficulty.speedCurvePerD * Math.max(0, D);
}

export function fireRateCurve(D: number): number {
  return 1 + TUNING.difficulty.fireRateCurvePerD * Math.max(0, D);
}

/**
 * Density: fractional multiplier on spawn interval — smaller is denser.
 * Clamped so spawns never go below densityCurveMaxReduction of the base rate.
 */
export function densityCurve(D: number): number {
  const reduction = Math.min(
    TUNING.difficulty.densityCurveMaxReduction,
    TUNING.difficulty.densityCurvePerD * Math.max(0, D)
  );
  return 1 - reduction;
}

/** Reward scaling: D also scales rewards (gold/EXP — harder = richer). */
export function rewardCurve(D: number): number {
  return 1 + TUNING.difficulty.rewardCurvePerD * Math.max(0, D);
}

/** rarityLuck = Luck + luckFromD * D (items-and-brands.spec.todo.md) — a Luck-like rarity boost to offers. */
export function rarityLuck(luck: number, D: number): number {
  return luck + TUNING.difficulty.luckFromD * Math.max(0, D);
}
