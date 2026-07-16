/**
 * Pure spawn-node CRUD for one encounter (specs/shmup-editor.todo.md,
 * E3 #193). Mirrors `encounterAttacks.ts`'s shape: spawn nodes are
 * **unordered**, same reasoning as attacks — each one is an independent
 * group-spawn configuration with no chronology invariant between them
 * (unlike steps), so adding/removing one never cascades to another.
 */
import { createSpawnNode, type SpawnNodeDef } from "./spawnTypes";
import type { EncounterDef, Vec2 } from "./encounterTypes";

/** Appends a new spawn node anchored at `anchor`, referencing `unitDefId`. */
export function addSpawnNode(encounter: EncounterDef, anchor: Vec2, unitDefId: string | null): EncounterDef {
  const node = createSpawnNode(encounter.spawnNodes.length, anchor, unitDefId);
  return { ...encounter, spawnNodes: [...encounter.spawnNodes, node] };
}

/** Patches arbitrary fields on one spawn node. */
export function updateSpawnNode(encounter: EncounterDef, nodeId: string, patch: Partial<SpawnNodeDef>): EncounterDef {
  return { ...encounter, spawnNodes: encounter.spawnNodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) };
}

export function deleteSpawnNode(encounter: EncounterDef, nodeId: string): EncounterDef {
  return { ...encounter, spawnNodes: encounter.spawnNodes.filter((n) => n.id !== nodeId) };
}
