/**
 * Retro timing utilities — jank on demand.
 * Used by the boot screen and the NS Doors 97 desktop startup sequence.
 * All functions are tunable via options so every use-site can dial in its
 * own feel without duplicating the core logic.
 */

// ── Random delay ───────────────────────────────────────────────────────────

export interface RandomDelayOpts {
  /** Average wait in ms (default: 400) */
  base?: number;
  /** Fractional variance: actual range is base±(base*variance) (default: 0.5) */
  variance?: number;
  /** Probability of a scary-long "panic" delay (default: 0.05) */
  panicChance?: number;
  /** How many times longer a panic delay is vs. base (default: 7) */
  panicMultiplier?: number;
}

/**
 * Returns a random delay in ms.
 * Occasionally (panicChance) returns a much longer value for that
 * "oh god is it frozen?" 90s computer experience.
 */
export function randomDelay({
  base = 400,
  variance = 0.5,
  panicChance = 0.05,
  panicMultiplier = 7,
}: RandomDelayOpts = {}): number {
  if (Math.random() < panicChance) {
    return Math.round(base * panicMultiplier * (0.7 + Math.random() * 0.6));
  }
  const lo = base * (1 - variance);
  const hi = base * (1 + variance);
  return Math.round(lo + Math.random() * (hi - lo));
}

// ── Chunky increment ───────────────────────────────────────────────────────

export interface ChunkIncrementOpts {
  /** Average amount to add per step (default: 5) */
  avgChunk?: number;
  /** Probability of a "crit" — a much bigger jump (default: 0.1) */
  critChance?: number;
  /** Multiplier applied to avgChunk on a crit (default: 4) */
  critMultiplier?: number;
}

/**
 * Returns a semi-random increment value.
 * Occasionally crits for a large jump, giving that satisfying "whoosh"
 * when the loading bar suddenly leaps forward.
 */
export function chunkIncrement({
  avgChunk = 5,
  critChance = 0.1,
  critMultiplier = 4,
}: ChunkIncrementOpts = {}): number {
  const isCrit = Math.random() < critChance;
  const base = avgChunk * (isCrit ? critMultiplier : 1);
  return base * (0.4 + Math.random() * 1.2);
}

// ── Cancellable sleep ──────────────────────────────────────────────────────

/**
 * Returns a sleep function tied to a cancel ref.
 * If cancelRef.current is true when the timeout fires, the promise rejects
 * with a 'cancelled' error so async sequences can clean up cleanly.
 */
export function makeSleep(cancelRef: { current: boolean }) {
  return function sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (cancelRef.current) { reject(new Error("cancelled")); return; }
      setTimeout(() => {
        if (cancelRef.current) reject(new Error("cancelled"));
        else resolve();
      }, ms);
    });
  };
}
