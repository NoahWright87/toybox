/**
 * Pure Part-action-track CRUD for one Unit instance's placement within an
 * encounter — renamed/simplified from `encounterAttacks.ts` now that
 * Actions are back (`unitTypes.ts`, `encounterTypes.ts`'s
 * `PartActionPlacement`). Mirrors `encounterSteps.ts`'s shape, but
 * **unordered**: unlike steps (a sequence where array index order is
 * meaningful), Part-action placements have no chronology invariant to
 * maintain — each one just has a `time` and a `partId` saying which of
 * the Unit's independent per-Part tracks it belongs to, so they can be
 * added/removed in any order without cascade-delete semantics (deleting
 * one placement never implies deleting any other).
 */
import { makePartActionPlacementId, type EncounterUnit, type PartActionPlacement } from "./encounterTypes";

/** Appends a new Action placement for `partId` at `time`, referencing `actionId` (may be null if the Part has no Actions authored yet). */
export function addPartAction(instance: EncounterUnit, partId: string, actionId: string | null, time: number): EncounterUnit {
  const placement: PartActionPlacement = { id: makePartActionPlacementId(), partId, time, actionId };
  return { ...instance, partActions: [...instance.partActions, placement] };
}

/** Patches arbitrary fields on one placement, flooring `time` at 0 if touched. */
export function updatePartAction(instance: EncounterUnit, placementId: string, patch: Partial<PartActionPlacement>): EncounterUnit {
  const clean = patch.time !== undefined ? { ...patch, time: Math.max(0, patch.time) } : patch;
  return { ...instance, partActions: instance.partActions.map((a) => (a.id === placementId ? { ...a, ...clean } : a)) };
}

export function deletePartAction(instance: EncounterUnit, placementId: string): EncounterUnit {
  return { ...instance, partActions: instance.partActions.filter((a) => a.id !== placementId) };
}

/** All of one Part's Action placements, sorted by time — the display order for a per-part timeline lane. */
export function partActionsForPart(instance: EncounterUnit, partId: string): PartActionPlacement[] {
  return instance.partActions.filter((a) => a.partId === partId).sort((a, b) => a.time - b.time);
}
