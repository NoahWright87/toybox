/**
 * Passive items stack onto the shared stat pool (items-and-brands.spec.todo.md):
 * unlimited item slots, no upgrade mechanic — owning more copies sums their
 * modifiers through the F3 grammar, capped by `maxStacks` when declared.
 */
import type { StatModifier } from "../stats";
import type { OwnedItem } from "./types";

/** Modifiers contributed by one owned item, with stacking + maxStacks applied. */
export function itemModsForOwned(owned: OwnedItem): StatModifier[] {
  const stacks = Math.max(
    0,
    owned.item.maxStacks !== undefined ? Math.min(owned.count, owned.item.maxStacks) : owned.count
  );
  return owned.item.mods.map((mod) => ({ ...mod, amount: mod.amount * stacks }));
}
