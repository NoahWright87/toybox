/**
 * Autogeneration for the Connection Viewer — "hit a button instead of hand
 * picking every tile."
 *
 * It grows the layout **north**, which is forward: the Connection Viewer's
 * rows grow south, the player flies north, so each tile added at a lower row
 * is one the player meets later. Every placement goes through
 * `candidatesForAddPoint` — the exact matcher the manual "+ Add" button
 * uses — so a generated level is legal by the same rules a hand-built one
 * is, and is fully editable afterwards (rotate, delete, extend) rather than
 * being an opaque blob.
 *
 * **It extends rather than replaces.** Pressing it with tiles already
 * placed grows from the existing frontier; pressing it on an empty grid
 * picks a random starting tile first. Pressing it twice makes a longer
 * level. That's why there's no "length" control: the button *is* the
 * length control.
 *
 * ## Why not the game's generator?
 *
 * `games/shmup/src/systems/levels/generateLevel.ts` is the real L1
 * frontier-and-budget generator, and eventually runtime levels should come
 * from it. It solves a different problem though: it streams a level forward
 * from a single open edge with per-branch difficulty budgets, in its own
 * coordinate model, with no notion of the free-form 2D grid the Connection
 * Viewer lets you build in every direction. Reusing it here would mean
 * translating both ways and still not being able to hand-edit the result
 * with the viewer's own tools. This is an authoring aid built on the
 * viewer's own rules; when runtime generation lands, the two should
 * converge on the game's model — see `specs/shmup-editor.todo.md`.
 */
import { candidatesForAddPoint, computeAddPoints, type AddPoint, type GridEntry, type PlacedCandidate } from "./connectionGrid";
import { IDENTITY_ORIENTATION } from "./orientation";
import type { TileDef } from "./types";

/** How many tiles one press adds. Roughly half a minute of play at the shared scroll speed — long enough to feel like a level, short enough to iterate on. */
export const AUTOGEN_TILE_COUNT = 8;

function makeKey(tileId: string, rng: () => number): string {
  return `${tileId}-${Date.now().toString(36)}-${Math.floor(rng() * 1e6).toString(36)}`;
}

/** Weighted pick by each item's tile `weight`, the same relative-frequency dial the generator and the tile picker both read. Falls back to uniform if every weight is zero. */
function weightedPick<T extends { tile: TileDef }>(items: T[], rng: () => number): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.tile.weight), 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)] ?? items[0];
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, item.tile.weight);
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

function toEntry(candidate: PlacedCandidate, rng: () => number): GridEntry {
  return { key: makeKey(candidate.tile.id, rng), tile: candidate.tile, orientation: candidate.orientation, row: candidate.row, col: candidate.col };
}

/**
 * Growth points, northmost first. Preferring the leading edge is what keeps
 * a generated level a *level* — filling an older frontier instead would
 * sprout branches sideways off tiles the player has already flown past.
 */
function northPoints(entries: GridEntry[]): AddPoint[] {
  return computeAddPoints(entries)
    .filter((p) => p.side === "north")
    .sort((a, b) => a.row - b.row);
}

/**
 * Adds up to `count` tiles to `entries`, growing north. Stops early if the
 * tile set runs out of anything that connects — a dead end is a real
 * property of the authored tag graph, not an error, and the partial level
 * it produces is exactly the diagnostic (the tag-graph view is where you'd
 * go fix it).
 *
 * `rng` is injected so this is deterministic under test; the UI passes
 * `Math.random`.
 */
export function autoGenerateLayout(
  tiles: TileDef[],
  entries: GridEntry[],
  count = AUTOGEN_TILE_COUNT,
  rng: () => number = Math.random
): GridEntry[] {
  if (tiles.length === 0 || count <= 0) return entries;

  const out = [...entries];
  let added = 0;

  if (out.length === 0) {
    const seed = weightedPick(tiles.map((tile) => ({ tile })), rng).tile;
    out.push({ key: makeKey(seed.id, rng), tile: seed, orientation: IDENTITY_ORIENTATION, row: 0, col: 0 });
    added += 1;
  }

  while (added < count) {
    const points = northPoints(out);
    if (points.length === 0) break;

    // Try each frontier in turn: the northmost one may have no tile that
    // fits (a hard-walled or orphan tag), which doesn't mean the level is
    // finished — a frontier beside it may still grow.
    let placed = false;
    for (const point of points) {
      const candidates = candidatesForAddPoint(tiles, out, point);
      if (candidates.length === 0) continue;
      out.push(toEntry(weightedPick(candidates, rng), rng));
      added += 1;
      placed = true;
      break;
    }
    if (!placed) break;
  }

  return out;
}
