/**
 * Defensive shape validation for EncounterDef (specs/shmup-editor.todo.md,
 * E2 #192 — reworked per the "Design Handoff v2" doc; E3 #193 added
 * `EncounterUnit.scaling`). Shared by tileStore.ts (encounters embedded in
 * a saved tile) and the tile-editing session draft. Same spirit as
 * tileStore.ts's isValidTileDef: a corrupt or stale-shape encounter
 * (including a hand-edited TILES.DAT/DRAFT.DAT, which this hackable app
 * explicitly permits per root CLAUDE.md) is rejected rather than crashing.
 *
 * `EncounterUnit.scaling` is validated strictly (not treated as a
 * purely-additive optional field the way `TileDef.customImage` is) — same
 * precedent as the Parts/attack-track pass, which bumped SAVE_VERSION/
 * TILE_SESSION_VERSION for `EncounterUnit` gaining `attacks`. A pre-E3
 * encounter unit is genuinely missing required scaling fields, not just
 * one optional one, so tileStore.ts/unitStore.ts reset on version mismatch
 * instead of this file trying to backfill a whole nested object's defaults.
 */
import type { EncounterAttack, EncounterDef, EncounterStep, EncounterUnit } from "./encounterTypes";
import type { ScalingShapeKind, UnitScaling } from "./unitScaling";

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
    typeof s.visible === "boolean" &&
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

const SCALING_SHAPES: ScalingShapeKind[] = ["curve", "v", "grid", "ring"];

function isUnitScaling(v: unknown): v is UnitScaling {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    isNumber(s.maxCount) &&
    isNumber(s.minCostPerInstance) &&
    isNumber(s.spawnDelayMs) &&
    typeof s.shape === "string" &&
    (SCALING_SHAPES as string[]).includes(s.shape) &&
    Array.isArray(s.curvePoints) &&
    s.curvePoints.every(isVec2) &&
    isVec2(s.curveEnd) &&
    isVec2(s.vTip) &&
    isNumber(s.vWidth) &&
    isNumber(s.gridWidth) &&
    isNumber(s.gridDepth) &&
    isVec2(s.ringCenterOffset) &&
    isNumber(s.ringRadius) &&
    typeof s.pingPong === "boolean" &&
    (s.pingPongOverride === null || isNumber(s.pingPongOverride))
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
    u.attacks.every(isEncounterAttack) &&
    isUnitScaling(u.scaling)
  );
}

export function isValidEncounter(v: unknown): v is EncounterDef {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === "string" && typeof e.name === "string" && isNumber(e.weight) && Array.isArray(e.units) && e.units.every(isEncounterUnit);
}
