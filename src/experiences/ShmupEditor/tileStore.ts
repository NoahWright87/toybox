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
import { createDefaultTileLibrary, type EdgeSlot, type TileDef } from "./types";

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
// v5: embedded EncounterUnit gained `attacks: EncounterAttack[]`
// (Parts/weapon-track pass) — bumping for the same reason.
// v6: embedded EncounterStep's `actionId` was replaced by a plain
// `visible: boolean` (Actions cut entirely) — bumping for the same reason.
// v7: embedded EncounterUnit gained `scaling: UnitScaling` (E3 #193, a
// required object with its own required fields, not a purely-additive
// optional one) — bumping for the same "reset rather than silently carry a
// mismatched shape" reason as every prior EncounterUnit shape change.
// v8: UnitScaling's `minCount`/`powerSplit` fields were removed — the
// count/power algorithm was corrected to a single-pool model
// (unitScaling.ts's `resolveScaling`) that doesn't use either. Bumping so a
// pre-v8 save doesn't silently carry the two dead fields forward.
// v9: embedded EncounterStep dropped `visible`/`speedMultiplier`, gained
// `actionId`; embedded EncounterAttack was replaced by PartActionPlacement
// (`encounterTypes.ts`) — Actions are back. Bumping for the same reason as
// v6 (the mirror-image change, when Actions were cut).
const SAVE_VERSION = 9;

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

/**
 * A brand-new install (`content` empty) or a version-mismatched/corrupt
 * save both land here — seeded with the default tile library (one TileDef
 * per built-in image in tileImages.ts, see types.ts's
 * createDefaultTileLibrary) rather than a truly empty one, so the editor's
 * tile picker isn't blank the first time it's opened. Mirrors
 * unitStore.ts's seedAndPersistDefaultLibrary. The seed is saved
 * immediately so it's a real, editable/deletable library entry from the
 * next load onward, not silently regenerated every time.
 */
function seedAndPersistDefaultLibrary(): TileDef[] {
  const tiles = createDefaultTileLibrary();
  saveTiles(tiles);
  return tiles;
}

export function loadTiles(): TileDef[] {
  const content = fsStore.getFile(SHMUP_EDITOR_TILES_ID)?.content;
  if (!content) return seedAndPersistDefaultLibrary();
  try {
    const parsed = JSON.parse(content) as SavedLibrary;
    if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.tiles)) return seedAndPersistDefaultLibrary();
    return parsed.tiles.filter(isValidTileDef).map(normalizeTile);
  } catch {
    return seedAndPersistDefaultLibrary();
  }
}

export function saveTiles(tiles: TileDef[]): void {
  const saved: SavedLibrary = { version: SAVE_VERSION, tiles };
  fsStore.writeFile(SHMUP_EDITOR_TILES_ID, JSON.stringify(saved));
}
