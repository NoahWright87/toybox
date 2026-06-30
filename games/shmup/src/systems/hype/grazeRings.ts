/**
 * Concentric graze rings (hype-and-ratings.spec.md, F7 #135). Rings are
 * fractions of the grazeRadius stat; only the innermost ring a bullet falls
 * within applies — no stacking multiple rings against one bullet.
 */
import type { GrazeRingDef } from "./types";

/**
 * Returns the highest-payout ring containing `distance`, or undefined if
 * outside every ring (not grazing). Scans for the smallest-`frac` (innermost)
 * containing ring rather than sorting, since this runs once per bullet per
 * frame and ring order in the input array doesn't matter.
 */
export function grazeRingAt(
  distance: number,
  grazeRadius: number,
  rings: readonly GrazeRingDef[],
): GrazeRingDef | undefined {
  if (grazeRadius <= 0 || distance < 0) return undefined;
  let best: GrazeRingDef | undefined;
  for (const ring of rings) {
    if (distance <= grazeRadius * ring.frac && (!best || ring.frac < best.frac)) {
      best = ring;
    }
  }
  return best;
}

/** Hype-gain rate (per second) for grazing at `ring`, scaled by the grazeMultiplier stat. */
export function grazeHypeGainPerSecond(
  ring: GrazeRingDef,
  grazeMultiplier: number,
  baseGainPerSecond: number,
): number {
  return baseGainPerSecond * ring.mult * grazeMultiplier;
}
