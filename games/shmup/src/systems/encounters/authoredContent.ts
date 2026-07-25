/**
 * Loads `/shmup-editor`'s authored content into the game.
 *
 * The editor persists through Doors 97's virtual filesystem (root
 * `CLAUDE.md`'s mandatory rule) as `TILES.DAT` / `UNITS.DAT` under
 * `C:\Programs\Accessories\Shmup Editor\`. SHMUP is a separately-built
 * bundle served full-page at `/shmup/`, so it can't import the live
 * `fsStore` singleton without dragging the whole Doors React app into this
 * package — but both run on the same origin and share the `ns97_fs_v1`
 * localStorage blob. This reads that blob directly, the same same-origin
 * precedent `sprites/fsOverride.ts` (read-only art overrides) and
 * `save/doorsFsSaveStore.ts` (read-write saves) already set.
 *
 * Both files carry **stable node ids** (`filesystem/types.ts`'s
 * `SHMUP_EDITOR_TILES_ID` / `SHMUP_EDITOR_UNITS_ID`), so this needs no path
 * walk at all — just a map lookup.
 *
 * **Validation is deliberately per-record, not all-or-nothing.** These
 * files are explicitly hackable in Notebook (root `CLAUDE.md`: "open the
 * file, edit the number, save"), so one mangled Unit drops that Unit rather
 * than blanking the library. A version mismatch *is* all-or-nothing — a
 * pre-v9 save's Action/step shape isn't something to half-read.
 */
import type {
  AuthoredAction,
  AuthoredAttack,
  AuthoredCollisionGroup,
  AuthoredContent,
  AuthoredEdgeSlot,
  AuthoredEncounter,
  AuthoredEncounterUnit,
  AuthoredPart,
  AuthoredPartActionPlacement,
  AuthoredScaling,
  AuthoredStep,
  AuthoredTile,
  AuthoredUnitDef,
  Vec2,
} from "./authoredTypes";
import { EMPTY_AUTHORED_CONTENT, slotTag } from "./authoredTypes";
import type { TileDef } from "../levels/types";

const FS_STORAGE_KEY = "ns97_fs_v1";
const TILES_NODE_ID = "fs:shmup-editor-tiles";
const UNITS_NODE_ID = "fs:shmup-editor-units";

/**
 * Must match `src/experiences/ShmupEditor/tileStore.ts` and
 * `unitStore.ts`'s `SAVE_VERSION`. Both are at 9 (the "Actions are back"
 * shape). Bump here in lockstep whenever either bumps there, or the game
 * silently stops seeing authored content.
 */
export const AUTHORED_TILES_VERSION = 9;
export const AUTHORED_UNITS_VERSION = 9;

interface FsNodeLite {
  id: string;
  kind: "file" | "folder" | "shortcut";
  name: string;
  parentId: string | null;
  content?: string;
}

// ── Shape guards (mirroring the editor's own store-side validators) ────────

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function isVec2(v: unknown): v is Vec2 {
  return typeof v === "object" && v !== null && isNum((v as Vec2).x) && isNum((v as Vec2).y);
}
function isNullableVec2(v: unknown): v is Vec2 | null {
  return v === null || isVec2(v);
}

const COLLISION_GROUPS: AuthoredCollisionGroup[] = ["enemy", "friendly", "enemyProjectile", "friendlyProjectile"];

function isAttack(v: unknown): v is AuthoredAttack {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    isNum(a.arcStartDeg) &&
    isNum(a.arcEndDeg) &&
    isNum(a.count) &&
    (a.spacing === "even" || a.spacing === "random") &&
    isNum(a.perShotDelayMs) &&
    isNum(a.sweepSpeedDeg) &&
    typeof a.pingPong === "boolean" &&
    isNum(a.burstIntervalMs) &&
    isNum(a.telegraphMs) &&
    (a.repeatCount === null || isNum(a.repeatCount)) &&
    (a.spawnUnitId === null || isStr(a.spawnUnitId)) &&
    isNum(a.spawnScale) &&
    isStr(a.spawnGroup) &&
    (COLLISION_GROUPS as string[]).includes(a.spawnGroup)
  );
}

function isAction(v: unknown): v is AuthoredAction {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    isStr(a.id) &&
    isStr(a.name) &&
    isNum(a.movementPercent) &&
    (a.facing === "fixed" || a.facing === "faceMovement" || a.facing === "facePlayer") &&
    isNum(a.fixedFacingDeg) &&
    (a.setsInvincible === null || typeof a.setsInvincible === "boolean") &&
    typeof a.requiresInvincible === "boolean" &&
    (a.attack === null || isAttack(a.attack))
  );
}

function isPart(v: unknown): v is AuthoredPart {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    isStr(p.id) &&
    isStr(p.name) &&
    isVec2(p.offset) &&
    isStr(p.spriteId) &&
    (p.customSprite === null || isStr(p.customSprite)) &&
    typeof p.hasHitbox === "boolean" &&
    typeof p.hasHealth === "boolean" &&
    isNum(p.hp) &&
    isNum(p.damageMultiplier) &&
    Array.isArray(p.actions) &&
    p.actions.every(isAction)
  );
}

export function isAuthoredUnitDef(v: unknown): v is AuthoredUnitDef {
  if (typeof v !== "object" || v === null) return false;
  const u = v as Record<string, unknown>;
  return (
    isStr(u.id) &&
    isStr(u.name) &&
    isStr(u.spriteId) &&
    (u.customSprite === null || isStr(u.customSprite)) &&
    isNum(u.hp) &&
    isNum(u.contactDamage) &&
    isNum(u.scoreValue) &&
    isNum(u.speed) &&
    isNum(u.turnRate) &&
    isNum(u.size) &&
    (u.layer === "ground" || u.layer === "air" || u.layer === "doodad") &&
    (u.defaultActionId === null || isStr(u.defaultActionId)) &&
    Array.isArray(u.actions) &&
    u.actions.every(isAction) &&
    Array.isArray(u.parts) &&
    u.parts.every(isPart)
  );
}

function isStep(v: unknown): v is AuthoredStep {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    isStr(s.id) &&
    isVec2(s.pos) &&
    isNum(s.time) &&
    (s.actionId === null || isStr(s.actionId)) &&
    isNullableVec2(s.handleIn) &&
    isNullableVec2(s.handleOut)
  );
}

function isPartActionPlacement(v: unknown): v is AuthoredPartActionPlacement {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return isStr(p.id) && isStr(p.partId) && isNum(p.time) && (p.actionId === null || isStr(p.actionId));
}

function isScaling(v: unknown): v is AuthoredScaling {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    isNum(s.maxCount) &&
    isNum(s.minCostPerInstance) &&
    isNum(s.spawnDelayMs) &&
    (s.shape === "curve" || s.shape === "v" || s.shape === "grid" || s.shape === "ring") &&
    Array.isArray(s.curvePoints) &&
    s.curvePoints.every(isVec2) &&
    isVec2(s.curveEnd) &&
    isVec2(s.vTip) &&
    isNum(s.vWidth) &&
    isNum(s.gridWidth) &&
    isNum(s.gridDepth) &&
    isVec2(s.ringCenterOffset) &&
    isNum(s.ringRadius) &&
    typeof s.pingPong === "boolean" &&
    (s.pingPongOverride === null || isNum(s.pingPongOverride))
  );
}

function isEncounterUnit(v: unknown): v is AuthoredEncounterUnit {
  if (typeof v !== "object" || v === null) return false;
  const u = v as Record<string, unknown>;
  return (
    isStr(u.id) &&
    isStr(u.unitDefId) &&
    Array.isArray(u.steps) &&
    u.steps.every(isStep) &&
    Array.isArray(u.partActions) &&
    u.partActions.every(isPartActionPlacement) &&
    isScaling(u.scaling)
  );
}

export function isAuthoredEncounter(v: unknown): v is AuthoredEncounter {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    isStr(e.id) &&
    isStr(e.name) &&
    isNum(e.weight) &&
    Array.isArray(e.units) &&
    e.units.every(isEncounterUnit)
  );
}

function isEdgeSlot(v: unknown): v is AuthoredEdgeSlot {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return isStr(s.tag) && typeof s.hardwall === "boolean";
}

export function isAuthoredTile(v: unknown): v is AuthoredTile {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    isStr(t.id) &&
    isStr(t.name) &&
    (t.footprint === 1 || t.footprint === 2 || t.footprint === 3) &&
    Array.isArray(t.north) &&
    t.north.every(isEdgeSlot) &&
    t.north.length === t.footprint &&
    Array.isArray(t.south) &&
    t.south.every(isEdgeSlot) &&
    t.south.length === t.footprint &&
    isEdgeSlot(t.east) &&
    isEdgeSlot(t.west) &&
    typeof t.isConnector === "boolean" &&
    isNum(t.weight) &&
    isStr(t.imageId)
  );
}

/** `encounters` and `customImage` are additive fields the editor also normalizes rather than rejecting a whole tile over — same treatment here. */
function normalizeTile(tile: AuthoredTile): AuthoredTile {
  const customImage = isStr(tile.customImage) && tile.customImage ? tile.customImage : null;
  const encounters = Array.isArray(tile.encounters) ? tile.encounters.filter(isAuthoredEncounter) : [];
  return { ...tile, customImage, encounters };
}

// ── Parsing ────────────────────────────────────────────────────────────────

/** Parses a `TILES.DAT` payload. Returns `[]` on a version mismatch, bad JSON, or a non-array `tiles`. */
export function parseAuthoredTiles(raw: string | undefined): AuthoredTile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; tiles?: unknown };
    if (parsed.version !== AUTHORED_TILES_VERSION || !Array.isArray(parsed.tiles)) return [];
    return parsed.tiles.filter(isAuthoredTile).map(normalizeTile);
  } catch {
    return [];
  }
}

/** Parses a `UNITS.DAT` payload. Same failure modes as `parseAuthoredTiles`. */
export function parseAuthoredUnits(raw: string | undefined): AuthoredUnitDef[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; units?: unknown };
    if (parsed.version !== AUTHORED_UNITS_VERSION || !Array.isArray(parsed.units)) return [];
    return parsed.units.filter(isAuthoredUnitDef);
  } catch {
    return [];
  }
}

// ── FS access ──────────────────────────────────────────────────────────────

function readFsNodes(): Map<string, FsNodeLite> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(FS_STORAGE_KEY);
    if (!raw) return undefined;
    return new Map(JSON.parse(raw) as [string, FsNodeLite][]);
  } catch {
    return undefined;
  }
}

let cached: AuthoredContent | null = null;

/**
 * The authored library. Cached for the life of the page — the FS blob can
 * carry embedded custom art as data URLs, so re-parsing it every scene
 * start would be real waste. Pass `{ refresh: true }` from anywhere the
 * player could plausibly have just edited content in another tab (the
 * encounter picker does).
 */
export function loadAuthoredContent(options: { refresh?: boolean } = {}): AuthoredContent {
  if (cached && !options.refresh) return cached;
  const nodes = readFsNodes();
  if (!nodes) {
    cached = EMPTY_AUTHORED_CONTENT;
    return cached;
  }
  cached = {
    tiles: parseAuthoredTiles(nodes.get(TILES_NODE_ID)?.content),
    units: parseAuthoredUnits(nodes.get(UNITS_NODE_ID)?.content),
  };
  return cached;
}

// ── Lookups ────────────────────────────────────────────────────────────────

export function tileById(content: AuthoredContent, tileId: string): AuthoredTile | undefined {
  return content.tiles.find((t) => t.id === tileId);
}

export function encounterById(tile: AuthoredTile, encounterId: string): AuthoredEncounter | undefined {
  return tile.encounters.find((e) => e.id === encounterId);
}

export function unitById(content: AuthoredContent, unitId: string): AuthoredUnitDef | undefined {
  return content.units.find((u) => u.id === unitId);
}

/** Only tiles with at least one encounter are worth offering as something to play. */
export function playableTiles(content: AuthoredContent): AuthoredTile[] {
  return content.tiles.filter((t) => t.encounters.length > 0);
}

/**
 * Projects an authored tile down to the shape `systems/levels`'
 * grid-fill generator consumes — edges + footprint + weight, art and
 * encounters dropped. The bridge that lets a level assembled from authored
 * tiles run through the generator/edge-matcher that already exists.
 *
 * `isConnector` deliberately doesn't translate into anything: neither
 * matcher (this package's `orientation.ts` or the editor's) consults it —
 * "matches any incoming edge" is expressed by the author literally tagging
 * that edge `*` (WILDCARD), which `slotTag` carries through as-is. The flag
 * is an authoring label, not a matching rule.
 */
export function authoredToGeneratorTile(tile: AuthoredTile): TileDef {
  return {
    id: tile.id,
    footprint: tile.footprint,
    north: tile.north.map(slotTag),
    south: tile.south.map(slotTag),
    east: slotTag(tile.east),
    west: slotTag(tile.west),
    weight: tile.weight,
  };
}
