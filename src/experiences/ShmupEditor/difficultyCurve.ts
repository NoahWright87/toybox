/**
 * Shared difficulty-budget curve primitive (specs/games/shmup/spawn-and-warnings.spec.todo.md
 * §1, E3 #193). "Scaling curve types, attachable to any individual numeric
 * parameter (bullet count, fire rate, damage, HP, spawn count, arc width,
 * spiral radius, etc.): flat / linear / capped / stepped."
 *
 * This editor only wires the curve system up to one consumer so far —
 * SpawnNodeDef.countCurve (spawnTypes.ts), which resolves "spawn count" (one
 * of the params §1 names explicitly) from an incoming difficulty budget. The
 * broader vision — attaching a curve to arbitrary Unit/Weapon numeric
 * fields (HP, fire rate, damage...) — is deliberately NOT retrofitted onto
 * E2's already-shipped UnitStatsForm/WeaponForm here; that's a separate,
 * larger pass (see shmup-editor.todo.md's Remaining list), same as E2
 * itself deferred its own per-param scaling. `CurveDef`/`resolveCurve` are
 * kept generic (not spawn-node-specific) precisely so that future pass can
 * reuse this file instead of inventing its own curve math.
 */

export type CurveType = "flat" | "linear" | "capped" | "stepped";

export interface CurveThreshold {
  /** The budget value at/above which `value` takes over. */
  budget: number;
  value: number;
}

export interface CurveDef {
  type: CurveType;
  /** flat: the constant output. linear/capped: output at budget=0. stepped: output below the lowest threshold. */
  base: number;
  /** linear/capped: added per point of budget. */
  rate: number;
  /** capped: the ceiling `base + rate * budget` can't exceed. */
  cap: number;
  /** stepped: budget thresholds, any order — the highest one at or below the current budget wins. */
  thresholds: CurveThreshold[];
}

export function createFlatCurve(value: number): CurveDef {
  return { type: "flat", base: value, rate: 0, cap: value, thresholds: [] };
}

/** Resolves a curve's output at a given difficulty budget. Pure, no clamping to any caller-side min/max — callers (e.g. spawnTypes.ts's resolveSpawnCount) apply their own bounds on top of this. */
export function resolveCurve(curve: CurveDef, budget: number): number {
  switch (curve.type) {
    case "flat":
      return curve.base;
    case "linear":
      return curve.base + curve.rate * budget;
    case "capped":
      return Math.min(curve.base + curve.rate * budget, curve.cap);
    case "stepped": {
      let value = curve.base;
      for (const t of [...curve.thresholds].sort((a, b) => a.budget - b.budget)) {
        if (budget >= t.budget) value = t.value;
      }
      return value;
    }
    default:
      return curve.base;
  }
}
