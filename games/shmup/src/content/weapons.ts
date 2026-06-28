/**
 * Placeholder starting weapon — C1 #140 owns the real base-weapon roster.
 * This is pure data run through the same F4 effect-composition engine as any
 * future weapon (weapons.spec.todo.md's acceptance reference: "a new weapon
 * or modifier is purely a data addition"), proving the engine end-to-end for
 * F6's core loop. Copy comes from the existing "weapon.placeholder.*" keys
 * in copy.ts, which were already shaped for exactly this id.
 */
import { copy } from "./accessors";
import type { WeaponDef } from "../systems/effects";

export const PLACEHOLDER_WEAPON: WeaponDef = {
  id: "placeholder",
  name: copy("weapon.placeholder.name"),
  firingArc: "forward",
  targetType: "both",
  projectileSpeed: 640,
  scalesWith: ["damage", "attackSpeed", "pierce"],
  mods: [{ base: { kind: "flat", stat: "damage", amount: 4, source: "placeholder" }, perLevel: 1 }],
};
