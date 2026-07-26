/**
 * fsStore-backed persistence for the Connection Viewer's assembled layout —
 * `LEVEL.DAT`, alongside `TILES.DAT`/`UNITS.DAT` in the same folder, per
 * root `CLAUDE.md`'s rule that anything saving data goes through the
 * virtual filesystem.
 *
 * This exists so the **game** has something to read. The Connection Viewer
 * kept its grid in local component state, which is fine for checking seams
 * but leaves nothing behind to play. "Play test this level" saves the
 * layout here first, and `games/shmup` reads it back out of the shared FS
 * blob — the same handoff `TILES.DAT`/`UNITS.DAT` already use.
 *
 * The saved shape is deliberately thin: a tile **id** plus where and how
 * it sits. Everything else about a tile (art, edges, encounters) is looked
 * up fresh from `TILES.DAT` at play time, so editing a tile is immediately
 * reflected in a previously-saved layout instead of being frozen into it.
 */
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { SHMUP_EDITOR_LEVEL_ID } from "../NsDoors97/filesystem/types";
import type { GridEntry } from "./connectionGrid";
import type { Orientation } from "./orientation";

const SAVE_VERSION = 1;

export interface SavedLevelEntry {
  tileId: string;
  /** Grid row — grows south, matching `connectionGrid.ts`. The game flips this into play order. */
  row: number;
  /** Leftmost occupied column. */
  col: number;
  /** Carried so the game doesn't have to re-derive it from the tile it looks up. */
  footprint: 1 | 2 | 3;
  orientation: Orientation;
}

interface SavedLevel {
  version: number;
  entries: SavedLevelEntry[];
  savedAt: number;
}

function isOrientation(v: unknown): v is Orientation {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (o.rotation === 0 || o.rotation === 90 || o.rotation === 180 || o.rotation === 270) && typeof o.flip === "boolean";
}

function isEntry(v: unknown): v is SavedLevelEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.tileId === "string" &&
    Number.isFinite(e.row) &&
    Number.isFinite(e.col) &&
    (e.footprint === 1 || e.footprint === 2 || e.footprint === 3) &&
    isOrientation(e.orientation)
  );
}

export function saveLevel(entries: readonly GridEntry[]): void {
  const saved: SavedLevel = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    entries: entries.map((e) => ({
      tileId: e.tile.id,
      row: e.row,
      col: e.col,
      footprint: e.tile.footprint,
      orientation: e.orientation,
    })),
  };
  fsStore.writeFile(SHMUP_EDITOR_LEVEL_ID, JSON.stringify(saved));
}

/** The last saved layout, or `[]` if there isn't one (or it no longer parses). */
export function loadLevel(): SavedLevelEntry[] {
  const content = fsStore.getFile(SHMUP_EDITOR_LEVEL_ID)?.content;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as SavedLevel;
    if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter(isEntry);
  } catch {
    return [];
  }
}
