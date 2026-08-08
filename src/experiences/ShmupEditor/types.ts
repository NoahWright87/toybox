/**
 * Tile data model for the Shmup Editor (specs/shmup-editor.todo.md, E1 #191).
 * Deliberately self-contained — not imported from games/shmup/src/systems/levels/.
 * The editor's "tile" is a full-screen authoring unit; the game engine's
 * internal tile rendering is a different, smaller-grained concept. Only the
 * exported JSON *shape* is kept compatible with the game's L1 data model
 * (specs/games/shmup/levels-and-tiles.spec.todo.md), not the code.
 */
import { CUSTOM_IMAGE_ID, NONE_IMAGE_ID, tileImageById } from "./tileImages";
import {
  createEncounterUnit,
  makeEncounterId,
  makePartActionPlacementId,
  makeStepId,
  type EncounterDef,
  type EncounterStep,
  type EncounterUnit,
  type PartActionPlacement,
  type Vec2,
} from "./encounterTypes";
import { TILE_UNIT } from "./editorScale";
import { createDefaultScaling, type UnitScaling } from "./unitScaling";
import {
  enemyAttackActionId,
  enemyMoveActionId,
  enemyStrafeActionId,
  enemyTurretAttackActionId,
  enemyTurretPartId,
  enemyUnitId,
} from "./unitTypes";

export type EdgeTag = string;

/** Reserved edge tag: nothing may connect here (matches the game's L1 convention). */
export const HARDWALL: EdgeTag = "hardwall";

/** Reserved edge tag: matches any frontier tag — start/end connector tiles. */
export const WILDCARD: EdgeTag = "*";

/** Width in columns; height is always exactly 1 row (one "screen" unit). */
export type Footprint = 1 | 2 | 3;

export const FOOTPRINTS: Footprint[] = [1, 2, 3];

/** One north/south connector slot: a tag, or the hard-wall marker. */
export interface EdgeSlot {
  tag: EdgeTag;
  hardwall: boolean;
}

export function edgeSlot(tag: EdgeTag = "", hardwall = false): EdgeSlot {
  return { tag, hardwall };
}

/** The tag a slot actually carries for matching purposes — HARDWALL wins regardless of the free-text tag field. */
export function slotTag(slot: EdgeSlot): EdgeTag {
  return slot.hardwall ? HARDWALL : slot.tag.trim();
}

export interface TileDef {
  id: string;
  name: string;
  footprint: Footprint;
  /** One slot per column of the footprint, left-to-right in the tile's unrotated/unflipped orientation. */
  north: EdgeSlot[];
  south: EdgeSlot[];
  /** Single slot each — footprint height is always 1 row, so east/west never have multiple columns. */
  east: EdgeSlot;
  west: EdgeSlot;
  /** Start/end connector tile — south trivially matches any incoming edge (design doc §3.1). */
  isConnector: boolean;
  /** Relative weight when multiple tiles/orientations match the same frontier (default 1). */
  weight: number;
  /** Id into tileImages.ts's built-in image set, or CUSTOM_IMAGE_ID when `customImage` is in use — editor-only, not part of the exported gameplay shape. */
  imageId: string;
  /** User-uploaded art (downscaled square PNG data URL) for this tile, or null when using a built-in image. Only rendered when imageId === CUSTOM_IMAGE_ID. */
  customImage: string | null;
  /** Encounters a level generator can spawn on this tile — a random one (weighted) is picked when the tile appears in a level. See encounterTypes.ts. */
  encounters: EncounterDef[];
  createdAt: number;
  modifiedAt: number;
}

/** Resolves the actual image URL to render for a tile, accounting for a custom upload overriding the built-in set. */
export function resolveTileImageUrl(tile: TileDef): string | null {
  if (tile.imageId === CUSTOM_IMAGE_ID) return tile.customImage;
  return tileImageById(tile.imageId).url;
}

export function makeTileId(): string {
  return `tile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankTile(existingCount: number): TileDef {
  const now = Date.now();
  return {
    id: makeTileId(),
    name: `New Tile ${existingCount + 1}`,
    footprint: 1,
    north: [edgeSlot()],
    south: [edgeSlot()],
    east: edgeSlot("", true),
    west: edgeSlot("", true),
    isConnector: false,
    weight: 1,
    imageId: NONE_IMAGE_ID,
    customImage: null,
    encounters: [],
    createdAt: now,
    modifiedAt: now,
  };
}

/** Resizes a north/south slot array to match a new footprint, preserving existing slots and padding new ones blank. */
export function resizeSlots(slots: EdgeSlot[], footprint: Footprint): EdgeSlot[] {
  if (slots.length === footprint) return slots;
  if (slots.length > footprint) return slots.slice(0, footprint);
  return [...slots, ...Array.from({ length: footprint - slots.length }, () => edgeSlot())];
}

// ── Default tile library (specs/shmup-editor.todo.md follow-up — the
// built-in tile art in tileImages.ts previously had no matching TileDef
// instances at all, so the editor's tile picker started completely empty
// even though a full set of biome art shipped alongside it) ────────────

/** Every tile below is footprint 1 — the built-in art is a whole 1x1 square, not a wide multi-column piece. */
function plainTile(name: string, imageId: string, tag: EdgeTag): Omit<TileDef, "id" | "createdAt" | "modifiedAt"> {
  return {
    name,
    footprint: 1,
    north: [edgeSlot(tag)],
    south: [edgeSlot(tag)],
    east: edgeSlot(tag),
    west: edgeSlot(tag),
    isConnector: false,
    weight: 1,
    imageId,
    customImage: null,
    encounters: [],
  };
}

/**
 * A tile whose art splits the biome top (north) / bottom (south) across
 * the square — the natural or "wall"/gate-decorated variants alike. Either
 * way the east/west edges show both biomes at once (a gradient, or a
 * fence/gate straddling the seam), which no single tag can represent
 * correctly, so they're hardwalled per root CLAUDE.md's tile-tagging rule.
 */
function horizontalSplitTile(name: string, imageId: string, north: EdgeTag, south: EdgeTag): Omit<TileDef, "id" | "createdAt" | "modifiedAt"> {
  return {
    name,
    footprint: 1,
    north: [edgeSlot(north)],
    south: [edgeSlot(south)],
    east: edgeSlot("", true),
    west: edgeSlot("", true),
    isConnector: false,
    weight: 1,
    imageId,
    customImage: null,
    encounters: [],
  };
}

/** Mirror of horizontalSplitTile for art that splits the biome left (west) / right (east) instead — north/south hardwalled instead. */
function verticalSplitTile(name: string, imageId: string, west: EdgeTag, east: EdgeTag): Omit<TileDef, "id" | "createdAt" | "modifiedAt"> {
  return {
    name,
    footprint: 1,
    north: [edgeSlot("", true)],
    south: [edgeSlot("", true)],
    east: edgeSlot(east),
    west: edgeSlot(west),
    isConnector: false,
    weight: 1,
    imageId,
    customImage: null,
    encounters: [],
  };
}

function makeDefaultTile(spec: Omit<TileDef, "id" | "createdAt" | "modifiedAt">): TileDef {
  const now = Date.now();
  return { ...spec, id: makeTileId(), createdAt: now, modifiedAt: now };
}

// ── Default content: hand-authored starter Encounters for a handful of
// tiles (Noah: variety to show off the editor, and to make playtesting
// fun) — Grass and the road family for this pass; every other default
// tile stays `encounters: []`. All four are footprint 1 (see file header),
// so every position below is tile-local x:[0,720]/y:[0,720] against a
// single `TILE_UNIT` square. ──────────────────────────────────────────

function step(pos: Vec2, time: number, actionId: string | null): EncounterStep {
  return { id: makeStepId(), pos, time, actionId, handleIn: null, handleOut: null };
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * A step whose `time` is derived from straight-line distance at `speed` —
 * close enough for hand-authored default content, which doesn't need
 * `encounterTiming.ts`'s full arc-length/turning-aware derivation (that
 * only matters for the editor's own timeline UI; the runtime just
 * interpolates position against whatever `time` a step carries).
 */
function stepAfter(prev: EncounterStep, pos: Vec2, speed: number, actionId: string | null): EncounterStep {
  return step(pos, prev.time + dist(prev.pos, pos) / speed, actionId);
}

function placedUnit(unitDefId: string, steps: EncounterStep[], scalingPatch: Partial<UnitScaling> = {}, partActions: PartActionPlacement[] = []): EncounterUnit {
  return { ...createEncounterUnit(unitDefId), steps, partActions, scaling: { ...createDefaultScaling(), ...scalingPatch } };
}

/** A turreted enemy's Nth Turret Part opening fire at `time` — see `unitTypes.ts`'s `enemyTurretPartId`/`enemyTurretAttackActionId`. */
function turretFire(slug: string, index: number, time: number): PartActionPlacement {
  return { id: makePartActionPlacementId(), partId: enemyTurretPartId(slug, index), time, actionId: enemyTurretAttackActionId(slug, index) };
}

function encounter(name: string, units: EncounterUnit[]): EncounterDef {
  const now = Date.now();
  return { id: makeEncounterId(), name, weight: 1, units, createdAt: now, modifiedAt: now };
}

function grassEncounters(): EncounterDef[] {
  // Ground: a defensive line of Turrets across the tile.
  const turretLine = placedUnit(enemyUnitId("turret"), [step({ x: 360, y: 420 }, 0, enemyAttackActionId("turret"))], {
    maxCount: 5,
    shape: "grid",
    gridWidth: TILE_UNIT * 0.78,
    gridDepth: 0,
  });

  // Air: Attack Helicopters fly in and hold near the top of the screen,
  // firing continuously rather than flying through and off.
  const heliIn = step({ x: 360, y: 200 }, 2, enemyMoveActionId("heli"));
  const heliHold = stepAfter(heliIn, { x: 360, y: 500 }, 140, enemyAttackActionId("heli"));
  const heliDwell = step({ x: 360, y: 500 }, 9.5, enemyAttackActionId("heli"));
  const heliLoiter = placedUnit(enemyUnitId("heli"), [heliIn, heliHold, heliDwell], {
    maxCount: 4,
    shape: "grid",
    gridWidth: TILE_UNIT * 0.5,
    gridDepth: 0,
    spawnDelayMs: 300,
  });

  // Mixed: a lighter turret pair plus one loitering Transport Helicopter overhead.
  const overwatchTurrets = placedUnit(enemyUnitId("turret"), [step({ x: 260, y: 420 }, 0, enemyAttackActionId("turret"))], {
    maxCount: 2,
    shape: "grid",
    gridWidth: 260,
    gridDepth: 0,
  });
  const owHeliIn = step({ x: 540, y: 220 }, 2, enemyMoveActionId("heli-transport"));
  const owHeliHold = stepAfter(owHeliIn, { x: 540, y: 480 }, 100, enemyAttackActionId("heli-transport"));
  const owHeliDwell = step({ x: 540, y: 480 }, 9.5, enemyAttackActionId("heli-transport"));
  const overwatchHeli = placedUnit(enemyUnitId("heli-transport"), [owHeliIn, owHeliHold, owHeliDwell]);

  // Filler: a loose "V" formation of Transport Helicopters crossing left to
  // right — never fires (its Move Action is the only one ever referenced),
  // so it's pure bonus points, not a threat.
  const flyIn = step({ x: -80, y: 260 }, 1, enemyMoveActionId("heli-transport"));
  const flyOut = stepAfter(flyIn, { x: 800, y: 260 }, 100, enemyMoveActionId("heli-transport"));
  const flyby = placedUnit(enemyUnitId("heli-transport"), [flyIn, flyOut], {
    maxCount: 4,
    shape: "v",
    vTip: { x: -180, y: 0 },
    vWidth: 260,
    spawnDelayMs: 250,
  });

  return [
    encounter("Turret Line", [turretLine]),
    encounter("Helicopter Loiter", [heliLoiter]),
    encounter("Overwatch", [overwatchTurrets, overwatchHeli]),
    encounter("Heli Flyby", [flyby]),
  ];
}

function roadStraightEncounters(): EncounterDef[] {
  // Ground: a Battle Tank leads (its Turret Part fires independently while
  // it drives), Transport Trucks queue up behind it along the road.
  const tankIn = step({ x: 360, y: 60 }, 0, enemyMoveActionId("battle-tank"));
  const tankOut = stepAfter(tankIn, { x: 360, y: 680 }, 70, enemyMoveActionId("battle-tank"));
  const tank = placedUnit(enemyUnitId("battle-tank"), [tankIn, tankOut], {}, [turretFire("battle-tank", 0, 1.5)]);

  const truckIn = step({ x: 320, y: 0 }, 0, enemyMoveActionId("truck-transport"));
  const truckOut = stepAfter(truckIn, { x: 320, y: 700 }, 90, enemyMoveActionId("truck-transport"));
  const trucks = placedUnit(enemyUnitId("truck-transport"), [truckIn, truckOut], {
    maxCount: 3,
    shape: "curve",
    curveEnd: { x: 0, y: 220 },
    spawnDelayMs: 900,
  });

  // Air: a Jet Fighter (a wingman joins at higher Difficulty) enters fast,
  // loops around, then strafes low across the road before peeling off —
  // the speed-and-maneuverability showcase.
  const j0 = step({ x: 100, y: -260 }, 0, enemyMoveActionId("jet-fighter"));
  const j1 = stepAfter(j0, { x: 560, y: 120 }, 220, enemyMoveActionId("jet-fighter"));
  const j2 = stepAfter(j1, { x: 150, y: 340 }, 220, enemyStrafeActionId("jet-fighter"));
  const j3 = stepAfter(j2, { x: 650, y: 520 }, 220, enemyMoveActionId("jet-fighter"));
  const j4 = stepAfter(j3, { x: 800, y: 200 }, 220, enemyMoveActionId("jet-fighter"));
  const jet = placedUnit(enemyUnitId("jet-fighter"), [j0, j1, j2, j3, j4], {
    maxCount: 2,
    shape: "curve",
    curveEnd: { x: 80, y: 0 },
    spawnDelayMs: 600,
  });

  // Mixed: a shorter Convoy plus one Jet Fighter making a single strafing pass overhead.
  const escortTruckIn = step({ x: 320, y: 0 }, 0, enemyMoveActionId("truck-transport"));
  const escortTruckOut = stepAfter(escortTruckIn, { x: 320, y: 700 }, 90, enemyMoveActionId("truck-transport"));
  const escortTrucks = placedUnit(enemyUnitId("truck-transport"), [escortTruckIn, escortTruckOut], {
    maxCount: 2,
    shape: "curve",
    curveEnd: { x: 0, y: 220 },
    spawnDelayMs: 900,
  });
  const e0 = step({ x: 150, y: -200 }, 1, enemyMoveActionId("jet-fighter"));
  const e1 = stepAfter(e0, { x: 600, y: 350 }, 220, enemyStrafeActionId("jet-fighter"));
  const e2 = stepAfter(e1, { x: 750, y: 550 }, 220, enemyMoveActionId("jet-fighter"));
  const escortJet = placedUnit(enemyUnitId("jet-fighter"), [e0, e1, e2]);

  return [
    encounter("Convoy", [tank, trucks]),
    encounter("Strafing Run", [jet]),
    encounter("Escort", [escortTrucks, escortJet]),
  ];
}

function roadCurveEncounters(): EncounterDef[] {
  // Ground: an Armored Truck follows the road's bend (its Turret fires
  // independently once it's rounded the first curve), a Turret (Quad)
  // guards the inside of the bend.
  const bendIn = step({ x: 400, y: 40 }, 0, enemyMoveActionId("armored-truck"));
  const bendMid = stepAfter(bendIn, { x: 180, y: 340 }, 90, enemyMoveActionId("armored-truck"));
  const bendOut = stepAfter(bendMid, { x: 520, y: 660 }, 90, enemyMoveActionId("armored-truck"));
  const truck = placedUnit(enemyUnitId("armored-truck"), [bendIn, bendMid, bendOut], {}, [turretFire("armored-truck", 0, 2)]);

  const guardTurret = placedUnit(enemyUnitId("turret-4x"), [step({ x: 250, y: 400 }, 0, enemyAttackActionId("turret-4x"))]);

  // Filler folded in rather than a separate encounter — a pair of harmless Transport Helicopters crossing high overhead.
  const flyIn = step({ x: -80, y: 180 }, 1, enemyMoveActionId("heli-transport"));
  const flyOut = stepAfter(flyIn, { x: 800, y: 180 }, 100, enemyMoveActionId("heli-transport"));
  const flyby = placedUnit(enemyUnitId("heli-transport"), [flyIn, flyOut], { maxCount: 2, shape: "grid", gridWidth: 150, gridDepth: 100 });

  // Air: the same Strafing Run showcase as Road (Straight), flown along the curve's diagonal instead.
  const s0 = step({ x: 600, y: -260 }, 0, enemyMoveActionId("jet-fighter"));
  const s1 = stepAfter(s0, { x: 150, y: 150 }, 220, enemyMoveActionId("jet-fighter"));
  const s2 = stepAfter(s1, { x: 550, y: 380 }, 220, enemyStrafeActionId("jet-fighter"));
  const s3 = stepAfter(s2, { x: 120, y: 560 }, 220, enemyMoveActionId("jet-fighter"));
  const s4 = stepAfter(s3, { x: -100, y: 250 }, 220, enemyMoveActionId("jet-fighter"));
  const jet = placedUnit(enemyUnitId("jet-fighter"), [s0, s1, s2, s3, s4], {
    maxCount: 2,
    shape: "curve",
    curveEnd: { x: -80, y: 0 },
    spawnDelayMs: 600,
  });

  return [encounter("Bend Ambush", [truck, guardTurret, flyby]), encounter("Strafing Run", [jet])];
}

function roadTrailheadEncounters(): EncounterDef[] {
  // Ground: a light Turret checkpoint guarding the road's entrance. Kept
  // lean — this tile is a level opener/closer, not a set-piece.
  const checkpoint = placedUnit(enemyUnitId("turret"), [step({ x: 360, y: 180 }, 0, enemyAttackActionId("turret"))], {
    maxCount: 2,
    shape: "grid",
    gridWidth: 220,
    gridDepth: 0,
  });

  // Air: a single Prop Plane pass-through — a taste, not the full loop-and-strafe.
  const p0 = step({ x: 100, y: -200 }, 0, enemyMoveActionId("plane-prop"));
  const p1 = stepAfter(p0, { x: 650, y: 650 }, 120, enemyMoveActionId("plane-prop"));
  const reconPass = placedUnit(enemyUnitId("plane-prop"), [p0, p1]);

  return [encounter("Checkpoint", [checkpoint]), encounter("Recon Pass", [reconPass])];
}

/**
 * The full default tile library a brand-new/reset session starts with —
 * one TileDef per image in tileImages.ts, tagged per root CLAUDE.md's
 * shmup-editor rule: biome-named tiles get edges tagged for what's
 * visually there, and any edge with an obvious wall/seam (a fence, gate,
 * or an edge that mixes two biomes with no single tag to describe it)
 * gets hardwalled instead. Mirrors unitTypes.ts's createDefaultUnitLibrary.
 */
export function createDefaultTileLibrary(): TileDef[] {
  return [
    // Plain biomes — every edge open to more of the same.
    makeDefaultTile(plainTile("Water", "water", "water")),
    { ...makeDefaultTile(plainTile("Grass", "grass", "grass")), encounters: grassEncounters() },
    makeDefaultTile(plainTile("Sand", "sand", "sand")),
    makeDefaultTile(plainTile("Swamp", "swamp", "swamp")),
    makeDefaultTile(plainTile("Lava", "lava", "lava")),
    makeDefaultTile(plainTile("Rocky", "rocky", "rocky")),
    makeDefaultTile(plainTile("Concrete", "concrete", "concrete")),
    makeDefaultTile(plainTile("Forest", "forest", "forest")),

    // Horizontal (north/south) biome transitions — east/west hardwalled.
    makeDefaultTile(horizontalSplitTile("Grass / Water Shore", "grass-water", "water", "grass")),
    makeDefaultTile(horizontalSplitTile("Grass / Sand", "grass-sand", "sand", "grass")),
    makeDefaultTile(horizontalSplitTile("Grass / Sand (Natural)", "grass-sand-natural", "sand", "grass")),
    makeDefaultTile(horizontalSplitTile("Grass / Swamp", "grass-swamp", "swamp", "grass")),
    makeDefaultTile(horizontalSplitTile("Sand / Rocky", "sand-rocky", "rocky", "sand")),
    makeDefaultTile(horizontalSplitTile("Sand / Water", "sand-water-natural", "sand", "water")),
    makeDefaultTile(horizontalSplitTile("Sand / Concrete", "sand-concrete", "concrete", "sand")),
    makeDefaultTile(horizontalSplitTile("Sand / Concrete Gate", "sand-concrete-wall", "concrete", "sand")),
    makeDefaultTile(horizontalSplitTile("Concrete / Water", "concrete-water", "water", "concrete")),
    makeDefaultTile(horizontalSplitTile("Concrete / Water Pier", "concrete-water-wall", "water", "concrete")),
    makeDefaultTile(horizontalSplitTile("Concrete / Lava", "concrete-lava", "concrete", "lava")),
    makeDefaultTile(horizontalSplitTile("Concrete / Lava Barrier", "concrete-lava-wall", "concrete", "lava")),
    makeDefaultTile(horizontalSplitTile("Forest / Water", "forest-water", "forest", "water")),

    // Vertical (east/west) biome transition — north/south hardwalled.
    makeDefaultTile(verticalSplitTile("Forest / Grass", "grass-forest", "forest", "grass")),

    // Diagonal corner — water fills the NW half (touching north+west), grass fills the SE half (touching south+east); every edge gets a real tag, nothing hardwalled.
    makeDefaultTile({
      name: "Water / Grass Corner",
      footprint: 1,
      north: [edgeSlot("water")],
      south: [edgeSlot("grass")],
      east: edgeSlot("grass"),
      west: edgeSlot("water"),
      isConnector: false,
      weight: 1,
      imageId: "grass-water-diag",
      customImage: null,
      encounters: [],
    }),

    // Roads — grass on both sides, "grass-road" tag continues the path north/south. Tagged by biome (not just "road") since desert/concrete roads etc. are a different, non-matching tag.
    {
      ...makeDefaultTile({
        name: "Road (Straight)",
        footprint: 1,
        north: [edgeSlot("grass-road")],
        south: [edgeSlot("grass-road")],
        east: edgeSlot("grass"),
        west: edgeSlot("grass"),
        isConnector: false,
        weight: 1,
        imageId: "grass-road-straight",
        customImage: null,
        encounters: [],
      }),
      encounters: roadStraightEncounters(),
    },
    {
      ...makeDefaultTile({
        name: "Road (Curve)",
        footprint: 1,
        north: [edgeSlot("grass-road")],
        south: [edgeSlot("grass-road")],
        east: edgeSlot("grass"),
        west: edgeSlot("grass"),
        isConnector: false,
        weight: 1,
        imageId: "grass-road-curve",
        customImage: null,
        encounters: [],
      }),
      encounters: roadCurveEncounters(),
    },
    {
      ...makeDefaultTile({
        name: "Road (Trailhead)",
        footprint: 1,
        north: [edgeSlot("grass-road")],
        south: [edgeSlot("grass")],
        east: edgeSlot("grass"),
        west: edgeSlot("grass"),
        isConnector: false,
        weight: 1,
        imageId: "grass-road-start",
        customImage: null,
        encounters: [],
      }),
      encounters: roadTrailheadEncounters(),
    },
    makeDefaultTile(horizontalSplitTile("Road / Concrete Gate", "grass-road-concrete", "concrete", "grass-road")),
  ];
}
