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
import type { UnitDef } from "./unitTypes";

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

/**
 * Gives every Part of `unitDef` a placement at `time` — what that Part does
 * the moment the instance spawns, exactly as the base Unit's own first step
 * carries its `defaultActionId`.
 *
 * Called when a Unit is first placed into an encounter. Before this, a Part
 * only appeared once you'd explicitly attached something to it, which is why
 * a separate "add an attack" button had to exist at all: a Part with no
 * placements had no track, no marker, and nothing to select. Seeding one
 * per Part means a placed Unit arrives fully formed — every Part already on
 * the timeline with a dot you can select, retime, or point at a different
 * Action.
 *
 * A Part with no Actions authored on it still gets its dot, with a null
 * `actionId`. That's deliberate: the alternative is a Part that silently
 * has no track until you go elsewhere and give it an Action first, which is
 * the same discoverability hole one level down.
 *
 * Idempotent per Part — a Part that already has a placement is left alone,
 * so this can be re-run over existing content without duplicating anything.
 */
export function seedPartActions(instance: EncounterUnit, unitDef: UnitDef | undefined, time: number): EncounterUnit {
  if (!unitDef) return instance;
  const missing = unitDef.parts.filter((part) => !instance.partActions.some((p) => p.partId === part.id));
  if (missing.length === 0) return instance;
  const seeded: PartActionPlacement[] = missing.map((part) => ({
    id: makePartActionPlacementId(),
    partId: part.id,
    time,
    actionId: part.actions[0]?.id ?? null,
  }));
  return { ...instance, partActions: [...instance.partActions, ...seeded] };
}
