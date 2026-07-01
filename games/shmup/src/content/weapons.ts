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
  tier: "common",
  firingArc: "forward",
  targetType: "both",
  projectileSpeed: 640,
  scalesWith: ["damage", "attackSpeed", "pierce"],
  mods: [{ base: { kind: "flat", stat: "damage", amount: 4, source: "placeholder" }, perLevel: 1 }],
};

/**
 * A small starter roster beyond the placeholder — enough variety for the
 * shop (F9 #137) to have something to sell. C1 #140 owns growing this into
 * the real base-weapon roster; these are intentionally minimal.
 */
const TWIN_BLASTER: WeaponDef = {
  id: "twin-blaster",
  name: copy("weapon.twin-blaster.name"),
  tier: "common",
  firingArc: "forward",
  targetType: "both",
  projectileSpeed: 720,
  scalesWith: ["attackSpeed", "damage"],
  mods: [{ base: { kind: "percent", stat: "attackSpeed", amount: 0.15 }, perLevel: 0.03 }],
};

const GREASE_GUN: WeaponDef = {
  id: "grease-gun",
  name: copy("weapon.grease-gun.name"),
  brand: "grease-monkey",
  tier: "uncommon",
  firingArc: "forward",
  targetType: "ground",
  projectileSpeed: 560,
  pierceDecay: 0.65,
  scalesWith: ["damage", "pierce"],
  mods: [
    { base: { kind: "flat", stat: "damage", amount: 6, source: "grease-gun" }, perLevel: 1.2 },
    { base: { kind: "flat", stat: "pierce", amount: 0.1, source: "grease-gun" }, perLevel: 0.02 },
  ],
};

const WEAPON_REGISTRY: Record<string, WeaponDef> = {
  [PLACEHOLDER_WEAPON.id]: PLACEHOLDER_WEAPON,
  [TWIN_BLASTER.id]: TWIN_BLASTER,
  [GREASE_GUN.id]: GREASE_GUN,
};

/** Every weapon in the registry — the shop's weapon offer pool (economy.spec.todo.md). */
export const ALL_WEAPONS: WeaponDef[] = Object.values(WEAPON_REGISTRY);

/**
 * Looks up a WeaponDef by id — the level of indirection CareerState's
 * persisted `{ weaponId, tier }[]` build (run-structure.spec.todo.md's
 * "build persists") needs so a save never embeds a full WeaponDef snapshot
 * that could drift from this registry. Unknown ids fall back to the
 * placeholder rather than crashing; C1 #140 grows this registry.
 */
export function weaponById(id: string): WeaponDef {
  return WEAPON_REGISTRY[id] ?? PLACEHOLDER_WEAPON;
}
