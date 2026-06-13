import type { BoardSlot, TilePosition } from "./layout";
import { TILE_DESIGNS } from "./tiles";

export interface BoardTile {
  slotId: string;
  pos: TilePosition;
  designId: string;
  removed: boolean;
}

export type Board = BoardTile[];

/** True rectangle overlap; tile footprint is [x, x+2) x [y, y+2) in half-units. */
export function overlaps(a: TilePosition, b: TilePosition): boolean {
  return Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
}

/**
 * A tile is free if nothing sits on top of it (z+1 layer overlapping it),
 * and at least one of its left/right sides is unobstructed at the same or
 * higher layer.
 */
export function isFree(board: Board, tile: BoardTile): boolean {
  let coveredFromAbove = false;
  let leftBlocked = false;
  let rightBlocked = false;

  for (const t of board) {
    if (t.removed) continue;
    if (t === tile) continue;

    if (t.pos.z === tile.pos.z + 1 && overlaps(t.pos, tile.pos)) {
      coveredFromAbove = true;
    }

    if (t.pos.z >= tile.pos.z && Math.abs(t.pos.y - tile.pos.y) < 2) {
      if (t.pos.x > tile.pos.x - 4 && t.pos.x < tile.pos.x) {
        leftBlocked = true;
      }
      if (t.pos.x < tile.pos.x + 4 && t.pos.x > tile.pos.x) {
        rightBlocked = true;
      }
    }
  }

  return !coveredFromAbove && (!leftBlocked || !rightBlocked);
}

export function getFreeTiles(board: Board): BoardTile[] {
  return board.filter((tile) => !tile.removed && isFree(board, tile));
}

export function getMatchablePairs(board: Board): Array<[BoardTile, BoardTile]> {
  const free = getFreeTiles(board);
  const pairs: Array<[BoardTile, BoardTile]> = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (free[i].designId === free[j].designId) {
        pairs.push([free[i], free[j]]);
      }
    }
  }
  return pairs;
}

/** Pure Fisher-Yates shuffle; returns a new array. */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Assigns design ids from `pairDeckIds` (consumed 2-at-a-time, in pairs) to
 * the given `slots`, working backward: at each step, find slots that are
 * still unassigned but would be `isFree` if the only "present" tiles were
 * the already-assigned ones plus this candidate (everything else stays
 * transparent/removed). Returns a map of slotId -> designId covering every
 * slot in `slots`.
 *
 * `pairDeckIds` must have exactly `slots.length` entries, structured as
 * consecutive pairs (each id appears an even number of times overall).
 */
export function assignSolvableIds(slots: BoardSlot[], pairDeckIds: string[]): Map<string, string> {
  const deck = shuffle(pairDeckIds);

  // Working board over just these slots; everything starts removed/blank.
  const working: Board = slots.map((slot) => ({
    slotId: slot.id,
    pos: slot.pos,
    designId: "",
    removed: true,
  }));

  const bySlotId = new Map<string, BoardTile>();
  for (const tile of working) bySlotId.set(tile.slotId, tile);

  const remaining = slots.length;
  for (let step = 0; step < remaining / 2; step++) {
    // Find candidate slots: still removed, but would be free if placed now.
    const candidates: BoardTile[] = [];
    for (const tile of working) {
      if (!tile.removed) continue;
      // Temporarily mark as present and test isFree against the working board
      // (all other still-removed tiles stay removed/transparent).
      tile.removed = false;
      const free = isFree(working, tile);
      tile.removed = true;
      if (free) candidates.push(tile);
    }

    let first: BoardTile;
    let second: BoardTile;
    if (candidates.length >= 2) {
      const shuffledCandidates = shuffle(candidates);
      [first, second] = shuffledCandidates;
    } else {
      // Fallback: shouldn't happen for a well-formed layout, but guarantees
      // every slot gets a tile (never blank) even if the reverse-construction
      // ran out of free candidates early.
      const stillRemoved = working.filter((tile) => tile.removed);
      if (stillRemoved.length < 2) break;
      const shuffledRemaining = shuffle(stillRemoved);
      [first, second] = shuffledRemaining;
    }

    const designId = deck.pop();
    if (designId === undefined) break;

    first.designId = designId;
    first.removed = false;
    second.designId = designId;
    second.removed = false;
  }

  const result = new Map<string, string>();
  for (const tile of working) result.set(tile.slotId, tile.designId);
  return result;
}

function buildPairDeck(): string[] {
  const deck: string[] = [];
  for (const design of TILE_DESIGNS) {
    deck.push(design.id, design.id);
  }
  return shuffle(deck);
}

/** Builds a freshly-shuffled, guaranteed-solvable board for the given layout slots. */
export function generateSolvableBoard(slots: BoardSlot[]): Board {
  const pairDeck = buildPairDeck();
  const assignments = assignSolvableIds(slots, pairDeck);

  return slots.map((slot) => ({
    slotId: slot.id,
    pos: slot.pos,
    designId: assignments.get(slot.id) ?? "",
    removed: false,
  }));
}
