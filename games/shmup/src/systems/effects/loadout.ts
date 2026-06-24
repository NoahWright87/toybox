/**
 * The single resolution path (weapons.spec.todo.md's acceptance reference):
 * (chassis base + chassis quirks + items + weapon mods) -> effective stats
 * + per-projectile behavior. No bespoke per-item branches — every input is
 * data flattened into the same `StatModifier[]` list and run through F3's
 * `computeStats()`.
 */
import { computeStats } from "../stats";
import type { StatBlock, StatModifier } from "../stats";
import { resolveProjectileBehavior } from "./projectileBehavior";
import { itemModsForOwned } from "./items";
import { weaponModsAtTier } from "./upgrades";
import { assertWeaponSlots } from "./slots";
import type { OwnedItem, OwnedWeapon, ProjectileBehavior } from "./types";

export interface LoadoutInput {
  /** Per-chassis base stat overrides (chassis.spec.todo.md), e.g. a different base Max HP. */
  chassisBase?: Partial<StatBlock>;
  /** Chassis quirks — persistent modifiers baked into the chassis itself. */
  chassisMods?: readonly StatModifier[];
  items?: readonly OwnedItem[];
  /** Up to `MAX_WEAPON_SLOTS` weapons, each at its own upgrade tier. */
  weapons?: readonly OwnedWeapon[];
  /** "While grazing"-style conditional mods, layered on top (stats.spec.md). */
  transientMods?: readonly StatModifier[];
}

export interface ResolvedLoadout {
  stats: StatBlock;
  projectileBehavior: ProjectileBehavior;
}

export function resolveLoadout(input: LoadoutInput): ResolvedLoadout {
  const weapons = input.weapons ?? [];
  assertWeaponSlots(weapons);

  const persistentMods: StatModifier[] = [
    ...(input.chassisMods ?? []),
    ...(input.items ?? []).flatMap(itemModsForOwned),
    ...weapons.flatMap(({ weapon, tier }) => weaponModsAtTier(weapon, tier)),
  ];

  const stats = computeStats(input.chassisBase, persistentMods, input.transientMods ?? []);
  const projectileBehavior = resolveProjectileBehavior(stats);

  return { stats, projectileBehavior };
}
