/** Shared value formatter, keyed by StatDef.unit (stats.spec.md: "%, x, flat, px"). */
import { STAT_DEFS } from "./statDefs";
import type { StatDef, StatModifier } from "./types";

export function formatStatValue(def: StatDef, value: number): string {
  switch (def.unit) {
    case "percent":
      return `${(value * 100).toFixed(0)}%`;
    case "multiplier":
      return `${value.toFixed(2)}×`;
    case "px":
      return `${value.toFixed(0)}px`;
    case "flat":
    default:
      return value.toFixed(Number.isInteger(value) ? 0 : 1);
  }
}

/**
 * Formats one modifier's raw `amount` for an offer/tooltip line (item
 * effects, weapon upgrades, level-up picks) — distinct from
 * `formatStatValue`, which formats a fully computed stat value, not a
 * delta contributing to one.
 *
 * `mod.kind === "percent"` is checked first and always wins: a percent
 * modifier is a percentage of its category, full stop, regardless of the
 * stat's own display unit — e.g. a weapon's `{kind:"percent", amount:0.15}`
 * on Attack Speed reads as "+15%" even though Attack Speed's own
 * `StatDef.unit` is "multiplier" (that unit describes the *computed*
 * value, like "1.50×", not a raw delta).
 *
 * A "flat" modifier's best reading depends on the stat itself:
 * - **hyperbolic** archetypes (Armor, Evasion) accumulate raw contributions
 *   comparable to their own `K` constant (e.g. Armor's K=50) before the
 *   `raw/(raw+K)` transform — the raw number is NOT itself a 0–1 fraction,
 *   so scaling it by 100 (`def.unit === "percent"`, meant for the
 *   *computed* value) would be actively wrong (+8 Armor reading as
 *   "+800%"). Always shown as a plain number.
 * - Other **percent-unit** stats (Crit Chance, Luck, Credit Score, ...) are
 *   `unboundedMult` with no transform — raw IS the value, already scaled
 *   0–1, so a flat add there reads naturally as percentage points.
 * - **multiplier-unit** stats (Damage, Attack Speed, ...) have a base of 1;
 *   a flat add there is a plain unitless increment to that accumulator, not
 *   a "×" value (the "×" reading only makes sense for the fully computed
 *   stat — `formatStatValue`'s job, not this one's).
 * - px/flat-unit stats keep their own unit.
 */
export function formatModifierAmount(mod: StatModifier): string {
  const def = STAT_DEFS[mod.stat];
  if (mod.kind === "percent") {
    return `${(mod.amount * 100).toFixed(0)}%`;
  }
  if (def.archetype !== "hyperbolic" && def.unit === "percent") {
    return `${(mod.amount * 100).toFixed(0)}%`;
  }
  if (def.unit === "px") return `${mod.amount.toFixed(0)}px`;
  return Number.isInteger(mod.amount) ? `${mod.amount}` : mod.amount.toFixed(2);
}
