/**
 * Rotation/flip for tiles (levels-and-tiles.spec.todo.md, L1 #183).
 *
 * The design doc says tiles are "freely rotatable in 90° increments" but
 * also that footprint height is always exactly 1 row — those two claims
 * only agree for 1x1 tiles (rotating a wider-than-tall tile 90° would make
 * it taller-than-wide, breaking the one-row-per-tile invariant). Resolution:
 * 1x1 tiles get all 4 rotations (x flip = 8 orientations, matching the "up to
 * 8 usable orientations" the doc calls out); footprint 2/3 tiles only get
 * 0°/180° (x flip = 4 orientations) — rotating them would change their
 * physical footprint, which isn't representable in this grid.
 */
import { WILDCARD, type EdgeTag, type Footprint, type Orientation, type OrientedTile, type TileDef } from "./types";

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
  north: EdgeTag[];
  south: EdgeTag[];
  east: EdgeTag;
  west: EdgeTag;
}

/** Only ever invoked for 1x1 tiles (`validOrientations` never offers 90/270 to a wider footprint), so `north`/`south` are always single-element arrays here. */
function rotate90CW(edges: Edges): Edges {
  return { north: [edges.west], east: edges.north[0], south: [edges.east], west: edges.south[0] };
}

/** Valid for any footprint: 180° swaps top/bottom and left/right, reversing column order on the swap since rotating 180° also mirrors left-right. */
function rotate180(edges: Edges): Edges {
  return { north: [...edges.south].reverse(), south: [...edges.north].reverse(), east: edges.west, west: edges.east };
}

/** Horizontal flip: mirrors left-right, so column order reverses on north/south and east/west swap. Valid for any footprint. */
function flipHorizontal(edges: Edges): Edges {
  return { north: [...edges.north].reverse(), south: [...edges.south].reverse(), east: edges.west, west: edges.east };
}

export function applyOrientation(tile: TileDef, orientation: Orientation): OrientedTile {
  let edges: Edges = { north: [...tile.north], south: [...tile.south], east: tile.east, west: tile.west };
  if (orientation.rotation === 180) edges = rotate180(edges);
  else if (orientation.rotation === 90) edges = rotate90CW(edges);
  else if (orientation.rotation === 270) edges = rotate90CW(rotate90CW(rotate90CW(edges)));
  if (orientation.flip) edges = flipHorizontal(edges);
  return { footprint: tile.footprint, ...edges };
}

/** `candidateTag` is a tile's oriented `south`/`north` slot; `frontierTag` is what it's being matched against. Wildcard-aware (start/end connector tiles, spec §1). */
export function edgeTagsMatch(frontierTag: EdgeTag, candidateTag: EdgeTag): boolean {
  return candidateTag === WILDCARD || candidateTag === frontierTag;
}
