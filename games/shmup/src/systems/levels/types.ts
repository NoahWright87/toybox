/**
 * Data shapes for the tile grid-fill generator (levels-and-tiles.spec.todo.md,
 * L1 #183). Pure types only; behavior lives in the sibling modules.
 */

export type EdgeTag = string;

/** Reserved edge tag: nothing may connect here — the boundary mechanism that keeps generation from growing unbounded width. */
export const HARDWALL: EdgeTag = "hardwall";

/** Reserved edge tag for a tile's `south`/`north` slots: matches any frontier tag — what makes start/end connector tiles "trivially match any edge" (spec §1). */
export const WILDCARD: EdgeTag = "*";

/** Width in columns; height is always exactly 1 row (one "screen" unit) per the design doc. */
export type Footprint = 1 | 2 | 3;

/**
 * A tile as authored (before rotation/flip). `north`/`south` are one tag per
 * column of the footprint (so a multi-column edge can mix hardwall and open
 * slots — this is what makes splits/merges/diagonal-drift possible without
 * any special-cased logic, see `generateLevel.ts`). `east`/`west` are single
 * tags since footprint height is fixed at 1.
 */
export interface TileDef {
  id: string;
  footprint: Footprint;
  north: EdgeTag[];
  south: EdgeTag[];
  east: EdgeTag;
  west: EdgeTag;
  /** Relative weight when multiple tiles/orientations match the same frontier (default 1) — spec §1's "variants... optionally weighted". */
  weight?: number;
}

export interface Orientation {
  rotation: 0 | 90 | 180 | 270;
  flip: boolean;
}

/** A `TileDef`'s edges after `applyOrientation` — footprint is carried through unchanged (rotation never changes which axis is "width" here, see `orientation.ts`). */
export interface OrientedTile {
  footprint: Footprint;
  north: EdgeTag[];
  south: EdgeTag[];
  east: EdgeTag;
  west: EdgeTag;
}

export interface LevelGenOptions {
  seed: number;
  /** The tag the very first placed tile's `south` must match (typically a connector tile's biome-flavored north tag, see L7 #189). */
  startTag: EdgeTag;
  startColumn?: number;
  startBudget?: number;
  /** Difficulty budget added per row a frontier survives — the concrete curve/allocation math is L5 #187's job; this is just the scaffold. */
  budgetGrowthPerRow?: number;
  /** Row/length threshold: generation for a frontier stops here even if it hasn't hit a dead-end tile (spec §2's "level-length/budget threshold"). */
  maxRows: number;
  /** Playfield width in columns — a candidate placement is rejected if any part of its footprint would fall outside [0, maxWidth). */
  maxWidth: number;
}

export interface PlacedTile {
  tileId: string;
  orientation: Orientation;
  xStart: number;
  xEnd: number;
  row: number;
  /** True when every oriented `north` slot is `HARDWALL` — a dead end by construction (design doc's definition of a boss tile, L8 #190). */
  isDeadEnd: boolean;
}

/** A single open connector: one column, one row, one tag, carrying its own difficulty budget (spec §2's per-frontier budget on split). */
export interface OpenFrontier {
  column: number;
  row: number;
  tag: EdgeTag;
  budget: number;
}

export interface LevelGenResult {
  placedTiles: PlacedTile[];
  /** Frontiers left unresolved: either the generation horizon (`maxRows`) was reached, or no authored tile matched (a content gap, not expected once tile sets are curated). */
  openFrontiers: OpenFrontier[];
}
