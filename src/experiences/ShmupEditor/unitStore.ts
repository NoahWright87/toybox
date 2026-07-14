/**
 * fsStore-backed persistence for the Unit library, the in-progress Unit
 * draft, and the in-progress tile-editing session (specs/shmup-editor.todo.md,
 * E2 #192 — reworked per the "Design Handoff v2" doc). Per root
 * `CLAUDE.md`'s mandatory rule: anything that saves data uses the virtual
 * filesystem, never raw localStorage — mirrors tileStore.ts's pattern.
 *
 * A Unit now owns its own behavior — a buffet of Actions (movement/
 * animation) plus a set of Parts, each owning its own buffet of Weapons
 * (see unitTypes.ts) — so that validation lives here, against
 * `UnitDef.actions`/`UnitDef.parts`, not in encounterValidation.ts (which
 * only validates the much simpler step-list/attack-track *placement*
 * shape encounters actually save — a partId/weaponId string reference,
 * not the Part/Weapon definitions themselves).
 */
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { SHMUP_EDITOR_TILE_DRAFT_ID, SHMUP_EDITOR_UNIT_DRAFT_ID, SHMUP_EDITOR_UNITS_ID } from "../NsDoors97/filesystem/types";
import { isValidEncounter } from "./encounterValidation";
import type { EncounterDef } from "./encounterTypes";
import { createDefaultUnitLibrary, type ActionDef, type AnimationState, type UnitDef, type UnitPart, type WeaponDef } from "./unitTypes";
import type { TileDef } from "./types";

// v6: Attacks moved off ActionDef entirely and onto a Unit's Parts
// (Parts/weapon-track pass) — ActionDef dropped `attack`, UnitDef gained
// `parts: UnitPart[]`, and the old BulletDef/MovementBehavior/AttackPayload
// shapes were replaced by WeaponDef (which spawns a Unit by id instead of
// an inline bullet struct; see unitTypes.ts). Bumping so a pre-v6 save
// (missing `parts`, or an Action still carrying the old `attack` field)
// resets rather than silently mismatching the new shape.
// v7: UnitPart gained `spriteId`/`customSprite` (visual Part-position
// editor pass) — bumping for the same reason. This version also
// introduces default-library seeding (see `loadUnits` below), so a v6->v7
// reset now lands on one ready-to-use "Bullet" Unit instead of truly empty.
const SAVE_VERSION = 7;

interface SavedLibrary {
  version: number;
  units: UnitDef[];
}

interface SavedUnitDraft {
  version: number;
  session: UnitEditSession | null;
}

/**
 * The in-progress Unit editing session: the Unit itself (stats + actions +
 * parts saved-so-far) plus whichever single Action or Part is mid-edit, if
 * any — mirrors TileEditSession's shape below. A Part's own Weapons are
 * edited inline within the Part view (PartEditor.tsx) rather than getting
 * their own dedicated view/session slot, unlike Action — a Weapon's field
 * count is comparable to the old inline AttackPayloadForm, which never
 * needed one either.
 */
export interface UnitEditSession {
  unit: UnitDef;
  activeAction: ActionDef | null;
  activePart: UnitPart | null;
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isVec2(v: unknown): v is { x: number; y: number } {
  return typeof v === "object" && v !== null && isNumber((v as Record<string, unknown>).x) && isNumber((v as Record<string, unknown>).y);
}

const ANIMATION_STATES: AnimationState[] = ["idle", "moving", "attacking", "dying"];

function isActionDef(v: unknown): v is ActionDef {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return typeof a.id === "string" && typeof a.name === "string" && (ANIMATION_STATES as string[]).includes(a.animationState as string) && typeof a.visible === "boolean";
}

function isWeaponDef(v: unknown): v is WeaponDef {
  if (typeof v !== "object" || v === null) return false;
  const w = v as Record<string, unknown>;
  return (
    typeof w.id === "string" &&
    typeof w.name === "string" &&
    (w.aimMode === "fixed" || w.aimMode === "player") &&
    typeof w.trackPlayer === "boolean" &&
    isNumber(w.fixedAngleDeg) &&
    isNumber(w.arcStartDeg) &&
    isNumber(w.arcEndDeg) &&
    isNumber(w.count) &&
    (w.spacing === "even" || w.spacing === "random") &&
    isNumber(w.perShotDelayMs) &&
    isNumber(w.sweepSpeedDeg) &&
    typeof w.pingPong === "boolean" &&
    isNumber(w.fireIntervalMs) &&
    isNumber(w.telegraphMs) &&
    (w.spawnUnitId === null || typeof w.spawnUnitId === "string") &&
    isNumber(w.spawnScale)
  );
}

function isUnitPart(v: unknown): v is UnitPart {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    isVec2(p.offset) &&
    typeof p.spriteId === "string" &&
    (p.customSprite === null || typeof p.customSprite === "string") &&
    Array.isArray(p.weapons) &&
    p.weapons.every(isWeaponDef)
  );
}

/** Defensive shape check (same spirit as tileStore.ts's isValidTileDef) — a corrupt or stale-shape save falls back to an empty/null result rather than crashing. */
function isValidUnitDef(v: unknown): v is UnitDef {
  if (typeof v !== "object" || v === null) return false;
  const u = v as Record<string, unknown>;
  return (
    typeof u.id === "string" &&
    typeof u.name === "string" &&
    typeof u.spriteId === "string" &&
    (u.customSprite === null || typeof u.customSprite === "string") &&
    typeof u.hp === "number" &&
    typeof u.contactDamage === "number" &&
    typeof u.scoreValue === "number" &&
    typeof u.speed === "number" &&
    typeof u.turnRate === "number" &&
    typeof u.size === "number" &&
    Array.isArray(u.actions) &&
    u.actions.every(isActionDef) &&
    Array.isArray(u.parts) &&
    u.parts.every(isUnitPart)
  );
}

/**
 * A brand-new install (`content` empty) or a version-mismatched/corrupt
 * save (same fallback every prior version bump already used) both land
 * here — seeded with the default Unit library rather than a truly empty
 * one, so the editor never opens to a totally blank Unit picker. The seed
 * is saved immediately so it's a real, editable/deletable library entry
 * from the next load onward, not silently regenerated every time.
 */
function seedAndPersistDefaultLibrary(): UnitDef[] {
  const units = createDefaultUnitLibrary();
  saveUnits(units);
  return units;
}

export function loadUnits(): UnitDef[] {
  const content = fsStore.getFile(SHMUP_EDITOR_UNITS_ID)?.content;
  if (!content) return seedAndPersistDefaultLibrary();
  try {
    const parsed = JSON.parse(content) as SavedLibrary;
    if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.units)) return seedAndPersistDefaultLibrary();
    return parsed.units.filter(isValidUnitDef);
  } catch {
    return seedAndPersistDefaultLibrary();
  }
}

export function saveUnits(units: UnitDef[]): void {
  const saved: SavedLibrary = { version: SAVE_VERSION, units };
  fsStore.writeFile(SHMUP_EDITOR_UNITS_ID, JSON.stringify(saved));
}

/** The in-progress Unit-editing session, if a reload/rotation interrupted it — null if there's nothing to resume. */
export function loadUnitDraft(): UnitEditSession | null {
  const content = fsStore.getFile(SHMUP_EDITOR_UNIT_DRAFT_ID)?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as SavedUnitDraft;
    if (parsed.version !== SAVE_VERSION || !parsed.session) return null;
    const { unit, activeAction, activePart } = parsed.session;
    if (!isValidUnitDef(unit)) return null;
    if (activeAction !== null && !isActionDef(activeAction)) return null;
    if (activePart !== null && !isUnitPart(activePart)) return null;
    return { unit, activeAction, activePart };
  } catch {
    return null;
  }
}

export function saveUnitDraft(session: UnitEditSession): void {
  const saved: SavedUnitDraft = { version: SAVE_VERSION, session };
  fsStore.writeFile(SHMUP_EDITOR_UNIT_DRAFT_ID, JSON.stringify(saved));
}

export function clearUnitDraft(): void {
  fsStore.writeFile(SHMUP_EDITOR_UNIT_DRAFT_ID, "");
}

// ── Tile-editing session (tile fields + encounters + mid-edit encounter) ──

// v2: EncounterStep's shape changed (Trigger -> time, timeline scrubber
// pass) — bumping so a pre-v2 session with the old trigger shape resets
// instead of failing isValidEncounter's step check silently.
// v3: EncounterStep gained handleIn/handleOut (bezier-curve movement
// pass) — bumping for the same reason.
// v4: EncounterUnit gained `attacks: EncounterAttack[]` (Parts/weapon-track
// pass) — bumping for the same reason.
const TILE_SESSION_VERSION = 4;

export interface TileEditSession {
  tile: TileDef;
  /** Non-null only while a specific encounter within `tile` is mid-edit (view === "encounter-edit") — not yet merged into tile.encounters. */
  activeEncounter: EncounterDef | null;
}

interface SavedTileSession {
  version: number;
  session: TileEditSession | null;
}

function isValidEdgeSlotLike(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.tag === "string" && typeof s.hardwall === "boolean";
}

/** Minimal shape check for the session's embedded tile — same fields tileStore.ts's isValidTileDef checks, plus encounters. */
function isValidSessionTile(v: unknown): v is TileDef {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    (t.footprint === 1 || t.footprint === 2 || t.footprint === 3) &&
    Array.isArray(t.north) &&
    t.north.every(isValidEdgeSlotLike) &&
    Array.isArray(t.south) &&
    t.south.every(isValidEdgeSlotLike) &&
    isValidEdgeSlotLike(t.east) &&
    isValidEdgeSlotLike(t.west) &&
    typeof t.isConnector === "boolean" &&
    typeof t.weight === "number" &&
    typeof t.imageId === "string" &&
    Array.isArray(t.encounters) &&
    t.encounters.every(isValidEncounter)
  );
}

export function loadTileSession(): TileEditSession | null {
  const content = fsStore.getFile(SHMUP_EDITOR_TILE_DRAFT_ID)?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as SavedTileSession;
    if (parsed.version !== TILE_SESSION_VERSION || !parsed.session) return null;
    const { tile, activeEncounter } = parsed.session;
    if (!isValidSessionTile(tile)) return null;
    if (activeEncounter !== null && !isValidEncounter(activeEncounter)) return null;
    return { tile, activeEncounter };
  } catch {
    return null;
  }
}

export function saveTileSession(session: TileEditSession): void {
  const saved: SavedTileSession = { version: TILE_SESSION_VERSION, session };
  fsStore.writeFile(SHMUP_EDITOR_TILE_DRAFT_ID, JSON.stringify(saved));
}

export function clearTileSession(): void {
  fsStore.writeFile(SHMUP_EDITOR_TILE_DRAFT_ID, "");
}
