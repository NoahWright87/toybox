/**
 * fsStore-backed persistence for the Unit library, the in-progress Unit
 * draft, and the in-progress tile-editing session (specs/shmup-editor.todo.md,
 * E2 #192 — reworked per the "Design Handoff v2" doc). Per root
 * `CLAUDE.md`'s mandatory rule: anything that saves data uses the virtual
 * filesystem, never raw localStorage — mirrors tileStore.ts's pattern.
 *
 * A Unit now owns its own behavior (a buffet of Actions — see
 * unitTypes.ts), so the recursive movement/attack/bullet validation lives
 * here, validating `UnitDef.actions`, not in encounterValidation.ts
 * (which only validates the much simpler step-list shape encounters
 * actually save).
 */
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { SHMUP_EDITOR_TILE_DRAFT_ID, SHMUP_EDITOR_UNIT_DRAFT_ID, SHMUP_EDITOR_UNITS_ID } from "../NsDoors97/filesystem/types";
import { isValidEncounter } from "./encounterValidation";
import type { EncounterDef } from "./encounterTypes";
import type {
  ActionDef,
  AnimationState,
  AttackPayload,
  BulletDef,
  MovementBehavior,
  UnitDef,
} from "./unitTypes";
import type { TileDef } from "./types";

// v5: UnitDef's `baseSpeed` became `speed` plus a new `turnRate`, and
// ActionDef dropped `movement` entirely (bezier-curve movement pass —
// movement is now two plain Unit stats, not an Action-level choice; see
// unitTypes.ts). Bumping so a pre-v5 save (missing speed/turnRate, or an
// Action still carrying the old movement field) resets rather than
// silently mismatching the new shape.
const SAVE_VERSION = 5;

interface SavedLibrary {
  version: number;
  units: UnitDef[];
}

interface SavedUnitDraft {
  version: number;
  session: UnitEditSession | null;
}

/** The in-progress Unit editing session: the Unit itself (stats + actions saved-so-far) plus whichever single Action is mid-edit, if any — mirrors TileEditSession's shape below. */
export interface UnitEditSession {
  unit: UnitDef;
  activeAction: ActionDef | null;
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isMovement(v: unknown): v is MovementBehavior {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  switch (m.kind) {
    case "straightLine":
      return isNumber(m.speed) && isNumber(m.accel) && isNumber(m.turnRate);
    case "wave":
      return (
        isNumber(m.speed) &&
        isNumber(m.amplitude) &&
        isNumber(m.frequency) &&
        isNumber(m.phase) &&
        (m.waveform === "smooth" || m.waveform === "triangle" || m.waveform === "square")
      );
    case "spiral":
      return isNumber(m.speed) && isNumber(m.radius) && isNumber(m.angularSpeed) && isNumber(m.radiusGrowth);
    default:
      return false;
  }
}

// Bullet attack payloads can nest (a bullet's payload spawns another
// bullet, whose payload spawns another...) — this caps how deep a
// hand-edited save's nesting can go before validation just gives up and
// rejects it, rather than recursing unbounded on adversarial input.
const MAX_PAYLOAD_DEPTH = 32;

function isAttackPayload(v: unknown, depth: number): v is AttackPayload {
  if (depth > MAX_PAYLOAD_DEPTH) return false;
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.enabled === "boolean" &&
    (a.shape === "single" || a.shape === "arc" || a.shape === "radialBurst" || a.shape === "beam") &&
    (a.aim === "fixed" || a.aim === "aimed" || a.aim === "rotating") &&
    (a.trigger === "continuous" || a.trigger === "onDeath" || a.trigger === "onTrigger") &&
    isNumber(a.projectileCount) &&
    isNumber(a.arcSpreadDeg) &&
    isNumber(a.fixedAngleDeg) &&
    isNumber(a.rotationSpeedDeg) &&
    isNumber(a.intervalMs) &&
    isNumber(a.telegraphMs) &&
    isBullet(a.bullet, depth + 1)
  );
}

function isBullet(v: unknown, depth: number): v is BulletDef {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return typeof b.spriteId === "string" && (b.customSprite === null || typeof b.customSprite === "string") && isMovement(b.movement) && (b.attack === null || isAttackPayload(b.attack, depth));
}

const ANIMATION_STATES: AnimationState[] = ["idle", "moving", "attacking", "dying"];

function isActionDef(v: unknown): v is ActionDef {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.name === "string" &&
    (a.attack === null || isAttackPayload(a.attack, 0)) &&
    (ANIMATION_STATES as string[]).includes(a.animationState as string) &&
    typeof a.visible === "boolean"
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
    u.actions.every(isActionDef)
  );
}

export function loadUnits(): UnitDef[] {
  const content = fsStore.getFile(SHMUP_EDITOR_UNITS_ID)?.content;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as SavedLibrary;
    if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.units)) return [];
    return parsed.units.filter(isValidUnitDef);
  } catch {
    return [];
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
    const { unit, activeAction } = parsed.session;
    if (!isValidUnitDef(unit)) return null;
    if (activeAction !== null && !isActionDef(activeAction)) return null;
    return { unit, activeAction };
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
const TILE_SESSION_VERSION = 3;

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
