/**
 * Per-archetype emphasis + composition thresholds (run-structure.spec.todo.md):
 * "each enemy type leans into certain stats as D rises (bruiser -> HP/damage,
 * swarmer -> count/speed)" and "higher D unlocks more elites, denser
 * formations, nastier patterns."
 */
import { TUNING } from "../../tuning";
import { dmgCurve, fireRateCurve, hpCurve, rewardCurve, speedCurve } from "./curves";
import type { ArchetypeEmphasis, EnemyArchetypeId, EnemyBaseStats, EnemyDomain, ScaledEnemyStats } from "./types";

/**
 * emphasis=1 -> feels the curve's full swing; emphasis=0 -> archetype ignores
 * that curve entirely; >1 amplifies it beyond the shared curve.
 */
export const ARCHETYPE_EMPHASIS: Record<EnemyArchetypeId, ArchetypeEmphasis> = {
  // Drone: count/density is its lean (handled via densityCurve at the
  // spawner, not per-enemy), so its own per-enemy stat response is baseline.
  drone: { hp: 1, damage: 1, speed: 1, fireRate: 1 },
  // Bruiser: leans hard into HP/damage, trades away speed/fire-rate response.
  elite: { hp: 1.6, damage: 1.3, speed: 0.6, fireRate: 0.5 },
  // Boss gets its own flat multiplier (bossHpMult) on top of a slightly
  // amplified HP curve; otherwise a slow, steady wall.
  boss: { hp: 1.1, damage: 1.15, speed: 0.4, fireRate: 0.8 },
  // Swarmer: the "more of them" archetype's per-enemy expression — leans
  // hard into speed (weaving, hard to pin down) and fire-rate, trades away
  // HP/damage. Density itself is still the spawner's job (rollSpawnArchetypeForDomain).
  swarmer: { hp: 0.5, damage: 0.8, speed: 1.6, fireRate: 1.3 },
  // Turret: ground emplacement — leans hard into HP (bolted down, has to be
  // whittled through) and fire-rate (aimed shots get more frequent), barely
  // feels the speed curve since it mostly holds position (movement.hover).
  turret: { hp: 1.5, damage: 1.2, speed: 0.2, fireRate: 1.4 },
};

function scaleWithEmphasis(curveMult: number, emphasis: number): number {
  return 1 + (curveMult - 1) * emphasis;
}

/** Base (D=0) enemy stats, run through this archetype's curve response at Difficulty D. */
export function scaledEnemyStats(archetype: EnemyArchetypeId, base: EnemyBaseStats, D: number): ScaledEnemyStats {
  const emphasis = ARCHETYPE_EMPHASIS[archetype];
  const hpMult = scaleWithEmphasis(hpCurve(D), emphasis.hp) * (archetype === "boss" ? TUNING.difficulty.bossHpMult : 1);
  const dmgMult = scaleWithEmphasis(dmgCurve(D), emphasis.damage);
  const spdMult = scaleWithEmphasis(speedCurve(D), emphasis.speed);
  const rateMult = scaleWithEmphasis(fireRateCurve(D), emphasis.fireRate);

  return {
    maxHp: base.maxHp * hpMult,
    speed: base.speed * spdMult,
    fireIntervalMs: base.fireIntervalMs / rateMult,
    bulletDamage: base.bulletDamage * dmgMult,
    bulletSpeed: base.bulletSpeed * spdMult,
    contactDamage: base.contactDamage * dmgMult,
    scoreValue: base.scoreValue * rewardCurve(D),
    spawnIntervalMs: base.spawnIntervalMs * densityMult(D),
    // Structural, not D-scaled — passed through unchanged.
    domain: base.domain,
    movement: base.movement,
    firePattern: base.firePattern,
  };
}

function densityMult(D: number): number {
  const reduction = Math.min(
    TUNING.difficulty.densityCurveMaxReduction,
    TUNING.difficulty.densityCurvePerD * Math.max(0, D)
  );
  return 1 - reduction;
}

/** Shared shape for every "locked out below unlockD, then ramps linearly to max by maxD" composition threshold. */
function rampChance(D: number, unlockD: number, chanceAtUnlock: number, maxD: number, chanceMax: number): number {
  if (D < unlockD) return 0;
  if (D >= maxD) return chanceMax;
  const t = (D - unlockD) / Math.max(1e-6, maxD - unlockD);
  return chanceAtUnlock + (chanceMax - chanceAtUnlock) * t;
}

/** Composition threshold: elites are locked out entirely below this D. */
export function eliteUnlocked(D: number): boolean {
  return D >= TUNING.difficulty.eliteUnlockD;
}

/** Elite spawn chance: 0 below unlock, then ramps linearly to eliteChanceMax by eliteChanceMaxD. */
export function eliteChance(D: number): number {
  const { eliteUnlockD, eliteChanceAtUnlock, eliteChanceMaxD, eliteChanceMax } = TUNING.difficulty;
  return rampChance(D, eliteUnlockD, eliteChanceAtUnlock, eliteChanceMaxD, eliteChanceMax);
}

/** Swarmer spawn chance — same ramp shape as elite, its own (earlier) thresholds. */
export function swarmerChance(D: number): number {
  const { swarmerUnlockD, swarmerChanceAtUnlock, swarmerChanceMaxD, swarmerChanceMax } = TUNING.difficulty;
  return rampChance(D, swarmerUnlockD, swarmerChanceAtUnlock, swarmerChanceMaxD, swarmerChanceMax);
}

/** Turret spawn chance — same ramp shape as elite, its own thresholds. */
export function turretChance(D: number): number {
  const { turretUnlockD, turretChanceAtUnlock, turretChanceMaxD, turretChanceMax } = TUNING.difficulty;
  return rampChance(D, turretUnlockD, turretChanceAtUnlock, turretChanceMaxD, turretChanceMax);
}

/** Rolls which archetype the next standard spawn should be, per the D-driven composition thresholds. Never rolls "boss" — boss nodes spawn their boss explicitly. */
export function rollSpawnArchetype(D: number, rng: () => number = Math.random): EnemyArchetypeId {
  return rng() < eliteChance(D) ? "elite" : "drone";
}

/**
 * Extends `rollSpawnArchetype` with the domain-flavored archetypes
 * (run-structure.spec.todo.md's "establish ground vs air" — C5 #144): a
 * "drone" result additionally has a chance to upgrade to the domain's
 * flavor archetype (swarmer for air levels, turret for ground levels) once
 * its own D threshold unlocks. Elite always wins the first roll unchanged,
 * so this stays additive over the existing elite/drone gate rather than
 * replacing it.
 */
export function rollSpawnArchetypeForDomain(
  D: number,
  domain: EnemyDomain,
  rng: () => number = Math.random
): EnemyArchetypeId {
  const base = rollSpawnArchetype(D, rng);
  if (base === "elite") return "elite";
  const flavor: EnemyArchetypeId = domain === "ground" ? "turret" : "swarmer";
  const flavorChance = domain === "ground" ? turretChance(D) : swarmerChance(D);
  return rng() < flavorChance ? flavor : "drone";
}
