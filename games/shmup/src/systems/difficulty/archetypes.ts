/**
 * Per-archetype emphasis + composition thresholds (run-structure.spec.todo.md):
 * "each enemy type leans into certain stats as D rises (bruiser -> HP/damage,
 * swarmer -> count/speed)" and "higher D unlocks more elites, denser
 * formations, nastier patterns."
 */
import { TUNING } from "../../tuning";
import { dmgCurve, fireRateCurve, hpCurve, rewardCurve, speedCurve } from "./curves";
import type { ArchetypeEmphasis, EnemyArchetypeId, EnemyBaseStats, ScaledEnemyStats } from "./types";

/**
 * emphasis=1 -> feels the curve's full swing; emphasis=0 -> archetype ignores
 * that curve entirely; >1 amplifies it beyond the shared curve.
 */
export const ARCHETYPE_EMPHASIS: Record<EnemyArchetypeId, ArchetypeEmphasis> = {
  // Swarmer: count/density is its lean (handled via densityCurve at the
  // spawner, not per-enemy), so its own per-enemy stat response is baseline.
  drone: { hp: 1, damage: 1, speed: 1, fireRate: 1 },
  // Bruiser: leans hard into HP/damage, trades away speed/fire-rate response.
  elite: { hp: 1.6, damage: 1.3, speed: 0.6, fireRate: 0.5 },
  // Boss gets its own flat multiplier (bossHpMult) on top of a slightly
  // amplified HP curve; otherwise a slow, steady wall.
  boss: { hp: 1.1, damage: 1.15, speed: 0.4, fireRate: 0.8 },
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
  };
}

function densityMult(D: number): number {
  const reduction = Math.min(
    TUNING.difficulty.densityCurveMaxReduction,
    TUNING.difficulty.densityCurvePerD * Math.max(0, D)
  );
  return 1 - reduction;
}

/** Composition threshold: elites are locked out entirely below this D. */
export function eliteUnlocked(D: number): boolean {
  return D >= TUNING.difficulty.eliteUnlockD;
}

/** Elite spawn chance: 0 below unlock, then ramps linearly to eliteChanceMax by eliteChanceMaxD. */
export function eliteChance(D: number): number {
  const { eliteUnlockD, eliteChanceAtUnlock, eliteChanceMaxD, eliteChanceMax } = TUNING.difficulty;
  if (D < eliteUnlockD) return 0;
  if (D >= eliteChanceMaxD) return eliteChanceMax;
  const t = (D - eliteUnlockD) / Math.max(1e-6, eliteChanceMaxD - eliteUnlockD);
  return eliteChanceAtUnlock + (eliteChanceMax - eliteChanceAtUnlock) * t;
}

/** Rolls which archetype the next standard spawn should be, per the D-driven composition thresholds. Never rolls "boss" — boss nodes spawn their boss explicitly. */
export function rollSpawnArchetype(D: number, rng: () => number = Math.random): EnemyArchetypeId {
  return rng() < eliteChance(D) ? "elite" : "drone";
}
