/**
 * Tuning module — "tuning is an asset" (specs/tuning.spec.md).
 *
 * The single home of every numeric lever. Systems read values from here by
 * key; nobody hard-codes a magic number. The balance pass and the debug
 * overlay (C12 #151) operate on this object.
 *
 * This is a minimal stub for the scaffold — values are placeholders and the
 * shape will grow as each system lands. Keep it grouped by system to match
 * specs/tuning.spec.md.
 */

export const TUNING = {
  combat: {
    critChance: 0.01,
    critDamage: 0.5,
    evasion: 0.01,
    // hyperbolic K constants, reflex caps, etc. — filled in by F3/combat work
  },
  hype: {
    // hypeBase, k_idle, k_level, baseDecay, M (ScoreMult depth) — F7
  },
  difficulty: {
    seasonCount: 5,
    // seasonBase, episodeRamp, deadlineAdvancePerNode, deadlinePenalty,
    // per-stat curves, per-archetype emphasis, composition thresholds — F8
  },
} as const;
