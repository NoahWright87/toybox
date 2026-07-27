/**
 * Reads the Connection Viewer's saved layout (`LEVEL.DAT`) and turns it
 * into something playable, and picks which Encounter each tile runs.
 *
 * Same same-origin FS read as `authoredContent.ts` — the editor writes the
 * layout as a thin list of tile **ids** plus where and how each sits, so
 * everything else about a tile is resolved fresh from `TILES.DAT` at play
 * time. Editing a tile therefore shows up immediately in a layout saved
 * earlier, instead of being frozen into it.
 */
import { layoutFromGrid, type GridPlacement, type LevelLayout, type TileOrientation } from "./levelLayout";
import type { AuthoredContent, AuthoredEncounter, AuthoredFootprint, AuthoredTile } from "./authoredTypes";

const FS_STORAGE_KEY = "ns97_fs_v1";
const LEVEL_NODE_ID = "fs:shmup-editor-level";

/** Must match `src/experiences/ShmupEditor/levelStore.ts`'s `SAVE_VERSION`. */
export const AUTHORED_LEVEL_VERSION = 1;

interface FsNodeLite {
  id: string;
  kind: "file" | "folder" | "shortcut";
  name: string;
  parentId: string | null;
  content?: string;
}

function isOrientation(v: unknown): v is TileOrientation {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (o.rotation === 0 || o.rotation === 90 || o.rotation === 180 || o.rotation === 270) && typeof o.flip === "boolean";
}

function isEntry(v: unknown): v is GridPlacement {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.tileId === "string" &&
    typeof e.row === "number" &&
    Number.isFinite(e.row) &&
    typeof e.col === "number" &&
    Number.isFinite(e.col) &&
    (e.footprint === 1 || e.footprint === 2 || e.footprint === 3) &&
    isOrientation(e.orientation)
  );
}

/** Parses a `LEVEL.DAT` payload into play order. Empty on a version mismatch or bad JSON. */
export function parseAuthoredLevel(raw: string | undefined): LevelLayout {
  if (!raw) return { placements: [], columns: 0 };
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; entries?: unknown };
    if (parsed.version !== AUTHORED_LEVEL_VERSION || !Array.isArray(parsed.entries)) return { placements: [], columns: 0 };
    return layoutFromGrid(parsed.entries.filter(isEntry));
  } catch {
    return { placements: [], columns: 0 };
  }
}

/** The layout the editor last saved, read fresh from the shared FS blob. */
export function loadAuthoredLevel(): LevelLayout {
  if (typeof window === "undefined") return { placements: [], columns: 0 };
  try {
    const raw = window.localStorage.getItem(FS_STORAGE_KEY);
    if (!raw) return { placements: [], columns: 0 };
    const nodes = new Map(JSON.parse(raw) as [string, FsNodeLite][]);
    return parseAuthoredLevel(nodes.get(LEVEL_NODE_ID)?.content);
  } catch {
    return { placements: [], columns: 0 };
  }
}

/**
 * Picks one of a tile's Encounters by `weight` — "each tile can have
 * multiple encounters; a random one (weighted) is picked when the tile
 * spawns in a level," which is what makes a tile's personality vary
 * between placements instead of replaying identically.
 *
 * `rng` is injected so a level can be reproducible from a seed later; the
 * playtest passes `Math.random`.
 */
export function pickEncounter(tile: AuthoredTile, rng: () => number): AuthoredEncounter | null {
  const options = tile.encounters;
  if (options.length === 0) return null;
  const total = options.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
  if (total <= 0) return options[Math.floor(rng() * options.length)] ?? options[0];
  let roll = rng() * total;
  for (const option of options) {
    roll -= Math.max(0, option.weight);
    if (roll < 0) return option;
  }
  return options[options.length - 1];
}

/** Footprint to lay a placement out with — the tile's own, or 1 if the tile no longer resolves. */
export function footprintFor(content: AuthoredContent, tileId: string): AuthoredFootprint {
  return content.tiles.find((t) => t.id === tileId)?.footprint ?? 1;
}
