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
    // Focus (chassis.spec.md, F10 #138): hold to move slower for precision —
    // the universal base action every chassis has (`ChassisFocusDef.speedMult`).
    // hitboxRadiusFocus below is DEFAULT_CHASSIS's own perk
    // (`ChassisFocusDef.hitboxRadiusFocus`, content/chassis.ts), not a rule
    // the framework imposes — a future chassis may omit it or use a
    // different value entirely.
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
  // Chassis content (chassis.spec.md, F10 #138 framework / C7 #146 content).
  // Only Ikaruga-style polarity chassis read this block today — every other
  // chassis has no `ChassisDef.polarity`, so these numbers are inert unless
  // a polarity chassis is equipped.
  chassis: {
    ikaruga: {
      // "Gates which enemies take full damage from your shots" — a shot
      // fired at the wrong polarity bounces off harmlessly; the matching
      // polarity deals full damage.
      damageMultiplierSame: 0,
      damageMultiplierOpposite: 1,
      // Hype gained per same-polarity bullet absorbed, before scaling by the
      // shared grazeMultiplier stat (repurposed as this chassis's
      // absorb-meter gain rate, chassis.spec.md).
      absorbHypeBase: 6,
    },
    // Shared tint applied to the player ship, enemies, and bullets when a
    // polarity chassis is equipped — only Ikaruga-style chassis read this.
    polarityColors: {
      red: 0xff4444,
      blue: 0x4488ff,
    },
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
    // rarityLuck = Luck + luckFromD * D (items-and-brands.spec.todo.md);
    // consumed by the F9 #137 offer system (systems/economy/offers.ts).
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
    // Flat Ratings awarded by instantly-resolved special nodes. Shop's own
    // reward is the ShopScene visit itself (economy.spec.md, F9 #137), not
    // a Ratings bump, so this stays 0.
    shopRatingsBonus: 0,
    eventRatingsBonus: 8,
    treasureRatingsBonus: 15,
  },
  // Economy (economy.spec.todo.md, F9 #137): EXP/level curve, gold/interest,
  // coin/tip payouts, level-up stat-pick sizing, reroll costs. All
  // placeholders for the balance pass — shape is what F9 locks in.
  economy: {
    // expToNextLevel(level) = expCurveBase * expCurveGrowth^(level-1).
    expCurveBase: 20,
    expCurveGrowth: 1.28,
    // EXP awarded per kill = enemy.scoreValue * expPerScoreValue * the
    // player's expGain stat — EXP is gained directly on kill, no collection.
    expPerScoreValue: 1,
    // 4 MAIN stats shown per level-up pick (economy.spec.todo.md's hard rule).
    levelUpOfferCount: 4,
    // Flat StatModifier amount granted per level-up pick, per stat. All main
    // stats use "flat" kind regardless of archetype/unit — several main
    // stats have a base of 0 (armor, luck, creditScore, lifesteal, reflexes),
    // where a "percent" modifier would multiply zero and grant nothing.
    mainStatPickAmount: {
      damage: 0.15,
      attackSpeed: 0.12,
      critChance: 0.04,
      critDamage: 0.08,
      maxHp: 12,
      armor: 8,
      evasion: 0.06,
      maxShield: 8,
      hpRegen: 0.6,
      lifesteal: 0.03,
      playerSpeed: 14,
      reflexes: 0.08,
      luck: 0.06,
      creditScore: 0.06,
      expGain: 0.1,
      magnetRadius: 10,
    },
    // Gold is physical (economy.spec.todo.md): enemies explode into coins
    // that must be caught. Base coin value per kill, scaled the same way
    // score is (systems/difficulty's rewardCurve(D) — harder = richer).
    coinValueBase: 4,
    // Coins "pop" on spawn (Twin Bee bell-style, not an inert drop): always
    // some upward velocity (px/s, magnitude randomized in this range) plus
    // random horizontal velocity, equally likely left or right (magnitude up
    // to coinPopSpeedXMax). coinGravity (px/s^2) then arcs them back down —
    // this is what makes catching one a timing/positioning skill instead of
    // a guaranteed pickup.
    coinPopSpeedYMin: 200,
    coinPopSpeedYMax: 340,
    coinPopSpeedXMax: 150,
    coinGravity: 550,
    // In-flight coins accelerate toward the player once within Magnet
    // Radius, at this speed (px/s), and are caught within this radius (px).
    // Being in flight from the pop doesn't block the magnet lock — a coin
    // can be caught mid-arc.
    coinMagnetSpeed: 420,
    coinCollectRadius: 14,
    // Uncollected coins despawn this many seconds after spawning — wealth is
    // skill-gated, not just a floor loot pile waiting to be swept up later.
    coinLifespanSec: 6,
    // "At high Hype the crowd tips" — once Hype/HypeMax crosses this
    // fraction, a kill has a chance to also throw a bonus coin onto the
    // field (its own random offset near the kill), worth tipsValueMult x a
    // normal coin.
    tipsHypeThreshold: 0.6,
    tipsChance: 0.35,
    tipsValueMult: 1.5,
    // Interest: unspent (banked) gold earns interest at every shop break,
    // scaled by Credit Score — which also boosts fresh gold gain (see
    // creditScoreGoldGainScale). Cap is set absurdly high (effectively off)
    // per spec — tunable later.
    interestBaseRate: 0.1,
    interestCreditScoreScale: 1,
    goldCap: 1_000_000_000,
    creditScoreGoldGainScale: 0.5,
    // Reroll cost curve (shared by level-up picks and shop visits): cost
    // grows per reroll already spent within the current visit. Hype is
    // never spent as currency.
    rerollCostBase: 8,
    rerollCostGrowth: 1.6,
    // High Ratings tier comps a few free rerolls per visit (fame perk) —
    // indexed by Ratings tier rank (0 = Nobody .. 7 = Kevin Bacon).
    freeRerollsByRatingsRank: [0, 0, 0, 1, 1, 2, 2, 3],
    // Shop stock size: a small baseline shop at every inter-level break vs.
    // bigger dedicated map shop nodes (economy.spec.todo.md's "two cadences").
    shopBaselineSlots: 3,
    shopNodeSlots: 5,
    // Buy price per item tier (index = tierRank, common..epic). A new
    // weapon's first copy instead reuses the weapon-upgrade cost curve at
    // tier 0 (weapons.spec.todo.md) — buying in IS upgrading from nothing.
    itemPriceByTier: [30, 70, 150, 320],
  },
  // Offer weighting (items-and-brands.spec.todo.md, F9 #137): three
  // orthogonal RNG dials bend a weighted random draw — Ratings/sponsor sets
  // the tier ceiling+floor, Luck (+Difficulty) skews the tier roll under it,
  // brand affinity steers which item within that tier gets picked.
  offers: {
    // Stage 2: w_tier = baseWeight_tier * (1 + rarityLuck)^tierRank.
    // Index = tierRank (Common 0, Uncommon 1, Rare 2, Epic 3).
    tierBaseWeight: [100, 45, 18, 6],
    // Stage 1: Ratings rank (0..7, RATINGS_LADDER's index) -> tier
    // ceiling/floor. Epics locked until famous enough; junk Commons drop out
    // at high Ratings.
    maxTierRankByRatingsRank: [0, 1, 1, 2, 2, 3, 3, 3],
    minTierRankByRatingsRank: [0, 0, 0, 0, 1, 1, 1, 2],
    // Stage 3: affinity_i = min(brandAffinityCap, 1 + kBrand * ownedCount(brand_i)).
    kBrand: 0.35,
    brandAffinityCap: 5,
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
    maxCoins: 80,
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
  // Authored encounters (`systems/encounters`) — playing `/shmup-editor`
  // content in the real engine. These govern presentation and safety
  // ceilings only: everything about *what* an authored encounter does comes
  // from the authored data itself, never from here.
  //
  // Two numbers that belong to this system are deliberately NOT here: the
  // level scroll speed and the tile size live in
  // `systems/encounters/scrollModel.ts`, because `/shmup-editor` imports
  // them directly and has no business importing this whole object. See that
  // file's header.
  encounters: {
    // Display size (longest side, px) per unit of a Unit's authored hitbox
    // RADIUS — see spriteScale.ts on why display size is derived from the
    // one authored number that actually describes how big a thing is.
    // 3 puts a `size: 16` helicopter at 48px against a 720-wide screen and
    // a `size: 34` battleship at ~102px, keeping the shmup-standard
    // "hitbox comfortably smaller than the ship" relationship.
    artToHitboxRatio: 3,
    // Pool ceiling for authored units, applied **per collision bucket** —
    // PlayScene builds a hostile group and a friendly group, each capped at
    // this, so the true worst case is 2x. Not a global budget: the friendly
    // bucket is empty in practice (the editor only authors enemy-side
    // content, and `spawnGroup` defaults to "enemyProjectile"), so a shared
    // ceiling would spend accounting on a pool nothing uses. Sized well
    // above `maxEnemies` (40) because in this model a projectile IS a
    // Unit — one bullet-heavy encounter can have hundreds of live
    // instances.
    maxAuthoredUnits: 400,
    // How far off-screen an authored instance travels before it despawns.
    // Generous, so a wide authored path that loops out and back doesn't get
    // culled mid-manoeuvre.
    despawnMarginPx: 220,
    // Backstop lifespan (sec) for a dynamically spawned instance (a
    // projectile). Off-screen culling handles the normal case; this catches
    // an authored Unit that hangs around on screen doing nothing.
    spawnedLifespanSec: 12,
    // Backstop lifespan (sec) for a *placed* instance that has never once been
    // on screen. Placed instances are normally culled by "was seen, is now off
    // screen, path is done" — which is what stops a duplicate from being
    // deleted before the level scrolls it into view — so this only catches a
    // slot the scroll genuinely never reaches (an authored position off the
    // side of the level, or a scaling shape flung far outside the tile). Well
    // above the time a tile takes to scroll past, so it never fires on content
    // that was simply waiting its turn.
    placedUnseenLifespanSec: 60,
    // Grace period (sec) after the last authored moment before an encounter
    // with nothing left alive counts as played through — long enough for
    // in-flight projectiles to clear. (The other half of the end condition,
    // "the tile has scrolled off screen," is pure geometry and lives in
    // scrollModel.ts.)
    completionGraceSec: 1.5,
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
