/**
 * Decomposes the unified Pierce stat into per-projectile behavior
 * (weapons.spec.todo.md). Pure and deterministic — no RNG, no rendering, no
 * I/O — so identical stats always produce identical behavior. Feeds
 * `AvgTargetsHit` in combat.spec.todo.md's DPS formula, never `HIT` itself.
 *
 * Pierce <= 100%: each impact multiplies the line's current damage by the
 * pierce ratio; the line ends once its fraction drops below the floor.
 * Pierce > 100%: the line itself never decays (it keeps piercing forever),
 * and the 100%-overflow forks into a new line carrying
 * `(pierce - 100%) * pierceDecay` — recursively, until what's left is <= 100%,
 * at which point it becomes the decaying tail. `pierceDecay` is authored
 * per-weapon (`WeaponDef.pierceDecay`), clamped to `TUNING.weapons.maxPierceDecay`
 * so a stacked decay value can't keep every generation forking forever.
 *
 * This produces only the pure damage-decay math — how many full-damage lines
 * result from forking, and what the one remaining line's hit-fraction
 * sequence looks like. Real targeting, rotation, and per-enemy hit-list
 * bookkeeping against actual entities is F6's job, not this engine's.
 */
import { TUNING } from "../../tuning";
import type { StatBlock } from "../stats";
import type { ProjectileBehavior } from "./types";

export type ProjectileBehaviorStats = Pick<StatBlock, "pierce" | "blastRadius">;

export interface ProjectileBehaviorTuningOverrides {
  pierceTailDamageFloor?: number;
  maxPierceDecay?: number;
  maxForksPerImpact?: number;
  maxTailHits?: number;
  blastTargetsPerPx?: number;
  blastDamageFraction?: number;
}

interface PierceDecomposition {
  flatLineCount: number;
  tailHitFractions: number[];
}

/**
 * `current` starts as the full pierce stat. While it's still over 100% (1.0),
 * one full-damage-forever line is spent and the next generation's pierce is
 * `(current - 1) * decay` — applied fresh each generation, not as `decay^n`
 * against the original value. This recurrence subtracts *and* multiplies
 * every step, so it provably converges below 1.0 in a small, finite number
 * of steps for any decay < 1 (and decay is hard-capped below 1 by
 * `maxPierceDecay`). `maxForksPerImpact` is a backstop against pathological
 * inputs, not a gameplay-meaningful limit.
 *
 * Once `current` is <= 1.0, it becomes the decay ratio for the one remaining
 * line's tail: hit fractions are `[1, current, current^2, ...]`, stopping
 * once a fraction drops below `floorRatio`. `maxTailHits` caps that loop
 * since pierce is an unbounded stat.
 */
function decomposePierce(
  pierceStat: number,
  pierceDecay: number,
  floorRatio: number,
  maxForks: number,
  maxTailHits: number
): PierceDecomposition {
  let flatLineCount = 0;
  let current = Math.max(0, pierceStat);
  while (current > 1 && flatLineCount < maxForks) {
    flatLineCount += 1;
    current = (current - 1) * pierceDecay;
  }

  const tailHitFractions = [1];
  let fraction = current;
  while (fraction >= floorRatio && tailHitFractions.length < maxTailHits) {
    tailHitFractions.push(fraction);
    fraction *= current;
  }

  return { flatLineCount, tailHitFractions };
}

export function resolveProjectileBehavior(
  stats: ProjectileBehaviorStats,
  pierceDecay: number = TUNING.weapons.defaultPierceDecay,
  overrides: ProjectileBehaviorTuningOverrides = {}
): ProjectileBehavior {
  // Defaulted field-by-field rather than spread: a caller passing an
  // explicit `undefined` for one override field must not blow away the
  // other tuning defaults the way `{ ...TUNING.weapons, ...overrides }` would.
  const pierceTailDamageFloor = overrides.pierceTailDamageFloor ?? TUNING.weapons.pierceTailDamageFloor;
  const maxPierceDecay = overrides.maxPierceDecay ?? TUNING.weapons.maxPierceDecay;
  const maxForksPerImpact = overrides.maxForksPerImpact ?? TUNING.weapons.maxForksPerImpact;
  const maxTailHits = overrides.maxTailHits ?? TUNING.weapons.maxTailHits;
  const blastTargetsPerPx = overrides.blastTargetsPerPx ?? TUNING.weapons.blastTargetsPerPx;
  const blastDamageFraction = overrides.blastDamageFraction ?? TUNING.weapons.blastDamageFraction;

  const safeDecay = Math.min(maxPierceDecay, Math.max(0, pierceDecay));
  const { flatLineCount, tailHitFractions } = decomposePierce(
    stats.pierce,
    safeDecay,
    pierceTailDamageFloor,
    maxForksPerImpact,
    maxTailHits
  );

  return {
    flatLineCount,
    tailHitFractions,
    blastBonusTargetsPerHit: Math.max(0, stats.blastRadius) * blastTargetsPerPx,
    blastDamageFraction,
  };
}
