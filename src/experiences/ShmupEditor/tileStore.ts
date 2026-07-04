/**
 * fsStore-backed persistence for the tile library (specs/shmup-editor.todo.md,
 * E1 #191). Per root CLAUDE.md's mandatory rule: anything that saves data
 * uses the virtual filesystem, never raw localStorage — TILES.DAT is
 * hackable in Notebook like every other *.DAT file in the OS.
 */
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { SHMUP_EDITOR_TILES_ID } from "../NsDoors97/filesystem/types";
import type { EdgeSlot, TileDef } from "./types";

// v2: `color` swatch replaced by `imageId` (tileImages.ts) — bumping so a
// pre-v2 save (missing imageId) is discarded rather than half-loaded.
const SAVE_VERSION = 2;

interface SavedLibrary {
  version: number;
  tiles: TileDef[];
}

function isEdgeSlot(value: unknown): value is EdgeSlot {
  if (typeof value !== "object" || value === null) return false;
  const slot = value as Record<string, unknown>;
  return typeof slot.tag === "string" && typeof slot.hardwall === "boolean";
}

/** Defensive shape check (same spirit as MahjongSolitaire's loadSavedState) — a corrupt or stale-shape save falls back to an empty library rather than crashing. */
function isValidTileDef(value: unknown): value is TileDef {
  if (typeof value !== "object" || value === null) return false;
  const tile = value as Record<string, unknown>;
  return (
    typeof tile.id === "string" &&
    typeof tile.name === "string" &&
    (tile.footprint === 1 || tile.footprint === 2 || tile.footprint === 3) &&
    Array.isArray(tile.north) &&
    tile.north.every(isEdgeSlot) &&
    tile.north.length === tile.footprint &&
    Array.isArray(tile.south) &&
    tile.south.every(isEdgeSlot) &&
    tile.south.length === tile.footprint &&
    isEdgeSlot(tile.east) &&
    isEdgeSlot(tile.west) &&
    typeof tile.isConnector === "boolean" &&
    typeof tile.weight === "number" &&
    typeof tile.imageId === "string" &&
    (tile.customImage === undefined || tile.customImage === null || typeof tile.customImage === "string") &&
    (tile.biome === undefined || tile.biome === null || typeof tile.biome === "string")
  );
}

// `customImage`/`biome` were added after v2 shipped as purely additive,
// optional fields — a v2 save missing them is still valid, just backfilled
// to their default (null) rather than being discarded wholesale.
function normalizeTile(tile: TileDef): TileDef {
  return { ...tile, customImage: tile.customImage ?? null, biome: tile.biome ?? null };
}

export function loadTiles(): TileDef[] {
  const content = fsStore.getFile(SHMUP_EDITOR_TILES_ID)?.content;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as SavedLibrary;
    if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.tiles)) return [];
    return parsed.tiles.filter(isValidTileDef).map(normalizeTile);
  } catch {
    return [];
  }
}

export function saveTiles(tiles: TileDef[]): void {
  const saved: SavedLibrary = { version: SAVE_VERSION, tiles };
  fsStore.writeFile(SHMUP_EDITOR_TILES_ID, JSON.stringify(saved));
}
