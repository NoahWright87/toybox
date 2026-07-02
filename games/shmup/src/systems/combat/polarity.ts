/**
 * Polarity resolution (chassis.spec.md's Ikaruga flagship example) — pure
 * functions only, same convention as `applyDamage`/`rollCrit`. Both take the
 * chassis's `ChassisPolarityDef | undefined` explicitly rather than reading
 * a chassis object, so a chassis with no polarity mechanic (every chassis
 * but Ikaruga today) always resolves to "no gating, no absorption" without
 * either function needing a special case.
 */
import type { ChassisPolarityDef, Polarity } from "../chassis";

/**
 * Damage multiplier for a player shot fired at `shotPolarity` against a
 * target of `targetPolarity` — "current polarity gates which enemies take
 * full damage from your shots." `shotPolarity: null` (a chassis with no
 * polarity mechanic never assigns one to its shots) always resolves to 1, no
 * gating at all — the framework-neutral default.
 */
export function polarityDamageMultiplier(
  polarityDef: ChassisPolarityDef | undefined,
  shotPolarity: Polarity | null,
  targetPolarity: Polarity
): number {
  if (!polarityDef || shotPolarity === null) return 1;
  return shotPolarity === targetPolarity ? polarityDef.damageMultiplierSame : polarityDef.damageMultiplierOpposite;
}

/**
 * True when an incoming bullet of `bulletPolarity` should be absorbed
 * (destroyed, no damage, Hype gained instead) rather than hit the player at
 * `playerPolarity` — "same-color absorption." Only meaningful when the
 * chassis actually declares a polarity mechanic.
 */
export function absorbsBullet(
  polarityDef: ChassisPolarityDef | undefined,
  playerPolarity: Polarity,
  bulletPolarity: Polarity
): boolean {
  return polarityDef !== undefined && playerPolarity === bulletPolarity;
}
