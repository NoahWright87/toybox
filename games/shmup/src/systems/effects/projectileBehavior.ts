/**
 * Composes pierce/bounce/fork/chain/blast into per-projectile behavior
 * (weapons.spec.todo.md). Pure and deterministic — no RNG, no rendering, no
 * I/O — so identical stats always produce identical behavior. Feeds
 * `AvgTargetsHit` in combat.spec.todo.md's DPS formula, never `HIT` itself.
 *
 * Modifiers attach to *whatever is firing* (weapons.spec.todo.md) — this
 * function takes the already-resolved exotic stats from the shared pool
 * (`computeStats()`'s output), not a specific weapon, and applies to any
 * projectile the ship fires. Synergies (pierce + fork tunneling through
 * every forked copy) emerge from composing the math below, never from an
 * authored "weapon A + B" table.
 */
import { TUNING } from "../../tuning";
import type { StatBlock } from "../stats";
import type { ProjectileBehavior } from "./types";

export type ProjectileBehaviorStats = Pick<
  StatBlock,
  "pierce" | "bounce" | "fork" | "chain" | "blastRadius"
>;

export interface ProjectileBehaviorTuningOverrides {
  maxBounces?: number;
  bounceDamageFloor?: number;
  chainDamageFraction?: number;
  blastTargetsPerPx?: number;
  blastDamageFraction?: number;
}

/**
 * Pierce is "% retained damage" (weapons.spec.todo.md): the guaranteed first
 * hit (1.0) is extended by the pierce stat as an additional damage budget,
 * spent at full (1.0) per target until less than one full hit remains, which
 * goes to one final partial target — e.g. pierce 2.25 -> hits of [1, 1, 0.25]
 * past the guaranteed first hit (matching the spec's worked example of full
 * damage through several enemies then a fractional one to the next).
 */
function pierceHitFractions(pierceStat: number): number[] {
  const hits: number[] = [];
  let remaining = Math.max(0, pierceStat);
  while (remaining > 0) {
    const fraction = Math.min(remaining, 1);
    hits.push(fraction);
    remaining -= fraction;
  }
  return hits;
}

/**
 * Bounce is "damage retained per bounce": each successive bounce deals
 * `bounceStat` raised to the bounce's index (1st bounce = bounceStat^1, 2nd
 * = bounceStat^2, ...), a geometric decay. Bounces stop once a hit's
 * fraction drops below `bounceDamageFloor`, or after `maxBounces` as a hard
 * safety cap (bounce is unboundedMult and can exceed 100%, so the decay
 * isn't guaranteed to converge below the floor on its own).
 */
function bounceHitFractions(bounceStat: number, floor: number, maxBounces: number): number[] {
  const hits: number[] = [];
  const retained = Math.max(0, bounceStat);
  for (let i = 1; i <= maxBounces; i++) {
    const fraction = Math.pow(retained, i);
    if (fraction < floor) break;
    hits.push(fraction);
  }
  return hits;
}

/**
 * Chain is a flat jump count with no dedicated decay stat (stats.spec.md) —
 * each jump deals a flat `chainDamageFraction` of HIT until combat (F6)
 * authors real per-jump decay.
 */
function chainHitFractions(chainStat: number, chainDamageFraction: number): number[] {
  const count = Math.max(0, Math.floor(chainStat));
  return new Array(count).fill(chainDamageFraction);
}

export function resolveProjectileBehavior(
  stats: ProjectileBehaviorStats,
  overrides: ProjectileBehaviorTuningOverrides = {}
): ProjectileBehavior {
  const tuning = { ...TUNING.weapons, ...overrides };

  // One "line" is what a single tunneling projectile hits before forking:
  // the guaranteed first hit, then pierce-through, then bounces, then chain jumps.
  const singleLine = [
    1,
    ...pierceHitFractions(stats.pierce),
    ...bounceHitFractions(stats.bounce, tuning.bounceDamageFloor, tuning.maxBounces),
    ...chainHitFractions(stats.chain, tuning.chainDamageFraction),
  ];

  // Fork duplicates the whole line into parallel copies that each keep
  // tunneling independently ("every shot splits and each half keeps
  // tunneling" — weapons.spec.todo.md).
  const forkCopies = 1 + Math.max(0, Math.floor(stats.fork));
  const hitFractions: number[] = [];
  for (let i = 0; i < forkCopies; i++) hitFractions.push(...singleLine);

  const blastBonusTargets =
    Math.max(0, stats.blastRadius) * tuning.blastTargetsPerPx * hitFractions.length;

  const hitDamageSum = hitFractions.reduce((sum, fraction) => sum + fraction, 0);
  const totalDamageFraction = hitDamageSum + blastBonusTargets * tuning.blastDamageFraction;

  return {
    hitFractions,
    blastBonusTargets,
    avgTargetsHit: hitFractions.length + blastBonusTargets,
    totalDamageFraction,
  };
}
