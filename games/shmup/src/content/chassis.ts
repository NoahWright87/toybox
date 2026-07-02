/**
 * Chassis registry (chassis.spec.md, F10 #138). A chassis is pure data run
 * through the same `resolveLoadout()` path as weapons/items — the framework
 * lands here in `systems/chassis/types.ts`; this file only supplies content.
 * C7 #146 (Ikaruga polarity) / C8 #147 (more chassis) grow this registry.
 */
import { copy } from "./accessors";
import { TUNING } from "../tuning";
import type { ChassisDef } from "../systems/chassis";

/**
 * The default chassis (chassis.spec.md's "ship a clean DEFAULT chassis"): no
 * identity quirks, the framework-standard 6 weapon slots, and the
 * genre-standard Focus hitbox-shrink perk (`hitboxRadiusFocus`) — the base
 * Focus action itself (slower movement) is universal to every chassis, not
 * this chassis's doing; see `ChassisFocusDef.speedMult`.
 */
export const DEFAULT_CHASSIS: ChassisDef = {
  id: "default",
  name: copy("chassis.default.name"),
  maxWeaponSlots: TUNING.weapons.maxWeaponSlots,
  hitboxRadiusNormal: TUNING.combat.hitboxRadiusNormal,
  focus: {
    speedMult: TUNING.combat.focusSpeedMult,
    hitboxRadiusFocus: TUNING.combat.hitboxRadiusFocus,
  },
  mods: [],
};

const CHASSIS_REGISTRY: Record<string, ChassisDef> = {
  [DEFAULT_CHASSIS.id]: DEFAULT_CHASSIS,
};

/** Every chassis in the registry. */
export const ALL_CHASSIS: ChassisDef[] = Object.values(CHASSIS_REGISTRY);

/** Looks up a ChassisDef by id — unknown ids fall back to the default rather than crashing (same convention as `weaponById`). */
export function chassisById(id: string): ChassisDef {
  return CHASSIS_REGISTRY[id] ?? DEFAULT_CHASSIS;
}
