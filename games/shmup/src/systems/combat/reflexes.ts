/**
 * Reflexes (combat.spec.todo.md / stats.spec.md): one raw unboundedMult stat
 * feeding two separate hyperbolic channels, each with its own K and cap —
 * applied downstream by combat (here), not by computeStats(). Reflexes is
 * unboundedMult with no archetype transform, so computeStats()'s output for
 * it already equals the raw pre-transform value; no separate aggregateRaw
 * call is needed by callers.
 */
import { TUNING } from "../../tuning";

function hyperbolicSlow(raw: number, k: number, cap: number): number {
  if (raw <= 0) return 0;
  return cap * (raw / (raw + k));
}

/** Multiplier applied to enemy bullet speed (floors toward ~20% of normal per combat.spec.todo.md). */
export function reflexBulletSpeedMult(reflexes: number): number {
  return 1 - hyperbolicSlow(reflexes, TUNING.combat.reflexBulletK, TUNING.combat.reflexBulletSlowCap);
}

/** Multiplier applied to enemy movement speed (floors toward ~50% of normal per combat.spec.todo.md). */
export function reflexMoveSpeedMult(reflexes: number): number {
  return 1 - hyperbolicSlow(reflexes, TUNING.combat.reflexMoveK, TUNING.combat.reflexMoveSlowCap);
}
