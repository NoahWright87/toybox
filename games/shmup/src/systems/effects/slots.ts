/**
 * 6 weapon slots per chassis (bullet-heaven default + a hard performance
 * ceiling on worst-case concurrent projectiles — weapons.spec.todo.md).
 * Enforced here so every caller of `resolveLoadout` gets the cap for free.
 */
import { TUNING } from "../../tuning";
import type { OwnedWeapon } from "./types";

export const MAX_WEAPON_SLOTS = TUNING.weapons.maxWeaponSlots;

export function assertWeaponSlots(weapons: readonly OwnedWeapon[]): void {
  if (weapons.length > MAX_WEAPON_SLOTS) {
    throw new Error(
      `Too many weapon slots: ${weapons.length} exceeds the chassis cap of ${MAX_WEAPON_SLOTS}`
    );
  }
}
