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
    makeDefaultTile(plainTile("Grass", "grass", "grass")),
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
    // The curve's art enters from the **south** and exits **east** — north and
    // west are plain grass. It was seeded as a copy of Road (Straight)'s
    // north/south edges, which claimed a road continued off the top of a tile
    // where the art plainly shows grass.
    makeDefaultTile({
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
