/**
 * Pure attack-track CRUD for one Unit instance's placement within an
 * encounter (specs/shmup-editor.todo.md, E2 #192 — Parts/weapon-track
 * pass). Mirrors `encounterSteps.ts`'s shape, but **unordered**: unlike
 * steps (a sequence where array index order is meaningful), attacks have
 * no chronology invariant to maintain — each one just has a `time` and a
 * `partId` saying which of the Unit's independent attack tracks it belongs
 * to, so they can be added/removed in any order without cascade-delete
 * semantics (deleting one attack never implies deleting any other).
 */
import { makeAttackId, type EncounterAttack, type EncounterUnit } from "./encounterTypes";

const DEFAULT_ATTACK_DURATION_MS = 0;

/** Appends a new attack event for `partId`/`weaponId` at `time`. */
export function addAttack(instance: EncounterUnit, partId: string, weaponId: string, time: number): EncounterUnit {
  const attack: EncounterAttack = { id: makeAttackId(), partId, weaponId, time, durationMs: DEFAULT_ATTACK_DURATION_MS, aimAngleOverride: null };
  return { ...instance, attacks: [...instance.attacks, attack] };
}

/** Patches arbitrary fields on one attack event, flooring `time` at 0 if touched. */
export function updateAttack(instance: EncounterUnit, attackId: string, patch: Partial<EncounterAttack>): EncounterUnit {
  const clean = patch.time !== undefined ? { ...patch, time: Math.max(0, patch.time) } : patch;
  return { ...instance, attacks: instance.attacks.map((a) => (a.id === attackId ? { ...a, ...clean } : a)) };
}

export function deleteAttack(instance: EncounterUnit, attackId: string): EncounterUnit {
  return { ...instance, attacks: instance.attacks.filter((a) => a.id !== attackId) };
}

/** All of one Part's attack events, sorted by time — the display order for a per-part timeline lane. */
export function attacksForPart(instance: EncounterUnit, partId: string): EncounterAttack[] {
  return instance.attacks.filter((a) => a.partId === partId).sort((a, b) => a.time - b.time);
}
