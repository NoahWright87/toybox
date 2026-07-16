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
