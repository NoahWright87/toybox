/**
 * Derives whether something is currently invincible from a sequence of
 * Action placements, rather than reading a stored per-placement flag —
 * unitTypes.ts's file header: "Invincibility is derived, not stored."
 * Walks the entries in chronological order and applies each referenced
 * Action's `setsInvincible` (`null` = no change, carries the previous
 * value forward; `true`/`false` = sets it explicitly), starting from
 * `false`.
 *
 * Generic over anything shaped like `{ time, actionId }` — both
 * `EncounterStep[]` (a base Unit's own track) and a Part's
 * `PartActionPlacement[]` (`partActionsForPart`, already time-sorted) fit
 * this shape, so this one function serves both without either
 * `encounterTypes.ts` type needing to know about the other.
 */
import type { ActionDef } from "./unitTypes";

interface TimedActionRef {
  time: number;
  actionId: string | null;
}

/** `entries` must already be in ascending-time order (both EncounterStep[]'s array order and `partActionsForPart`'s sorted output already are). */
export function resolveInvincibleAt(entries: TimedActionRef[], actions: ActionDef[], t: number): boolean {
  let invincible = false;
  for (const entry of entries) {
    if (entry.time > t) break;
    const action = entry.actionId ? actions.find((a) => a.id === entry.actionId) : undefined;
    if (action && action.setsInvincible !== null) invincible = action.setsInvincible;
  }
  return invincible;
}
