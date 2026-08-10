/**
 * The **authored content** data model — the runtime-side mirror of what
 * `/shmup-editor` saves into `TILES.DAT` / `UNITS.DAT`
 * (`src/experiences/ShmupEditor/types.ts`, `unitTypes.ts`,
 * `encounterTypes.ts`, `unitScaling.ts`).
 *
 * **Independently declared, not imported.** The editor lives in the main
 * Doors 97 React app and this is a separately-built Phaser bundle; per
 * `specs/shmup-editor.todo.md` the two share *no runtime code*, only the
 * exported JSON **shape**. That's the same stance the editor already takes
 * in the other direction (it re-declares `TILE_UNIT`, the game's aspect
 * ratio, and the player hitbox radius rather than importing them).
 *
 * Names are prefixed `Authored*` so nothing here collides with the game's
 * own `systems/levels/types.ts` `TileDef` — that one is the *generator's*
 * tile (edges + footprint only, no art, no encounters); this one is the
 * full authoring record the editor persists. `authoredToGeneratorTile()`
 * in `authoredContent.ts` converts between them.
 *
 * Fields the runtime does not consume yet are still declared, so a save
 * round-trips faithfully and a later pass can pick them up without another
 * schema archaeology dig.
 */

// ── Shared primitives ──────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export type EdgeTag = string;

/** Reserved edge tag: nothing may connect here. Matches the generator's `systems/levels/types.ts` HARDWALL. */
export const HARDWALL: EdgeTag = "hardwall";
/** Reserved edge tag: matches any frontier tag — start/end connector tiles. */
export const WILDCARD: EdgeTag = "*";

/** Width in columns; height is always exactly one row. */
export type AuthoredFootprint = 1 | 2 | 3;

/** One north/south connector slot: a free-text tag, or the hard-wall marker (which wins regardless of the tag text — see `slotTag`). */
export interface AuthoredEdgeSlot {
  tag: EdgeTag;
  hardwall: boolean;
}

/** The tag a slot actually carries for matching purposes. */
export function slotTag(slot: AuthoredEdgeSlot): EdgeTag {
  return slot.hardwall ? HARDWALL : slot.tag.trim();
}

// ── Units ──────────────────────────────────────────────────────────────────

/**
 * Flat, fixed set — a spawned projectile's group is authored directly on
 * the `AuthoredAttack` that spawns it, never inherited from whatever fired
 * it. The runtime collision matrix (`EncounterRunner` + `PlayScene`'s
 * overlaps) is what enforces "same group never checks itself" and "the two
 * projectile groups never check each other."
 */
export type AuthoredCollisionGroup = "enemy" | "friendly" | "enemyProjectile" | "friendlyProjectile";

/** Spawn-roster tag on the Unit itself. Not consumed by the runner yet — spawn selection (L5 #187) is what will read it. */
export type AuthoredUnitLayer = "ground" | "air" | "doodad";

export type AuthoredFacingMode = "fixed" | "faceMovement" | "facePlayer";

export interface AuthoredAttack {
  /** Arc range in degrees relative to the owning Action's resolved facing. */
  arcStartDeg: number;
  arcEndDeg: number;
  /** Shots per burst, spread across the arc. */
  count: number;
  spacing: "even" | "random";
  /** Time between individual shots *within* one burst, ms. */
  perShotDelayMs: number;
  /** Arc rotation speed, deg/sec — 0 = static arc. */
  sweepSpeedDeg: number;
  pingPong: boolean;
  /** Time between bursts, ms. */
  burstIntervalMs: number;
  /** Wind-up before the first burst, ms. */
  telegraphMs: number;
  /** How many bursts before the attack is done; null = fire as long as the Action keeps running. */
  repeatCount: number | null;
  /** The Unit spawned as the projectile — null fires nothing. */
  spawnUnitId: string | null;
  spawnScale: number;
  spawnGroup: AuthoredCollisionGroup;
}

export interface AuthoredAction {
  id: string;
  name: string;
  /** 0–100, percent of the owning Unit's fixed `speed`. */
  movementPercent: number;
  facing: AuthoredFacingMode;
  /** Only meaningful when facing === "fixed". Degrees, 0 = +x/right, 90 = +y/down. */
  fixedFacingDeg: number;
  /** null = carries the previous value forward; true/false sets it. */
  setsInvincible: boolean | null;
  requiresInvincible: boolean;
  /** null = pure movement/facing/state, fires nothing. */
  attack: AuthoredAttack | null;
}

export interface AuthoredPart {
  id: string;
  name: string;
  /** Offset from the Unit's origin, in the editor's Part-position space — see `spriteScale.ts`. */
  offset: Vec2;
  spriteId: string;
  customSprite: string | null;
  hasHitbox: boolean;
  hasHealth: boolean;
  hp: number;
  damageMultiplier: number;
  actions: AuthoredAction[];
}

export interface AuthoredUnitDef {
  id: string;
  name: string;
  spriteId: string;
  customSprite: string | null;
  hp: number;
  contactDamage: number;
  scoreValue: number;
  /** Fixed max travel speed along the encounter's bezier curves, px/sec. */
  speed: number;
  /** Slowest speed this Unit can sustain, px/sec. 0 = it can stop, and therefore pivot on the spot; above 0 it must arc through every corner (`turning.ts`). */
  minSpeed: number;
  /** How fast it can change heading, degrees/sec. With `minSpeed` this gives its minimum turning radius, which is what shapes the path it flies (`pathSolver.ts`). */
  turnRateDegPerSec: number;
  /** Hitbox radius, px. */
  size: number;
  /** The Difficulty share one instance of this Unit needs to justify existing — authored once per Unit rather than per Encounter placement, see `AuthoredScaling`'s file-header note on where `minCostPerInstance` went. `resolveScaling` (`scaling.ts`) takes this directly. */
  cost: number;
  layer: AuthoredUnitLayer;
  /** The Action a dynamically-spawned instance (a projectile) runs — it has no steps to draw one from. */
  defaultActionId: string | null;
  actions: AuthoredAction[];
  parts: AuthoredPart[];
  createdAt: number;
  modifiedAt: number;
}

// ── Per-instance scaling ───────────────────────────────────────────────────

export type AuthoredScalingShape = "curve" | "v" | "grid" | "ring";

/**
 * `minCostPerInstance` used to live here, per placement — it moved onto
 * `AuthoredUnitDef.cost` instead, so a Unit's Difficulty budget is
 * authored once and shared by every Encounter that places it, rather than
 * each Encounter setting its own price for the same Unit. `resolveScaling`
 * (`scaling.ts`) now takes the owning Unit's cost as a separate parameter.
 */
export interface AuthoredScaling {
  maxCount: number;
  spawnDelayMs: number;
  shape: AuthoredScalingShape;
  curvePoints: Vec2[];
  curveEnd: Vec2;
  vTip: Vec2;
  vWidth: number;
  gridWidth: number;
  gridDepth: number;
  ringRadius: number;
  pingPong: boolean;
  pingPongOverride: number | null;
}

// ── Encounters ─────────────────────────────────────────────────────────────

export interface AuthoredStep {
  id: string;
  /** Tile-local position. See `frame.ts` for the tile-local -> screen mapping. */
  pos: Vec2;
  /** Seconds from encounter start — one shared clock across every instance in the encounter. */
  time: number;
  /** Which of the owning Unit's own Actions governs the segment *leaving* this step. */
  actionId: string | null;
  handleOut: Vec2 | null;
  handleIn: Vec2 | null;
}

export interface AuthoredPartActionPlacement {
  id: string;
  partId: string;
  /** Seconds from encounter start — same clock as steps. */
  time: number;
  actionId: string | null;
}

export interface AuthoredEncounterUnit {
  id: string;
  unitDefId: string;
  steps: AuthoredStep[];
  partActions: AuthoredPartActionPlacement[];
  scaling: AuthoredScaling;
}

export interface AuthoredEncounter {
  id: string;
  name: string;
  /** Relative weight when a tile has several encounters and one is picked at random. */
  weight: number;
  units: AuthoredEncounterUnit[];
  createdAt: number;
  modifiedAt: number;
}

export interface AuthoredTile {
  id: string;
  name: string;
  footprint: AuthoredFootprint;
  north: AuthoredEdgeSlot[];
  south: AuthoredEdgeSlot[];
  east: AuthoredEdgeSlot;
  west: AuthoredEdgeSlot;
  isConnector: boolean;
  weight: number;
  /** Id into the editor's built-in tile-art set, or "custom" when `customImage` is in use. */
  imageId: string;
  /** User-uploaded art as a data URL, or null. */
  customImage: string | null;
  encounters: AuthoredEncounter[];
  createdAt: number;
  modifiedAt: number;
}

/** Everything `/shmup-editor` has authored on this origin. */
export interface AuthoredContent {
  tiles: AuthoredTile[];
  units: AuthoredUnitDef[];
}

export const EMPTY_AUTHORED_CONTENT: AuthoredContent = { tiles: [], units: [] };
