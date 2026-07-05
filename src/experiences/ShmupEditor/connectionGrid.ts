/**
 * 2D placement model for the Connection Viewer (specs/shmup-editor.todo.md).
 * Tiles occupy a real (row, col) grid — row grows downward/south, col grows
 * rightward/east, footprint spans columns at a fixed row (tile height is
 * always exactly 1 row, per the data model). Growth can happen off any
 * non-hardwall, unoccupied edge of any placed tile, not just the very top
 * or bottom of a single vertical line.
 */
import { HARDWALL, applyOrientation, edgeTagsMatch, findAlignments, validOrientations, type Orientation, type OrientedTile } from "./orientation";
import { slotTag, type TileDef } from "./types";

export interface GridEntry extends OrientedTile {
  key: string;
  row: number;
  col: number; // leftmost occupied column
}

export type Side = "north" | "south" | "east" | "west";

/** One open (non-hardwall, unoccupied) place to grow from — a contiguous run on north/south (which can have multiple per side on a wide tile with a hardwall gap), or the single cell on east/west (always one column, since footprint is width-only). */
export interface AddPoint {
  key: string;
  entryKey: string;
  side: Side;
  colStart: number;
  colEnd: number;
  row: number; // the row a new tile placed here would occupy
}

export interface PlacedCandidate extends OrientedTile {
  row: number;
  col: number;
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function buildOccupancy(entries: GridEntry[]): Map<string, GridEntry> {
  const map = new Map<string, GridEntry>();
  for (const e of entries) {
    for (let c = 0; c < e.tile.footprint; c++) map.set(cellKey(e.row, e.col + c), e);
  }
  return map;
}

function findOpenRuns(length: number, isOpen: (i: number) => boolean): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start: number | null = null;
  for (let i = 0; i < length; i++) {
    if (isOpen(i)) {
      if (start === null) start = i;
    } else if (start !== null) {
      runs.push([start, i - 1]);
      start = null;
    }
  }
  if (start !== null) runs.push([start, length - 1]);
  return runs;
}

/** Every open add point around every placed entry. One per contiguous open run on north/south (a hardwall gap or an already-occupied cell splits a side into separate runs); at most one each for east/west. */
export function computeAddPoints(entries: GridEntry[]): AddPoint[] {
  const occupancy = buildOccupancy(entries);
  const points: AddPoint[] = [];

  for (const entry of entries) {
    const oriented = applyOrientation(entry.tile, entry.orientation);
    const footprint = entry.tile.footprint;

    const northRuns = findOpenRuns(
      footprint,
      (i) => slotTag(oriented.north[i]) !== HARDWALL && !occupancy.has(cellKey(entry.row - 1, entry.col + i))
    );
    for (const [s, e] of northRuns) {
      points.push({ key: `${entry.key}-north-${s}`, entryKey: entry.key, side: "north", colStart: entry.col + s, colEnd: entry.col + e, row: entry.row - 1 });
    }

    const southRuns = findOpenRuns(
      footprint,
      (i) => slotTag(oriented.south[i]) !== HARDWALL && !occupancy.has(cellKey(entry.row + 1, entry.col + i))
    );
    for (const [s, e] of southRuns) {
      points.push({ key: `${entry.key}-south-${s}`, entryKey: entry.key, side: "south", colStart: entry.col + s, colEnd: entry.col + e, row: entry.row + 1 });
    }

    if (slotTag(oriented.east) !== HARDWALL && !occupancy.has(cellKey(entry.row, entry.col + footprint))) {
      points.push({ key: `${entry.key}-east`, entryKey: entry.key, side: "east", colStart: entry.col + footprint, colEnd: entry.col + footprint, row: entry.row });
    }
    if (slotTag(oriented.west) !== HARDWALL && !occupancy.has(cellKey(entry.row, entry.col - 1))) {
      points.push({ key: `${entry.key}-west`, entryKey: entry.key, side: "west", colStart: entry.col - 1, colEnd: entry.col - 1, row: entry.row });
    }
  }
  return points;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function spanFree(occupancy: Map<string, GridEntry>, row: number, colStart: number, footprint: number): boolean {
  for (let c = 0; c < footprint; c++) if (occupancy.has(cellKey(row, colStart + c))) return false;
  return true;
}

/**
 * First (tile, orientation, position) per tile that would validly occupy
 * `point` — not every permutation. For north/south this searches every
 * offset (not just dead-center), matching the real generator's "one
 * matching slot, rest lands on vacant space" rule; for east/west there's
 * no offset ambiguity (footprint is width-only, so a horizontal neighbor is
 * always a simple single-edge tag match).
 */
export function candidatesForAddPoint(tiles: TileDef[], entries: GridEntry[], point: AddPoint): PlacedCandidate[] {
  const occupancy = buildOccupancy(entries);
  const anchor = entries.find((e) => e.key === point.entryKey);
  if (!anchor) return [];
  const anchorOriented = applyOrientation(anchor.tile, anchor.orientation);
  const out: PlacedCandidate[] = [];

  tileLoop: for (const tile of tiles) {
    for (const orientation of validOrientations(tile.footprint)) {
      const candidateOriented = applyOrientation(tile, orientation);

      if (point.side === "north" || point.side === "south") {
        // North: candidate is physically upper (its south touches anchor's north) — findAlignments(above=anchor, below=candidate).
        // South: candidate is physically lower (its north touches anchor's south) — findAlignments(above=candidate, below=anchor).
        const alignments =
          point.side === "north" ? findAlignments(anchorOriented, candidateOriented) : findAlignments(candidateOriented, anchorOriented);
        for (const a of alignments) {
          if (!a.allMatch) continue;
          // offset = "below's footprint start relative to above's footprint start"
          const col = point.side === "north" ? anchor.col + a.offset : anchor.col - a.offset;
          if (!rangesOverlap(col, col + tile.footprint - 1, point.colStart, point.colEnd)) continue;
          if (!spanFree(occupancy, point.row, col, tile.footprint)) continue;
          out.push({ tile, orientation, row: point.row, col });
          continue tileLoop;
        }
      } else {
        const existingTag = point.side === "east" ? slotTag(anchorOriented.east) : slotTag(anchorOriented.west);
        const candidateTag = point.side === "east" ? slotTag(candidateOriented.west) : slotTag(candidateOriented.east);
        if (existingTag === HARDWALL || !edgeTagsMatch(existingTag, candidateTag)) continue;
        // East: candidate's leftmost column starts right after anchor. West: candidate's rightmost column ends right before anchor.
        const col = point.side === "east" ? point.colStart : point.colStart - tile.footprint + 1;
        if (!spanFree(occupancy, point.row, col, tile.footprint)) continue;
        out.push({ tile, orientation, row: point.row, col });
        continue tileLoop;
      }
    }
  }
  return out;
}

interface PositionedTile {
  tile: TileDef;
  orientation: Orientation;
  row: number;
  col: number;
}

/** True if `a` and `b` — using their REAL placed positions, not a search — would actually connect given how they're actually touching (adjacent row+overlapping columns, or adjacent column same row). Used to re-validate an existing relationship after a hypothetical rotation/flip, as opposed to candidatesForAddPoint's job of finding a brand new valid placement. */
function coordsConnect(a: PositionedTile, b: PositionedTile): boolean {
  if (a.row === b.row) {
    const left = a.col < b.col ? a : b;
    const right = a.col < b.col ? b : a;
    if (left.col + left.tile.footprint !== right.col) return false;
    const leftTag = slotTag(applyOrientation(left.tile, left.orientation).east);
    const rightTag = slotTag(applyOrientation(right.tile, right.orientation).west);
    return leftTag !== HARDWALL && edgeTagsMatch(leftTag, rightTag);
  }
  const upper = a.row < b.row ? a : b;
  const lower = a.row < b.row ? b : a;
  if (lower.row !== upper.row + 1) return false;
  const upperOriented = applyOrientation(upper.tile, upper.orientation);
  const lowerOriented = applyOrientation(lower.tile, lower.orientation);
  const offset = upper.col - lower.col; // "below" (upper, physically)'s colStart relative to "above" (lower)'s colStart
  return findAlignments(lowerOriented, upperOriented).some((a2) => a2.offset === offset && a2.allMatch);
}

/** Entries that physically touch `entryKey` right now (any of the 4 sides), regardless of whether that touch is currently valid. */
export function touchingEntries(entries: GridEntry[], entryKey: string): GridEntry[] {
  const entry = entries.find((e) => e.key === entryKey);
  if (!entry) return [];
  return entries.filter((other) => {
    if (other.key === entryKey) return false;
    const horizontallyTouching = other.row === entry.row && (other.col + other.tile.footprint === entry.col || entry.col + entry.tile.footprint === other.col);
    const verticallyTouching =
      Math.abs(other.row - entry.row) === 1 && other.col < entry.col + entry.tile.footprint && other.col + other.tile.footprint > entry.col;
    return horizontallyTouching || verticallyTouching;
  });
}

/** Would `orientation` still connect `entryKey` to every entry currently touching it? */
export function orientationValidAt(entries: GridEntry[], entryKey: string, orientation: Orientation): boolean {
  const entry = entries.find((e) => e.key === entryKey);
  if (!entry) return false;
  const candidate: PositionedTile = { tile: entry.tile, orientation, row: entry.row, col: entry.col };
  return touchingEntries(entries, entryKey).every((other) => coordsConnect(candidate, { tile: other.tile, orientation: other.orientation, row: other.row, col: other.col }));
}

/** Deleting a tile with 2+ neighbors would split the structure into disconnected pieces with no way to represent that yet — only leaves (0 or 1 neighbor) can be removed. */
export function canDeleteEntry(entries: GridEntry[], entryKey: string): boolean {
  return touchingEntries(entries, entryKey).length <= 1;
}
