/**
 * Tile data model for the Shmup Editor (specs/shmup-editor.todo.md, E1 #191).
 * Deliberately self-contained — not imported from games/shmup/src/systems/levels/.
 * The editor's "tile" is a full-screen authoring unit; the game engine's
 * internal tile rendering is a different, smaller-grained concept. Only the
 * exported JSON *shape* is kept compatible with the game's L1 data model
 * (specs/games/shmup/levels-and-tiles.spec.todo.md), not the code.
 */

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
  /** Editor-only flavor for telling tiles apart at a glance in lists/previews — not part of the exported gameplay shape. */
  color: string;
  createdAt: number;
  modifiedAt: number;
}

export function makeTileId(): string {
  return `tile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_COLORS = ["#7b3dbe", "#cc4400", "#228833", "#0077aa", "#aa5500", "#884499"];

export function pickDefaultColor(existingCount: number): string {
  return DEFAULT_COLORS[existingCount % DEFAULT_COLORS.length];
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
    color: pickDefaultColor(existingCount),
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
