/**
 * A level as the game plays it: an ordered set of tile placements, plus the
 * geometry for orienting authored content inside a rotated or flipped tile.
 *
 * The Connection Viewer builds its grid in (row, col) where **row grows
 * south**. The game thinks in **depth** instead — depth 0 is the tile you
 * meet first, depth 1 is behind it. Since the player advances north,
 * `depth = maxRow - row`: the southernmost placed tile is where you fly in.
 * `layoutFromGrid` is the only place that conversion happens.
 *
 * ## Orientation
 *
 * A tile may be rotated and/or flipped in the layout, and its authored
 * encounter has to come with it — a turret placed on the left of a tile
 * belongs on the right once that tile is mirrored. The transform is exact
 * rather than approximate because 90°/270° are only ever offered to
 * footprint-1 (square) tiles; a 2- or 3-wide tile only gets 0°/180° and a
 * flip, all of which map its rectangle onto itself. That's the same rule
 * `systems/levels/orientation.ts` applies to edge tags, for the same reason.
 *
 * Points, angles and arcs each need their own version of that transform:
 * rotation adds to an angle, a flip mirrors it, and a flip additionally
 * reverses the handedness of a fan or sweep — otherwise a mirrored tile's
 * spread shots would come out on the wrong side.
 */
import { TILE_UNIT } from "./scrollModel";
import type { AuthoredFootprint, Vec2 } from "./authoredTypes";

export interface TileOrientation {
  rotation: 0 | 90 | 180 | 270;
  flip: boolean;
}

export const IDENTITY_ORIENTATION: TileOrientation = { rotation: 0, flip: false };

/** One tile in a level, already converted out of the editor's grid coordinates. */
export interface TilePlacement {
  tileId: string;
  /** 0 = the tile the player meets first. */
  depth: number;
  /** Leftmost occupied column, normalised so the level's westmost column is 0. */
  column: number;
  orientation: TileOrientation;
}

export interface LevelLayout {
  placements: TilePlacement[];
  /** How many columns the level spans — what the camera centres on. */
  columns: number;
}

/** The editor-side grid shape (`connectionGrid.ts`'s `GridEntry`, minus the parts the game doesn't need). */
export interface GridPlacement {
  tileId: string;
  row: number;
  col: number;
  footprint: AuthoredFootprint;
  orientation: TileOrientation;
}

/**
 * Converts a Connection Viewer grid into play order. Rows are flipped into
 * depth (south is where you start), and columns are normalised so the
 * westmost placed column is 0.
 */
export function layoutFromGrid(entries: readonly GridPlacement[]): LevelLayout {
  if (entries.length === 0) return { placements: [], columns: 0 };
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxColEnd = -Infinity;
  for (const e of entries) {
    maxRow = Math.max(maxRow, e.row);
    minCol = Math.min(minCol, e.col);
    maxColEnd = Math.max(maxColEnd, e.col + e.footprint);
  }
  return {
    placements: entries.map((e) => ({
      tileId: e.tileId,
      depth: maxRow - e.row,
      column: e.col - minCol,
      orientation: e.orientation,
    })),
    columns: maxColEnd - minCol,
  };
}

/** A level of exactly one tile — what an encounter playtest runs. */
export function singleTileLayout(tileId: string): LevelLayout {
  return { placements: [{ tileId, depth: 0, column: 0, orientation: IDENTITY_ORIENTATION }], columns: 1 };
}

// ── Orienting authored content ─────────────────────────────────────────────

/** Oriented width of a tile in authored units. Rotation never changes it, since 90°/270° are square-only. */
export function orientedWidth(footprint: AuthoredFootprint): number {
  return footprint * TILE_UNIT;
}

/**
 * A tile-local point as it lands after the tile is rotated and flipped.
 * Rotation first, then the flip — matching the order
 * `orientation.ts`'s edge transform applies, so a point and its edge stay
 * on the same side of the tile.
 */
export function orientPoint(pos: Vec2, footprint: AuthoredFootprint, orientation: TileOrientation): Vec2 {
  const width = orientedWidth(footprint);
  let { x, y } = pos;
  if (orientation.rotation === 180) {
    x = width - x;
    y = TILE_UNIT - y;
  } else if (orientation.rotation === 90) {
    // Square-only: the west edge becomes the north edge.
    const rx = TILE_UNIT - y;
    y = x;
    x = rx;
  } else if (orientation.rotation === 270) {
    const rx = y;
    y = TILE_UNIT - x;
    x = rx;
  }
  if (orientation.flip) x = width - x;
  return { x, y };
}

/** A heading (degrees, 0 = +x/east, 90 = +y/south) under the same transform. */
export function orientAngleDeg(deg: number, orientation: TileOrientation): number {
  const rotated = deg + orientation.rotation;
  return orientation.flip ? 180 - rotated : rotated;
}

/**
 * Whether an arc/sweep offset has to reverse. A mirrored tile mirrors the
 * *shape* of a fan too, not just where it points — without this, a spread
 * authored to sweep left would sweep right on the flipped copy while its
 * base direction was correctly mirrored.
 */
export function orientMirrorsArc(orientation: TileOrientation): boolean {
  return orientation.flip;
}
