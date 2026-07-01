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
  // Grazing (hype-and-ratings.spec.md, F7 #135): concentric rings as
  // fractions of the grazeRadius stat. Innermost ring only applies (no
  // stacking) — point-blank grazing is the deliberate high-skill act.
  // Ordering here doesn't matter to the math (grazeRingAt sorts by frac),
  // but is written outermost-first to match the spec's authored shape.
  graze: {
    rings: [
      { frac: 1.0, mult: 1 },
      { frac: 0.55, mult: 2 },
      { frac: 0.25, mult: 4 },
    ],
    grazeRadiusBase: 70,
    // unboundedMult base of 1 == "no bonus" (same convention as damage):
    // payout = ring.mult * grazeMultiplier stat.
    grazeMultiplierBase: 1,
  },
  // Hype (hype-and-ratings.spec.md, Model 1 — F7 #135). HypeMax scales with
  // crowd size; crowdSizeDefault is a stand-in until the audience service
  // (T10 #161) supplies a real crowd-size number.
  hype: {
    base: 100,
    crowdSizeDefault: 1,
    kIdle: 0.6,
    kLevel: 0.8,
    baseDecay: 6,
    // M in `ScoreMult = 1 + (Hype/HypeMax)*M` — up to x3 at full Hype.
    scoreMultDepth: 2,
    // Hype/s while grazing at ring mult 1 and grazeMultiplier 1 — scaled by
    // both at the point of use (PlayScene). Grazing is the only Hype source
    // this slice wires up; kill/trick/elite sources are future item-driven
    // additions per the spec's "Hype-source items reshape the meter" note.
    grazeGainPerSecond: 18,
  },
  // Ratings (hype-and-ratings.spec.md Model 1, F7 #135). Hype is rewarded
  // exactly once via ScoreMult; Ratings derives from the resulting
  // Hype-inflated Score — never apply a second Hype multiplier here.
  ratings: {
    crowdConversion: 0.02,
    deathBasePenalty: 40,
    deathEmbarrassmentMod: 1,
    // F6's vertical slice has no real stage/boss structure yet (F8 #136
    // owns the node map/season system) — surviving this many seconds
    // stands in for "episode cleared" so the on-clear cash-in path is
    // reachable, and doubles as the denominator for stageProgress on an
    // early death. F8 replaces this with the real stage-end condition.
    episodeClearDurationSec: 90,
  },
  // Difficulty (D) — the master escalation scalar (run-structure.spec.todo.md,
  // F8 #136). One number; per-stat curves give it a non-uniform response
  // (HP ramps fast, damage ramps slow) instead of scaling every stat evenly.
  difficulty: {
    seasonCount: 5,
    // D at episodeIndex=0/mapLag=0 for each season (index 0 = Season 1).
    // Escalation formula (run-structure.spec.todo.md):
    //   D = seasonBase(season) + episodeRamp*episodeIndex + stageOffset
    //     + itemModifiers + deadlinePenalty*mapLag
    seasonBase: [0, 8, 16, 26, 38],
    episodeRamp: 1.4,
    // D added per unit of mapLag (how far behind the overworld deadline you are).
    deadlinePenalty: 2.2,
    // hpCurve(D): fast ramp — quadratic term dominates at high D.
    hpCurveLinearPerD: 0.09,
    hpCurveQuadPerD: 0.0025,
    // dmgCurve(D): slow ramp — sqrt so it trails HP badly at high D.
    dmgCurvePerSqrtD: 0.11,
    speedCurvePerD: 0.01,
    fireRateCurvePerD: 0.018,
    // densityCurve(D): fractional reduction to spawn interval, capped so
    // spawns never go below densityCurveMaxReduction of the base interval.
    densityCurvePerD: 0.02,
    densityCurveMaxReduction: 0.6,
    // rewardCurve(D): scoreValue multiplier — harder enemies pay out more.
    rewardCurvePerD: 0.03,
    // rarityLuck = Luck + luckFromD * D (items-and-brands.spec.todo.md); wired
    // here for the future offer system (F9 #137) to consume.
    luckFromD: 0.02,
    // Composition thresholds: elites are locked out below this D, then their
    // spawn chance ramps linearly from eliteChanceAtUnlock to eliteChanceMax
    // between eliteUnlockD and eliteChanceMaxD.
    eliteUnlockD: 6,
    eliteChanceAtUnlock: 0.15,
    eliteChanceMaxD: 40,
    eliteChanceMax: 0.6,
    // Boss HP gets an extra flat multiplier on top of hpCurve(D) — a Season
    // Finale is meant to be a real wall, not just another spawn.
    bossHpMult: 3,
  },
  // Season node-map (run-structure.spec.todo.md, F8 #136). Ratings gates node
  // COUNT and the special-node skew here — never Difficulty (kept in the
  // `difficulty` block above, which never reads Ratings).
  map: {
    columnsPerSeason: 6,
    nodesPerColumnMin: 2,
    nodesPerColumnMax: 4,
    // Chance a generated node is a special type (shop/event/treasure) at
    // Ratings rank 0 (Nobody), plus a per-rank increase — special nodes stay
    // rare early and get much more common as Ratings climbs. Elite is its
    // own roll on top, not part of the special pool.
    specialNodeBaseChance: 0.16,
    specialNodeChancePerRatingsRank: 0.045,
    specialNodeChanceMax: 0.55,
    eliteNodeChance: 0.14,
    // Chance to add one extra node to a column per Ratings rank (more options).
    extraNodeChancePerRatingsRank: 0.09,
    // Safer special nodes (run-structure.spec.md: "special nodes may carry a
    // negative D offset") — flat stageOffset added into the D formula.
    shopDifficultyOffset: 0,
    eventDifficultyOffset: -1,
    treasureDifficultyOffset: -2,
    eliteDifficultyOffset: 3,
    // Overworld deadline (FTL-style pursuing fleet). Advances this many
    // "columns" per node taken, reduced by the player's Player Speed stat
    // (overworld-only slack), floored so it always creeps forward some.
    deadlineAdvancePerNode: 1.0,
    deadlineMinAdvance: 0.35,
    deadlineSlackPerSpeed: 0.0016,
    // Flat Ratings awarded by instantly-resolved special nodes (shop is a
    // pure flavor stop until the gold-sink economy exists, F9 #137).
    shopRatingsBonus: 0,
    eventRatingsBonus: 8,
    treasureRatingsBonus: 15,
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
  // Base (D=0, un-scaled) stats per enemy archetype (run-structure.spec.todo.md's
  // per-archetype emphasis: systems/difficulty applies curves + emphasis
  // weights on top of these bases — never edit an archetype's D response here).
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
    // Bruiser archetype (composition thresholds, run-structure.spec.todo.md):
    // locked out below TUNING.difficulty.eliteUnlockD, then rolled in at a
    // rising chance. Leans HP/damage, trades away speed/fire-rate.
    elite: {
      maxHp: 60,
      speed: 100,
      fireIntervalMs: 1100,
      bulletDamage: 10,
      bulletSpeed: 280,
      contactDamage: 16,
      scoreValue: 40,
      spawnIntervalMs: 2600,
    },
    // Single Season/Series Finale boss (run-structure.spec.todo.md).
    boss: {
      maxHp: 900,
      speed: 40,
      fireIntervalMs: 650,
      bulletDamage: 14,
      bulletSpeed: 300,
      contactDamage: 24,
      scoreValue: 500,
      spawnIntervalMs: 0,
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
