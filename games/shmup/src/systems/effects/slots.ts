/**
 * 6 weapon slots by default (bullet-heaven default + a hard performance
 * ceiling on worst-case concurrent projectiles — weapons.spec.todo.md). A
 * chassis (chassis.spec.md) may raise or lower this per its own
 * `maxWeaponSlots` — `MAX_WEAPON_SLOTS` is only the framework's fallback cap
 * when a caller doesn't supply a chassis-specific one.
 */
import { TUNING } from "../../tuning";
import type { OwnedWeapon } from "./types";

export const MAX_WEAPON_SLOTS = TUNING.weapons.maxWeaponSlots;

export function assertWeaponSlots(weapons: readonly OwnedWeapon[], maxSlots: number = MAX_WEAPON_SLOTS): void {
  if (weapons.length > maxSlots) {
    throw new Error(`Too many weapon slots: ${weapons.length} exceeds the chassis cap of ${maxSlots}`);
  }
}
