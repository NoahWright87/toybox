/**
 * Frontier-based grid-fill level generator (levels-and-tiles.spec.todo.md,
 * L1 #183) — Rogue Legacy-style room placement adapted for a vertical
 * scroller. A frontier is a single open connector (one column, one row, one
 * tag); a tile attaches by matching exactly one of its oriented `south`
 * slots against an open frontier at the aligned column — the rest of its
 * footprint just needs to land on unclaimed grid space (or on OTHER open
 * frontiers whose tags also agree, which is exactly what a merge is: 2+
 * incoming frontiers consumed by one tile in one placement). This is what
 * makes splits, merges, and hard-wall narrowing fall out of the same
 * column-by-column matching rule rather than needing separate cases.
 */
import { mulberry32, weightedPick } from "../map/rng";
import { applyOrientation, edgeTagsMatch, validOrientations } from "./orientation";
import { HARDWALL } from "./types";
import type { LevelGenOptions, LevelGenResult, OpenFrontier, Orientation, OrientedTile, PlacedTile, TileDef } from "./types";

interface Candidate {
  tile: TileDef;
  orientation: Orientation;
  oriented: OrientedTile;
  startX: number;
}

/** Every tile/orientation/horizontal-alignment that could legally attach to the open frontier at `column` in this row. */
function findCandidates(
  tiles: readonly TileDef[],
  column: number,
  rowFrontiers: Map<number, OpenFrontier>,
  occupied: Set<number>,
  maxWidth: number
): Candidate[] {
  const frontier = rowFrontiers.get(column);
  if (!frontier) return [];

  const out: Candidate[] = [];
  for (const tile of tiles) {
    for (const orientation of validOrientations(tile.footprint)) {
      const oriented = applyOrientation(tile, orientation);
      for (let alignment = 0; alignment < oriented.footprint; alignment++) {
        const startX = column - alignment;
        if (startX < 0 || startX + oriented.footprint > maxWidth) continue;

        let fits = true;
        for (let i = 0; i < oriented.footprint && fits; i++) {
          const col = startX + i;
          if (occupied.has(col)) fits = false;
          else {
            const existing = rowFrontiers.get(col);
            if (existing && !edgeTagsMatch(existing.tag, oriented.south[i])) fits = false;
          }
        }
        if (fits) out.push({ tile, orientation, oriented, startX });
      }
    }
  }
  return out;
}

/**
 * Generates one level's worth of placed tiles from a fixed tile set. Pure
 * and seeded (mirrors `systems/map/generateMap.ts`'s deterministic style) —
 * no Phaser/scene dependency; JIT streaming (calling this incrementally as
 * the player approaches the frontier) is L2 #184's job, built on top of this.
 */
export function generateLevel(tiles: readonly TileDef[], opts: LevelGenOptions): LevelGenResult {
  const rng = mulberry32(opts.seed);
  const startColumn = opts.startColumn ?? 0;
  const startBudget = opts.startBudget ?? 0;
  const budgetGrowthPerRow = opts.budgetGrowthPerRow ?? 1;

  const frontiersByRow = new Map<number, Map<number, OpenFrontier>>();
  frontiersByRow.set(
    0,
    new Map([[startColumn, { column: startColumn, row: 0, tag: opts.startTag, budget: startBudget }]])
  );

  const placedTiles: PlacedTile[] = [];
  let row = 0;

  while (row < opts.maxRows) {
    const rowFrontiers = frontiersByRow.get(row);
    if (!rowFrontiers || rowFrontiers.size === 0) break; // every branch through this row already dead-ended

    const occupied = new Set<number>();
    const columnsThisRow = [...rowFrontiers.keys()].sort((a, b) => a - b);

    for (const column of columnsThisRow) {
      if (!rowFrontiers.has(column)) continue; // already consumed earlier this row by a merge at a neighboring column

      const candidates = findCandidates(tiles, column, rowFrontiers, occupied, opts.maxWidth);
      if (candidates.length === 0) continue; // dead frontier: no authored tile matches here (a content gap once tile sets are curated)

      const { tile, orientation, oriented, startX } = weightedPick(rng, candidates, (c) => c.tile.weight ?? 1);
      const span = Array.from({ length: oriented.footprint }, (_, i) => startX + i);

      let combinedBudget = 0;
      for (const c of span) {
        const consumed = rowFrontiers.get(c);
        if (consumed) {
          combinedBudget = Math.max(combinedBudget, consumed.budget);
          rowFrontiers.delete(c); // merge: every incoming frontier this placement covers collapses here
        }
        occupied.add(c);
      }

      const isDeadEnd = oriented.north.every((tag) => tag === HARDWALL);
      placedTiles.push({ tileId: tile.id, orientation, xStart: startX, xEnd: startX + oriented.footprint, row, isDeadEnd });

      if (!isDeadEnd) {
        let nextRowFrontiers = frontiersByRow.get(row + 1);
        if (!nextRowFrontiers) {
          nextRowFrontiers = new Map();
          frontiersByRow.set(row + 1, nextRowFrontiers);
        }
        for (let i = 0; i < oriented.footprint; i++) {
          const tag = oriented.north[i];
          if (tag === HARDWALL) continue; // this slot doesn't open a new frontier — narrowing/splitting falls out of this check alone
          const col = startX + i;
          nextRowFrontiers.set(col, { column: col, row: row + 1, tag, budget: combinedBudget + budgetGrowthPerRow });
        }
      }
    }
    row++;
  }

  const openFrontiers: OpenFrontier[] = [];
  for (const rowFrontiers of frontiersByRow.values()) openFrontiers.push(...rowFrontiers.values());

  return { placedTiles, openFrontiers };
}
