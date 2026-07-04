/**
 * Rotation/flip + edge matching for the editor's own tile preview and
 * connection tester (specs/shmup-editor.todo.md, E1 #191). A standalone
 * reimplementation of the same rules as games/shmup's L1 generator
 * (specs/games/shmup/levels-and-tiles.spec.todo.md) — see types.ts's header
 * for why this isn't a shared import.
 *
 * 1x1 tiles get all 4 rotations (x flip = 8 orientations); footprint 2/3
 * tiles only get 0deg/180deg (x flip = 4) — rotating a wider-than-tall tile
 * 90deg would make it taller-than-wide, which this grid can't represent
 * (tile height is always exactly 1 row).
 */
import { HARDWALL, WILDCARD, slotTag, type EdgeSlot, type Footprint, type TileDef } from "./types";

export interface Orientation {
  rotation: 0 | 90 | 180 | 270;
  flip: boolean;
}

export interface OrientedEdges {
  footprint: Footprint;
  north: EdgeSlot[];
  south: EdgeSlot[];
  east: EdgeSlot;
  west: EdgeSlot;
}

export function validOrientations(footprint: Footprint): Orientation[] {
  const rotations: Array<0 | 90 | 180 | 270> = footprint === 1 ? [0, 90, 180, 270] : [0, 180];
  const out: Orientation[] = [];
  for (const rotation of rotations) {
    out.push({ rotation, flip: false });
    out.push({ rotation, flip: true });
  }
  return out;
}

interface Edges {
  north: EdgeSlot[];
  south: EdgeSlot[];
  east: EdgeSlot;
  west: EdgeSlot;
}

/** Only ever invoked for 1x1 tiles (`validOrientations` never offers 90/270 to a wider footprint). */
function rotate90CW(edges: Edges): Edges {
  return { north: [edges.west], east: edges.north[0], south: [edges.east], west: edges.south[0] };
}

function rotate180(edges: Edges): Edges {
  return { north: [...edges.south].reverse(), south: [...edges.north].reverse(), east: edges.west, west: edges.east };
}

function flipHorizontal(edges: Edges): Edges {
  return { north: [...edges.north].reverse(), south: [...edges.south].reverse(), east: edges.west, west: edges.east };
}

export function applyOrientation(tile: TileDef, orientation: Orientation): OrientedEdges {
  let edges: Edges = { north: [...tile.north], south: [...tile.south], east: tile.east, west: tile.west };
  if (orientation.rotation === 180) edges = rotate180(edges);
  else if (orientation.rotation === 90) edges = rotate90CW(edges);
  else if (orientation.rotation === 270) edges = rotate90CW(rotate90CW(rotate90CW(edges)));
  if (orientation.flip) edges = flipHorizontal(edges);
  return { footprint: tile.footprint, ...edges };
}

export function edgeTagsMatch(frontierTag: string, candidateTag: string): boolean {
  return candidateTag === WILDCARD || candidateTag === frontierTag;
}

export interface AlignmentMatch {
  /** Column offset of `below`'s footprint start relative to `above`'s footprint start (can be negative). */
  offset: number;
  /** Per-column match results across the overlap, in `above`'s column order. */
  columns: Array<{ aboveTag: string; belowTag: string; matched: boolean }>;
  /** True only where every overlapping column is a real (non-hardwall-on-both-sides-mismatch) tag match. */
  allMatch: boolean;
}

/**
 * Every way `below`'s (oriented) south edge could sit against `above`'s
 * (oriented) north edge, sliding `below` across every horizontal alignment
 * that gives at least one overlapping column — mirrors the actual generator's
 * "one matching slot, rest lands on vacant space" rule (L1 #183), so a
 * mismatch on a column outside the overlap is never possible by construction.
 */
export function findAlignments(above: OrientedEdges, below: OrientedEdges): AlignmentMatch[] {
  const results: AlignmentMatch[] = [];
  const minOffset = -(below.footprint - 1);
  const maxOffset = above.footprint - 1;
  for (let offset = minOffset; offset <= maxOffset; offset++) {
    const columns: AlignmentMatch["columns"] = [];
    for (let i = 0; i < below.footprint; i++) {
      const aboveIndex = i + offset;
      if (aboveIndex < 0 || aboveIndex >= above.footprint) continue;
      const aboveTag = slotTag(above.north[aboveIndex]);
      const belowTag = slotTag(below.south[i]);
      // A hardwall column never opens a frontier in the real generator, so nothing can ever legally attach there.
      const matched = aboveTag !== HARDWALL && edgeTagsMatch(aboveTag, belowTag);
      columns.push({ aboveTag, belowTag, matched });
    }
    if (columns.length === 0) continue;
    results.push({ offset, columns, allMatch: columns.every((c) => c.matched) });
  }
  return results;
}

export { HARDWALL };
