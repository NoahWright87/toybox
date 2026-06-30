/**
 * Concentric graze rings (hype-and-ratings.spec.md, F7 #135). Rings are
 * fractions of the grazeRadius stat; only the innermost ring a bullet falls
 * within applies — no stacking multiple rings against one bullet.
 */
import type { GrazeRingDef } from "./types";

/**
 * Returns the highest-payout ring containing `distance`, or undefined if
 * outside every ring (not grazing). Rings are sorted ascending by `frac` so
 * the innermost (smallest radius, highest mult) match wins first.
 */
export function grazeRingAt(
  distance: number,
  grazeRadius: number,
  rings: readonly GrazeRingDef[],
): GrazeRingDef | undefined {
  if (grazeRadius <= 0 || distance < 0) return undefined;
  const sorted = [...rings].sort((a, b) => a.frac - b.frac);
  for (const ring of sorted) {
    if (distance <= grazeRadius * ring.frac) return ring;
  }
  return undefined;
}

/** Hype-gain rate (per second) for grazing at `ring`, scaled by the grazeMultiplier stat. */
export function grazeHypeGainPerSecond(
  ring: GrazeRingDef,
  grazeMultiplier: number,
  baseGainPerSecond: number,
): number {
  return baseGainPerSecond * ring.mult * grazeMultiplier;
}
