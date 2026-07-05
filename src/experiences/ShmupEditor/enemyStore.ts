/**
 * fsStore-backed persistence for the enemy library, the in-progress enemy
 * draft, and the in-progress tile-editing session (specs/shmup-editor.todo.md,
 * E2 #192). Per root CLAUDE.md's mandatory rule: anything that saves data
 * uses the virtual filesystem, never raw localStorage — mirrors
 * tileStore.ts's pattern exactly.
 *
 * An enemy is just sprite + stats now (see enemyTypes.ts) — movement/dwell/
 * attack behavior lives on encounters instead (encounterTypes.ts), which
 * are embedded in a TILE's saved shape (tileStore.ts), not here. The
 * "tile session" draft below holds the tile currently being edited
 * (including its encounters list) PLUS whichever single encounter is
 * mid-edit, if any — root CLAUDE.md's mandatory in-progress-session rule
 * applies to the whole nested tile/encounter editing flow, not just the
 * top-level tile fields.
 */
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { SHMUP_EDITOR_ENEMIES_ID, SHMUP_EDITOR_ENEMY_DRAFT_ID, SHMUP_EDITOR_TILE_DRAFT_ID } from "../NsDoors97/filesystem/types";
import { isValidEncounter } from "./encounterValidation";
import type { EncounterDef } from "./encounterTypes";
import type { EnemyDef } from "./enemyTypes";
import type { TileDef } from "./types";

const SAVE_VERSION = 2;

interface SavedLibrary {
  version: number;
  enemies: EnemyDef[];
}

interface SavedEnemyDraft {
  version: number;
  enemy: EnemyDef | null;
}

/** Defensive shape check (same spirit as tileStore.ts's isValidTileDef) — a corrupt or stale-shape save falls back to an empty/null result rather than crashing. */
function isValidEnemyDef(v: unknown): v is EnemyDef {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.name === "string" &&
    typeof e.spriteId === "string" &&
    (e.customSprite === null || typeof e.customSprite === "string") &&
    typeof e.hp === "number" &&
    typeof e.contactDamage === "number" &&
    typeof e.scoreValue === "number" &&
    typeof e.baseSpeed === "number" &&
    typeof e.size === "number"
  );
}

export function loadEnemies(): EnemyDef[] {
  const content = fsStore.getFile(SHMUP_EDITOR_ENEMIES_ID)?.content;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as SavedLibrary;
    if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.enemies)) return [];
    return parsed.enemies.filter(isValidEnemyDef);
  } catch {
    return [];
  }
}

export function saveEnemies(enemies: EnemyDef[]): void {
  const saved: SavedLibrary = { version: SAVE_VERSION, enemies };
  fsStore.writeFile(SHMUP_EDITOR_ENEMIES_ID, JSON.stringify(saved));
}

/** The in-progress enemy being edited, if a reload/rotation interrupted a session — null if there's nothing to resume. */
export function loadEnemyDraft(): EnemyDef | null {
  const content = fsStore.getFile(SHMUP_EDITOR_ENEMY_DRAFT_ID)?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as SavedEnemyDraft;
    if (parsed.version !== SAVE_VERSION) return null;
    return parsed.enemy && isValidEnemyDef(parsed.enemy) ? parsed.enemy : null;
  } catch {
    return null;
  }
}

export function saveEnemyDraft(enemy: EnemyDef): void {
  const saved: SavedEnemyDraft = { version: SAVE_VERSION, enemy };
  fsStore.writeFile(SHMUP_EDITOR_ENEMY_DRAFT_ID, JSON.stringify(saved));
}

export function clearEnemyDraft(): void {
  fsStore.writeFile(SHMUP_EDITOR_ENEMY_DRAFT_ID, "");
}

// ── Tile-editing session (tile fields + encounters + mid-edit encounter) ──

const TILE_SESSION_VERSION = 1;

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
