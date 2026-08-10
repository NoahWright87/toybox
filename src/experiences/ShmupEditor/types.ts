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

/**
 * A single inert doodad prop at a fixed spot — `slug` is `DOODAD_SPECS`'
 * (`unitTypes.ts`) slug, resolved through the same `enemyUnitId` every
 * other seeded Unit uses (doodads get the same deterministic id scheme, see
 * that file). `actionId: null` is the only legal value here: a doodad has
 * `actions: []`, nothing to reference — it's scenery, not a combatant.
 * `scalingPatch` is for a clump of the same prop (a stand of trees, a
 * scatter of rubble), same mechanism as an enemy's — cost is 1 for every
 * doodad, so a clump's full `maxCount` always renders at any real Difficulty.
 */
function doodad(slug: string, pos: Vec2, scalingPatch: Partial<UnitScaling> = {}): EncounterUnit {
  return placedUnit(enemyUnitId(slug), [step(pos, 0, null)], scalingPatch);
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
  // Ground: a defensive line of Turrets across the tile. "grid" with
  // gridDepth: 0 looks like it should collapse to a single row, but its
  // cols/rows split (ceil(sqrt(count))) only actually gives one row when
  // count <= 2 — at 5 it's a 3x2 grid squashed flat, so two pairs of slots
  // land on the exact same x and overlap. "curve" with no curvePoints (a
  // straight line) evenly spaces any count with no such collapsing, so the
  // placed instance's own position is the line's *left* end here rather
  // than centered, with curveEnd reaching the right end.
  const turretLine = placedUnit(enemyUnitId("turret"), [step({ x: 80, y: 420 }, 0, enemyAttackActionId("turret"))], {
    maxCount: 5,
    shape: "curve",
    curveEnd: { x: TILE_UNIT * 0.78, y: 0 },
  });

  // Air: Attack Helicopters fly in and hold near the top of the screen,
  // firing continuously rather than flying through and off. Same
  // left-end/curveEnd line arrangement as the Turret Line above, translated
  // rigidly across every step of the hold path (scaling offsets the whole
  // authored sequence by a fixed dx, not just the first step).
  const heliIn = step({ x: 180, y: 200 }, 2, enemyMoveActionId("heli"));
  const heliHold = stepAfter(heliIn, { x: 180, y: 500 }, 140, enemyAttackActionId("heli"));
  const heliDwell = step({ x: 180, y: 500 }, 9.5, enemyAttackActionId("heli"));
  const heliLoiter = placedUnit(enemyUnitId("heli"), [heliIn, heliHold, heliDwell], {
    maxCount: 4,
    shape: "curve",
    curveEnd: { x: TILE_UNIT * 0.5, y: 0 },
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

  // Scenery: the art (grass.png) is a uniform open meadow with nothing in
  // it, so there's no single feature to build around — just a natural
  // scatter across the field: a small grove in one corner, a lone tree
  // opposite it, a bush and a rock outcrop, a handful of loose pebbles.
  const grove = doodad("tree-broadleaf", { x: 110, y: 140 }, { maxCount: 3, shape: "curve", curveEnd: { x: 140, y: 80 } });
  const loneTree = doodad("tree-round", { x: 620, y: 130 });
  const bush = doodad("tree-bush-round", { x: 260, y: 560 });
  const rocks = doodad("rock-cluster", { x: 520, y: 480 });
  const pebbles = doodad("rock-pebbles", { x: 580, y: 610 }, { maxCount: 3, shape: "curve", curveEnd: { x: -100, y: -60 } });

  return [
    encounter("Turret Line", [turretLine]),
    encounter("Helicopter Loiter", [heliLoiter]),
    encounter("Overwatch", [overwatchTurrets, overwatchHeli]),
    encounter("Heli Flyby", [flyby]),
    encounter("Meadow Scenery", [grove, loneTree, bush, rocks, pebbles]),
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

  // Scenery: the art (grass-road-straight.png) is a paved lane roughly
  // x∈[247,459] flanked by open grass verges on both sides — trees and
  // rocks sit off the road itself, not on the asphalt.
  const westTrees = doodad("tree-broadleaf", { x: 130, y: 80 }, { maxCount: 3, shape: "curve", curveEnd: { x: 0, y: 560 } });
  const eastTree = doodad("tree-round", { x: 580, y: 260 });
  const eastRocks = doodad("rock-boulders", { x: 600, y: 520 });
  const westBush = doodad("tree-bush-large", { x: 150, y: 640 });

  return [
    encounter("Convoy", [tank, trucks]),
    encounter("Strafing Run", [jet]),
    encounter("Escort", [escortTrucks, escortJet]),
    encounter("Roadside Scenery", [westTrees, eastTree, eastRocks, westBush]),
  ];
}

function roadCurveEncounters(): EncounterDef[] {
  // Ground: an Armored Truck follows the road's actual bend — the art
  // (see repairSeededTags above) enters from the **south** and exits
  // **east**, not north-to-south — bending through the middle of the tile
  // (its Turret fires independently once it's rounded the bend). A Turret
  // (Quad) guards the inside of the elbow, the grass wedge tucked between
  // the curve and the tile's south-east corner.
  const bendIn = step({ x: 350, y: 690 }, 0, enemyMoveActionId("armored-truck"));
  const bendMid = stepAfter(bendIn, { x: 480, y: 420 }, 90, enemyMoveActionId("armored-truck"));
  const bendOut = stepAfter(bendMid, { x: 700, y: 260 }, 90, enemyMoveActionId("armored-truck"));
  const truck = placedUnit(enemyUnitId("armored-truck"), [bendIn, bendMid, bendOut], {}, [turretFire("armored-truck", 0, 2)]);

  const guardTurret = placedUnit(enemyUnitId("turret-4x"), [step({ x: 560, y: 560 }, 0, enemyAttackActionId("turret-4x"))]);

  // Filler folded in rather than a separate encounter — a pair of harmless Transport Helicopters crossing high overhead.
  const flyIn = step({ x: -80, y: 180 }, 1, enemyMoveActionId("heli-transport"));
  const flyOut = stepAfter(flyIn, { x: 800, y: 180 }, 100, enemyMoveActionId("heli-transport"));
  const flyby = placedUnit(enemyUnitId("heli-transport"), [flyIn, flyOut], { maxCount: 2, shape: "grid", gridWidth: 150, gridDepth: 100 });

  // Air: the same Strafing Run showcase as Road (Straight), flown along a
  // south-west to north-east diagonal to echo the bend's own sweep.
  const s0 = step({ x: 650, y: -260 }, 0, enemyMoveActionId("jet-fighter"));
  const s1 = stepAfter(s0, { x: 120, y: 200 }, 220, enemyMoveActionId("jet-fighter"));
  const s2 = stepAfter(s1, { x: 560, y: 420 }, 220, enemyStrafeActionId("jet-fighter"));
  const s3 = stepAfter(s2, { x: 100, y: 620 }, 220, enemyMoveActionId("jet-fighter"));
  const s4 = stepAfter(s3, { x: -100, y: 350 }, 220, enemyMoveActionId("jet-fighter"));
  const jet = placedUnit(enemyUnitId("jet-fighter"), [s0, s1, s2, s3, s4], {
    maxCount: 2,
    shape: "curve",
    curveEnd: { x: -80, y: 0 },
    spawnDelayMs: 600,
  });

  // Scenery: trees along the curve's outside (the big grass field to the
  // north-west of the bend), a rock formation tucked in the inside elbow
  // (the same south-east wedge Bend Ambush's guard Turret occupies — a
  // different Encounter, never placed alongside it, so the reuse is just
  // "this spot reads as the inside of the curve" twice, not a collision).
  const nwGrove = doodad("tree-lobed", { x: 120, y: 100 }, { maxCount: 3, shape: "curve", curveEnd: { x: 60, y: 340 } });
  const insideRocks = doodad("rock-boulder-pile", { x: 620, y: 630 });
  const outerTree = doodad("tree-round", { x: 280, y: 560 });

  return [
    encounter("Bend Ambush", [truck, guardTurret, flyby]),
    encounter("Strafing Run", [jet]),
    encounter("Curve Scenery", [nwGrove, insideRocks, outerTree]),
  ];
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

  // Scenery: the art (grass-road-start.png) is a paved road at the north
  // edge that visibly cracks and craters as it runs south, littered with
  // rubble, fading out into open grass — a camp guarding the paved
  // entrance, then wreckage tracing the broken pavement, then a couple of
  // trees once the road gives way to grass.
  const campSandbags = doodad("camp-sandbag-wall", { x: 200, y: 110 });
  const campCrates = doodad("camp-crates", { x: 540, y: 130 });
  const craters = doodad("urban-crater", { x: 320, y: 300 }, { maxCount: 3, shape: "curve", curveEnd: { x: 60, y: 280 } });
  const rubble = doodad("rock-pebbles", { x: 420, y: 500 });
  const grassTreeWest = doodad("tree-round", { x: 150, y: 650 });
  const grassTreeEast = doodad("tree-lobed", { x: 580, y: 680 });

  return [
    encounter("Checkpoint", [checkpoint]),
    encounter("Recon Pass", [reconPass]),
    encounter("Roadside Wreckage", [campSandbags, campCrates, craters, rubble, grassTreeWest, grassTreeEast]),
  ];
}

/**
 * Built-in image ids that have been renamed, old -> new.
 *
 * Unlike the tag/name repair below, this is applied to **every** tile,
 * user-authored ones included, and is not gated on matching a seeded
 * signature. Repointing a moved reference is not overwriting someone's
 * authoring — the art file itself moved, so a tile still holding the old id
 * would resolve to nothing and render blank. Leaving a user's tile "alone"
 * here would break it, which is the opposite of the restraint the signature
 * matching exists to provide.
 */
const RENAMED_IMAGE_IDS: Record<string, string> = {
  // The art is rocky scrubland over grass, not sand over grass — see the
  // "Grass / Rocky" seed entry below.
  "grass-sand": "grass-rocky",
};

/**
 * Corrects two seeded tiles whose edge tags contradicted their own art, in
 * place, for libraries saved before the fix:
 *
 *  1. **Road (Curve)** was seeded with Road (Straight)'s edges — `grass-road`
 *     north *and* south — but the art enters from the south and exits east.
 *     A road claimed to continue off the top of a tile that plainly shows
 *     grass there, so the matcher would happily butt it against another road
 *     tile to the north and draw a road that stops dead at the seam.
 *  2. **"Grass / Sand"** is rocky scrubland over grass — its top half is
 *     `rocky.png`'s own texture, boulders and all — but was named and tagged
 *     `sand`, so it sat flush against real sand tiles where the seam is
 *     glaring. Renamed to "Grass / Rocky" and retagged `rocky`.
 *
 * Done as a targeted content repair rather than a `SAVE_VERSION` bump for the
 * same reason as `repairSeededSimpleEnemies`: a bump resets the library and
 * discards every tile the user authored themselves, and the stored *shape*
 * never changed here — only two tags and a name that were wrong.
 *
 * Seeded tiles get random ids (`makeTileId`), so unlike the Unit repair there
 * is no stable id to match on. Each tag fix therefore matches the **entire
 * stale signature** — image id, name, and every edge — and rewrites only on an
 * exact hit. A tile the user has already renamed, retagged, or rebuilt on the
 * same art fails the match and is left completely alone, which is the behavior
 * to want when the alternative is silently overwriting their authoring.
 *
 * The image-id rename (`RENAMED_IMAGE_IDS`) is deliberately *not* gated that
 * way — see its own note. It runs after the tag fixes, which still match on
 * the pre-rename id, so a library can be mid-migration in either direction and
 * still land correctly: fully stale, or already tag-repaired by an earlier
 * build but still holding the old image id.
 */
export function repairSeededTiles(tiles: TileDef[]): TileDef[] {
  return tiles.map((tile) => repointRenamedImage(repairSeededTags(tile)));
}

function repairSeededTags(tile: TileDef): TileDef {
  if (tile.imageId === "grass-road-curve" && tile.name === "Road (Curve)" && matchesEdges(tile, "grass-road", "grass-road", "grass", "grass")) {
    return { ...tile, north: [edgeSlot("grass")], south: [edgeSlot("grass-road")], east: edgeSlot("grass-road"), west: edgeSlot("grass") };
  }
  if (tile.imageId === "grass-sand" && tile.name === "Grass / Sand" && matchesEdges(tile, "sand", "grass", null, null)) {
    return { ...tile, name: "Grass / Rocky", north: [edgeSlot("rocky")] };
  }
  return tile;
}

/** Returns the tile unchanged (by identity) unless its image id was renamed, so callers can cheaply detect whether a repair actually happened. */
function repointRenamedImage(tile: TileDef): TileDef {
  const renamed = RENAMED_IMAGE_IDS[tile.imageId];
  return renamed ? { ...tile, imageId: renamed } : tile;
}

/** Exact edge-signature check for `repairSeededTiles`. A `null` expectation means "hardwalled", which is what the split-tile helpers put on the axis they don't span. */
function matchesEdges(tile: TileDef, north: string, south: string, east: string | null, west: string | null): boolean {
  const one = (slots: EdgeSlot[], expected: string | null): boolean => slots.length === 1 && single(slots[0], expected);
  const single = (slot: EdgeSlot, expected: string | null): boolean => (expected === null ? slot.hardwall : !slot.hardwall && slot.tag === expected);
  return one(tile.north, north) && one(tile.south, south) && single(tile.east, east) && single(tile.west, west);
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
    // This art is rocky scrubland over grass, not sand over grass — its top
    // half is `rocky.png`'s own texture, boulders and all. It was named and
    // tagged `sand`, which let it sit flush against a real sand tile where the
    // seam is glaring. Image id renamed `grass-sand` -> `grass-rocky` to match
    // (see RENAMED_IMAGE_IDS).
    makeDefaultTile(horizontalSplitTile("Grass / Rocky", "grass-rocky", "rocky", "grass")),
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
    // The curve's art enters from the **south** and exits **east** — north and
    // west are plain grass. It was seeded as a copy of Road (Straight)'s
    // north/south edges, which claimed a road continued off the top of a tile
    // where the art plainly shows grass.
    {
      ...makeDefaultTile({
        name: "Road (Curve)",
        footprint: 1,
        north: [edgeSlot("grass")],
        south: [edgeSlot("grass-road")],
        east: edgeSlot("grass-road"),
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
