/**
 * Tile data model for the Shmup Editor (specs/shmup-editor.todo.md, E1 #191).
 * Deliberately self-contained — not imported from games/shmup/src/systems/levels/.
 * The editor's "tile" is a full-screen authoring unit; the game engine's
 * internal tile rendering is a different, smaller-grained concept. Only the
 * exported JSON *shape* is kept compatible with the game's L1 data model
 * (specs/games/shmup/levels-and-tiles.spec.todo.md), not the code.
 */
import { CUSTOM_IMAGE_ID, NONE_IMAGE_ID, tileImageById } from "./tileImages";
import type { EncounterDef } from "./encounterTypes";

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
    makeDefaultTile(plainTile("Grass", "grass", "grass")),
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
    makeDefaultTile({
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
    makeDefaultTile({
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
    makeDefaultTile({
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
    makeDefaultTile(horizontalSplitTile("Road / Concrete Gate", "grass-road-concrete", "concrete", "grass-road")),
  ];
}
