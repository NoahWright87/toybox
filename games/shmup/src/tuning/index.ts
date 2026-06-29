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
    // Focus (chassis.spec.todo.md): hold to move slower for precision. The
    // default chassis (F10 #138) hasn't landed yet, so F6 ships the
    // universal base behavior plus a hitbox shrink (genre-standard "graze
    // box") as the vertical-slice default; a future chassis quirk may
    // override hitboxRadiusFocus instead of relying on this global.
    focusSpeedMult: 0.45,
    hitboxRadiusNormal: 6,
    hitboxRadiusFocus: 3,
    // Shield (combat.spec.todo.md): "auto-refills after ShieldDelay s without
    // a hit, at ShieldRegen/s." Shield regen rate isn't one of the 16 main
    // stats, so its rate lives here as a fraction of Max Shield per second.
    shieldRegenDelay: 3,
    shieldRegenFracPerSecond: 0.25,
    // Brief invulnerability after any non-dodged hit — without this, an
    // overlapping enemy/bullet would re-deal damage every physics step.
    playerIFrameMs: 500,
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
    // Pierce -> projectile-behavior decomposition (weapons.spec.todo.md): at or
    // below 100%, each impact multiplies remaining damage by the pierce ratio,
    // stopping once the fraction drops below the floor; above 100%, the
    // overflow forks into a new full-damage line carrying
    // (pierce - 100%) * pierceDecay. pierceDecay is authored per-weapon
    // (WeaponDef.pierceDecay) and defaults/clamps to the values below.
    pierceTailDamageFloor: 0.01,
    defaultPierceDecay: 0.5,
    // Never let an authored pierceDecay reach/exceed 95% — keeps the fork
    // chain converging quickly regardless of how high pierce is stacked.
    maxPierceDecay: 0.95,
    // Fork heading spread (weapons.spec.todo.md follow-up): a forked line's
    // heading is drawn from a cone around the bullet's heading at the
    // moment it forked (not fully random), full width in degrees.
    // Authored per-weapon (WeaponDef.forkConeDeg), defaulting to this value
    // when omitted.
    defaultForkConeDeg: 60,
    // Hard safety caps against pathological stat stacking — not meaningful
    // gameplay limits, just backstops against unbounded array growth.
    maxForksPerImpact: 1000,
    maxTailHits: 100,
    // Blast radius -> extra splash targets is a density placeholder pending
    // F6's real spatial query: avg extra targets = blastRadius * blastTargetsPerPx,
    // each dealt blastDamageFraction of HIT.
    blastTargetsPerPx: 0.01,
    blastDamageFraction: 0.5,
    // Auto-fire cadence at attackSpeed = 1 (shots/second); actual cadence is
    // baseFireRate * stats.attackSpeed (combat.spec.todo.md: "weapons fire
    // on their own cadence (attack speed)").
    baseFireRate: 2.5,
    // F6 performance ceilings (weapons.spec.todo.md's "hard performance
    // ceiling that bounds worst-case concurrent projectiles") — the engine's
    // own maxForksPerImpact/maxTailHits guard the pure math; these guard the
    // actual pooled bullets a single shot is allowed to spawn/keep piercing.
    maxForkedBulletsPerShot: 12,
    maxHitsPerInfiniteBullet: 50,
  },
  // Homing (F6 #134's exotic Homing Strength stat). A bullet only seeks
  // within a circle that leads it along its current heading — center =
  // bullet position + heading * radius, so the near edge sits at the
  // bullet's nose and the far edge is 2x radius ahead. This guarantees a
  // homing bullet never locks onto (and U-turns into) something it just
  // flew past. Once locked, it keeps turning toward that target until it
  // dies — no re-targeting mid-flight. Pierce decays Homing Strength the
  // same way it decays damage: a pierced bullet's remaining hits use
  // homingStrength * the same tailHitFraction applied to damage; forked
  // "infinite" lines don't decay damage, so they don't decay homing either.
  homing: {
    // 100% Homing Strength scans this many seconds of travel ahead (scaled
    // by the firing weapon's own projectile speed, so fast and slow weapons
    // get a proportionally sane circle instead of one fixed pixel radius).
    seekAheadSeconds: 0.35,
    // Hard cap regardless of how high Homing Strength is stacked.
    maxRadiusPx: 280,
    // Turn rate once locked scales linearly with Homing Strength, capped
    // well short of an instant snap-to-target even at extreme values.
    turnRateDegPerSecPerStrength: 180,
    maxTurnRateDegPerSec: 360,
  },
  // Object-pool ceilings (F6 #134: "Arcade Physics groups with object
  // pooling for bullets and enemies"). Sized well above any realistic
  // worst-case concurrent count so pooling never silently drops shots in
  // normal play, while still bounding worst-case memory/collision cost.
  performance: {
    maxPlayerBullets: 240,
    maxEnemyBullets: 120,
    maxEnemies: 40,
  },
  // Basic placeholder enemy (run-structure.spec.todo.md's Difficulty (D)
  // scaling owns real enemy stat curves — F8 #136 — this is the one
  // hand-authored "drone" needed for F6's vertical slice and for grazing
  // (F7 #135) to have something to graze).
  enemies: {
    drone: {
      maxHp: 18,
      speed: 130,
      fireIntervalMs: 1400,
      bulletDamage: 6,
      bulletSpeed: 260,
      contactDamage: 10,
      scoreValue: 10,
      spawnIntervalMs: 850,
    },
  },
  // Purely cosmetic — background scroll / starfield drift — but still tuning,
  // not magic numbers inline in PlayScene.
  visuals: {
    bgScrollSpeed: 40,
    starCount: 70,
    starMinSpeed: 40,
    starMaxSpeed: 180,
  },
  // Debug-only (C12 #151 follow-up) — not gameplay tuning, but kept here so
  // every numeric constant still has one home. Per-entity-category outline
  // colors for the debug overlay's hitbox toggle.
  debug: {
    hitboxColors: {
      player: 0x00ffff,
      enemy: 0xff3333,
      playerBullet: 0x33ff33,
      enemyBullet: 0xffaa00,
    },
  },
} as const;
