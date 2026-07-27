/**
 * The single resolution path (weapons.spec.todo.md's acceptance reference):
 * (chassis base + chassis quirks + items + weapon mods) -> effective stats
 * + per-projectile behavior. No bespoke per-item branches — every input is
 * data flattened into the same `StatModifier[]` list and run through F3's
 * `computeStats()`.
 */
import { TUNING } from "../../tuning";
import { computeStats } from "../stats";
import type { StatBlock, StatModifier } from "../stats";
import { resolveProjectileBehavior } from "./projectileBehavior";
import { itemModsForOwned } from "./items";
import { weaponModsAtTier } from "./upgrades";
import { assertWeaponSlots } from "./slots";
import type { OwnedItem, OwnedWeapon, ProjectileBehavior } from "./types";

export interface LoadoutInput {
  /** Per-chassis base stat overrides (chassis.spec.md's stat weightings), e.g. a different base Max HP. */
  chassisBase?: Partial<StatBlock>;
  /** Chassis quirks — persistent modifiers baked into the chassis itself (chassis.spec.md). */
  chassisMods?: readonly StatModifier[];
  /** Level-up stat-pick mods (economy.spec.md) — persistent like `chassisMods`, but not part of the chassis itself; kept as its own field so a caller can swap the build without touching the equipped chassis. */
  statPickMods?: readonly StatModifier[];
  items?: readonly OwnedItem[];
  /** Up to the chassis's weapon-slot cap (`maxWeaponSlots`), each at its own upgrade tier. */
  weapons?: readonly OwnedWeapon[];
  /** Weapon-slot cap (chassis.spec.md) — defaults to `MAX_WEAPON_SLOTS` when the caller doesn't supply a chassis-specific cap. */
  maxWeaponSlots?: number;
  /** "While grazing"-style conditional mods, layered on top (stats.spec.md) — also where a chassis's Focus state layers a weapon's optional `focusedMods` in, since Focus is exactly this kind of toggled condition. */
  transientMods?: readonly StatModifier[];
}

export interface ResolvedLoadout {
  stats: StatBlock;
  /**
   * One entry per equipped weapon, parallel to `input.weapons` — pierce and
   * blast radius are shared/pooled stats, but `pierceDecay` is authored
   * per-weapon (weapons.spec.todo.md), so each weapon decomposes the same
   * pooled pierce differently.
   */
  projectileBehaviors: ProjectileBehavior[];
}

export function resolveLoadout(input: LoadoutInput): ResolvedLoadout {
  const weapons = input.weapons ?? [];
  assertWeaponSlots(weapons, input.maxWeaponSlots);

  const persistentMods: StatModifier[] = [
    ...(input.chassisMods ?? []),
    ...(input.statPickMods ?? []),
    ...(input.items ?? []).flatMap(itemModsForOwned),
    ...weapons.flatMap(({ weapon, tier }) => weaponModsAtTier(weapon, tier)),
  ];

  const stats = computeStats(input.chassisBase, persistentMods, input.transientMods ?? []);
  const projectileBehaviors = weapons.map(({ weapon }) =>
    resolveProjectileBehavior(stats, weapon.pierceDecay ?? TUNING.weapons.defaultPierceDecay)
  );

  return { stats, projectileBehaviors };
}
