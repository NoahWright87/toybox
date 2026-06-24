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
  stats: {
    // Base values for stats whose default isn't simply 0 (stats.spec.md).
    damageBase: 1,
    attackSpeedBase: 1,
    maxHpBase: 100,
    playerSpeedBase: 340,
    magnetRadiusBase: 60,
    expGainBase: 1,
  },
  combat: {
    critChance: 0.01,
    critDamage: 0.5,
    evasion: 0.01,
    // Hyperbolic K constants for the two hyperbolic main stats (stats.spec.md).
    // Placeholders — the balance pass tunes these; shape is what F3 locks in.
    evasionK: 0.5,
    armorK: 50,
    // Reflexes is a single unboundedMult stat (its raw value feeds two separate
    // hyperbolic channels — bullets/movement — applied downstream by combat, F6
    // #134), so its K constants live here for F6 to consume, not on the Reflexes
    // StatDef itself.
    reflexBulletK: 1,
    reflexMoveK: 1,
    reflexBulletSlowCap: 0.8,
    reflexMoveSlowCap: 0.5,
  },
  hype: {
    // hypeBase, k_idle, k_level, baseDecay, M (ScoreMult depth) — F7
  },
  difficulty: {
    seasonCount: 5,
    // seasonBase, episodeRamp, deadlineAdvancePerNode, deadlinePenalty,
    // per-stat curves, per-archetype emphasis, composition thresholds — F8
  },
  weapons: {
    // 6 weapon slots/chassis (bullet-heaven default + a hard performance
    // ceiling on worst-case concurrent projectiles) — weapons.spec.todo.md.
    maxWeaponSlots: 6,
    // Gold-upgrade cost curve: cost(tier) = costBase * costGrowth^tier * (1 - brandDiscount).
    upgradeCostBase: 50,
    upgradeCostGrowth: 1.15,
    // brandDiscount = min(brandDiscountCap, brandDiscountPerItem * ownedCount(brand)).
    brandDiscountPerItem: 0.05,
    brandDiscountCap: 0.4,
    // Pierce/bounce/fork/chain/blast -> AvgTargetsHit composition (combat.spec.todo.md).
    // Bounce decays geometrically (retainedFraction^bounceIndex); stop once a
    // bounce's damage fraction drops below the floor, or after maxBounces as
    // a hard safety cap (bounce is unboundedMult and could exceed 100%).
    maxBounces: 8,
    bounceDamageFloor: 0.05,
    // Chain jumps have no dedicated decay stat (stats.spec.md) — each jump
    // deals this flat fraction of HIT until the real combat pass (F6) adds one.
    chainDamageFraction: 1,
    // Blast radius -> extra splash targets is a density placeholder pending
    // F6's real spatial query: avg extra targets = blastRadius * blastTargetsPerPx,
    // each dealt blastDamageFraction of HIT.
    blastTargetsPerPx: 0.01,
    blastDamageFraction: 0.5,
  },
} as const;
