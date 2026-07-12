/**
 * fsStore-backed persistence for the tile library (specs/shmup-editor.todo.md,
 * E1 #191). Per root CLAUDE.md's mandatory rule: anything that saves data
 * uses the virtual filesystem, never raw localStorage — TILES.DAT is
 * hackable in Notebook like every other *.DAT file in the OS.
 */
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { SHMUP_EDITOR_TILES_ID } from "../NsDoors97/filesystem/types";
import { isValidEncounter } from "./encounterValidation";
import { CUSTOM_IMAGE_ID, NONE_IMAGE_ID } from "./tileImages";
import type { EdgeSlot, TileDef } from "./types";

// v2: `color` swatch replaced by `imageId` (tileImages.ts) — bumping so a
// pre-v2 save (missing imageId) is discarded rather than half-loaded.
// `customImage` (added later) does NOT bump this further — it's a purely
// additive optional field, so a v2 save missing it is still valid;
// normalizeTile() below backfills the default instead.
// v3: embedded EncounterStep shape changed (Trigger -> time, timeline
// scrubber pass) — bumping so a pre-v3 save's encounters (old trigger
// shape) reset via isValidEncounter rather than silently carrying a shape
// that no longer parses meaningfully.
// v4: embedded EncounterStep gained handleIn/handleOut (bezier-curve
// movement pass) — bumping for the same reason.
const SAVE_VERSION = 4;

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
    typeof tile.imageId === "string"
  );
}

// `customImage` and `encounters` were both added after v2 shipped as
// purely additive, optional fields, so their shape is deliberately NOT
// part of isValidTileDef above — a save missing or malformed on either
// (including a hand-edited TILES.DAT, which this hackable app explicitly
// permits per root CLAUDE.md) gets it reset to a safe default here rather
// than the whole tile being discarded.
function normalizeTile(tile: TileDef): TileDef {
  const customImage = typeof tile.customImage === "string" && tile.customImage ? tile.customImage : null;
  // A tile can't be left pointing imageId at a custom image that doesn't exist.
  const imageId = tile.imageId === CUSTOM_IMAGE_ID && !customImage ? NONE_IMAGE_ID : tile.imageId;
  const encounters = Array.isArray(tile.encounters) ? tile.encounters.filter(isValidEncounter) : [];
  // Strip a stale `biome` key left over from a removed feature — not part
  // of TileDef anymore, so a load shouldn't resurrect/re-persist it.
  const clean: TileDef & { biome?: unknown } = { ...tile, imageId, customImage, encounters };
  delete clean.biome;
  return clean;
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
