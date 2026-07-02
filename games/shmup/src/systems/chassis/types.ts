/**
 * Chassis framework (chassis.spec.md, F10 #138). A chassis is DATA composed
 * through the existing F3/F4 engines — weapon-slot cap, hitbox size, stat
 * weightings, and 1-2 identity quirks, all consumed by `resolveLoadout()`
 * exactly like a weapon or item's mods. No bespoke per-chassis subsystem.
 */
import type { StatBlock, StatModifier } from "../stats";

export interface ChassisFocusDef {
  /**
   * Universal Focus action (chassis.spec.md): every chassis slows movement
   * to this fraction of Player Speed while Focus is held, for precise
   * dodging. This is not a perk — it's the one thing every chassis does.
   */
  speedMult: number;
  /**
   * Optional chassis perk: hitbox radius while focusing. Omitting it is the
   * framework-neutral default (no automatic hitbox shrink) — a chassis
   * opts into a smaller Focus hitbox as its own identity trait, same as any
   * other quirk, not a rule the framework imposes.
   */
  hitboxRadiusFocus?: number;
}

export interface ChassisDef {
  id: string;
  name: string;
  /**
   * Weapon-slot cap (weapons.spec.todo.md's bullet-heaven default is 6) — a
   * chassis may raise or lower it as its own identity trait.
   */
  maxWeaponSlots: number;
  /** Collision hitbox radius while not focusing — distinct from sprite size (chassis.spec.md). */
  hitboxRadiusNormal: number;
  focus: ChassisFocusDef;
  /**
   * Per-stat base overrides — the chassis's stat weightings (chassis.spec.md),
   * e.g. a tankier chassis raises base Max HP but lowers base Player Speed.
   * Falls back to each StatDef's own base when a stat is omitted.
   */
  statBase?: Partial<StatBlock>;
  /**
   * 1-2 identity quirks: persistent modifiers reinterpreting the shared F3
   * stat pool (Brotato-character model) — composed through the same
   * `resolveLoadout()` path as weapon/item mods, never a bespoke subsystem.
   */
  mods: StatModifier[];
}
