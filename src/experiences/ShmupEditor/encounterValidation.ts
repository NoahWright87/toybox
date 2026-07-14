/**
 * Defensive shape validation for EncounterDef (specs/shmup-editor.todo.md,
 * E2 #192 — reworked per the "Design Handoff v2" doc). Shared by
 * tileStore.ts (encounters embedded in a saved tile) and the tile-editing
 * session draft. Same spirit as tileStore.ts's isValidTileDef: a corrupt
 * or stale-shape encounter (including a hand-edited TILES.DAT/DRAFT.DAT,
 * which this hackable app explicitly permits per root CLAUDE.md) is
 * rejected rather than crashing.
 *
 * Much smaller than the previous version: an encounter step only
 * references an actionId string now (movement/attack/bullet all moved to
 * unitTypes.ts's ActionDef, validated there instead) — no more recursive
 * graph/payload validation needed here.
 */
import type { EncounterAttack, EncounterDef, EncounterStep, EncounterUnit } from "./encounterTypes";

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isVec2(v: unknown): v is { x: number; y: number } {
  return typeof v === "object" && v !== null && isNumber((v as Record<string, unknown>).x) && isNumber((v as Record<string, unknown>).y);
}

function isEncounterStep(v: unknown): v is EncounterStep {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    isVec2(s.pos) &&
    typeof s.actionId === "string" &&
    isNumber(s.time) &&
    isNumber(s.speedMultiplier) &&
    (s.handleOut === null || isVec2(s.handleOut)) &&
    (s.handleIn === null || isVec2(s.handleIn))
  );
}

function isEncounterAttack(v: unknown): v is EncounterAttack {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.partId === "string" &&
    typeof a.weaponId === "string" &&
    isNumber(a.time) &&
    isNumber(a.durationMs) &&
    (a.aimAngleOverride === null || isNumber(a.aimAngleOverride))
  );
}

function isEncounterUnit(v: unknown): v is EncounterUnit {
  if (typeof v !== "object" || v === null) return false;
  const u = v as Record<string, unknown>;
  return (
    typeof u.id === "string" &&
    typeof u.unitDefId === "string" &&
    Array.isArray(u.steps) &&
    u.steps.every(isEncounterStep) &&
    Array.isArray(u.attacks) &&
    u.attacks.every(isEncounterAttack)
  );
}

export function isValidEncounter(v: unknown): v is EncounterDef {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === "string" && typeof e.name === "string" && isNumber(e.weight) && Array.isArray(e.units) && e.units.every(isEncounterUnit);
}
