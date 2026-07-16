/**
 * Defensive shape validation for EncounterDef (specs/shmup-editor.todo.md,
 * E2 #192 — reworked per the "Design Handoff v2" doc). Shared by
 * tileStore.ts (encounters embedded in a saved tile) and the tile-editing
 * session draft. Same spirit as tileStore.ts's isValidTileDef: a corrupt
 * or stale-shape encounter (including a hand-edited TILES.DAT/DRAFT.DAT,
 * which this hackable app explicitly permits per root CLAUDE.md) is
 * rejected rather than crashing.
 *
 * Much smaller than early versions: a step is just a position/time/
 * visibility/handles record now — no Action reference at all (the Action
 * buffet was cut entirely, see unitTypes.ts), no recursive graph/payload
 * validation needed here.
 *
 * **`spawnNodes` (E3 #193) is deliberately NOT part of the strict
 * `isValidEncounter` check** — same "purely additive optional field"
 * treatment tileStore.ts already gives `customImage`/`encounters` on
 * TileDef, so a pre-E3 saved encounter (missing the field entirely) stays
 * valid rather than having its whole `units`/steps content discarded over
 * one new array. `normalizeEncounter` below is what backfills it to `[]`
 * for every load site (tileStore.ts, unitStore.ts) — call it after
 * `isValidEncounter` passes, same two-step pattern tileStore.ts's
 * `normalizeTile` already uses.
 */
import type { EncounterAttack, EncounterDef, EncounterStep, EncounterUnit } from "./encounterTypes";
import type { CurveDef, CurveThreshold, CurveType } from "./difficultyCurve";
import type { SpawnNodeDef, SpawnOrigin } from "./spawnTypes";

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

const CURVE_TYPES: CurveType[] = ["flat", "linear", "capped", "stepped"];

function isCurveThreshold(v: unknown): v is CurveThreshold {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return isNumber(t.budget) && isNumber(t.value);
}

function isCurveDef(v: unknown): v is CurveDef {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.type === "string" &&
    (CURVE_TYPES as string[]).includes(c.type) &&
    isNumber(c.base) &&
    isNumber(c.rate) &&
    isNumber(c.cap) &&
    Array.isArray(c.thresholds) &&
    c.thresholds.every(isCurveThreshold)
  );
}

function isSpawnOrigin(v: unknown): v is SpawnOrigin {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    (o.type === "point" || o.type === "region" || o.type === "shape") &&
    isVec2(o.anchor) &&
    isNumber(o.regionWidth) &&
    isNumber(o.regionHeight) &&
    (o.shapeKind === "v" || o.shapeKind === "arc" || o.shapeKind === "line" || o.shapeKind === "grid") &&
    isNumber(o.spanStart) &&
    isNumber(o.spanEnd)
  );
}

function isSpawnNodeDef(v: unknown): v is SpawnNodeDef {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    typeof n.name === "string" &&
    (n.unitDefId === null || typeof n.unitDefId === "string") &&
    isSpawnOrigin(n.origin) &&
    (n.distribution === "random" || n.distribution === "ordered") &&
    isNumber(n.direction) &&
    typeof n.mirror === "boolean" &&
    isNumber(n.delayMs) &&
    isNumber(n.intervalMs) &&
    (n.countMode === "fixed" || n.countMode === "untilTileEnds") &&
    isNumber(n.minCount) &&
    isNumber(n.maxCount) &&
    isNumber(n.powerSplit) &&
    isCurveDef(n.countCurve)
  );
}

export function isValidEncounter(v: unknown): v is EncounterDef {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.name === "string" &&
    isNumber(e.weight) &&
    Array.isArray(e.units) &&
    e.units.every(isEncounterUnit) &&
    // Permissive on purpose — see file header. Absent = a pre-E3 save, valid; present must be well-shaped.
    (e.spawnNodes === undefined || (Array.isArray(e.spawnNodes) && e.spawnNodes.every(isSpawnNodeDef)))
  );
}

/** Backfills `spawnNodes` to `[]` (and drops any malformed entries) after `isValidEncounter` has already passed — call at every load site, same two-step pattern as tileStore.ts's `normalizeTile`. */
export function normalizeEncounter(encounter: EncounterDef): EncounterDef {
  const spawnNodes = Array.isArray(encounter.spawnNodes) ? encounter.spawnNodes.filter(isSpawnNodeDef) : [];
  return { ...encounter, spawnNodes };
}
