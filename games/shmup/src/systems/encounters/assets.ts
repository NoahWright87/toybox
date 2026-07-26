/**
 * Works out every texture a level needs, so a scene can queue them all in
 * one `preload()` pass.
 *
 * Two things have to be collected, and they are **independent**:
 *
 * - **Every placed tile's own art**, whether or not that tile has any
 *   encounters. A tile with no enemies on it is perfectly ordinary
 *   terrain — it still has to be drawn and still has to scroll past. An
 *   earlier version walked (tile, encounter) pairs and collected the tile
 *   image inside that walk, so an encounter-less tile contributed nothing,
 *   its texture never loaded, and it rendered as a hole in the level.
 * - **Every unit a level's encounters could spawn.** A level rolls its
 *   Encounter per tile at run time, so every *candidate* has to be covered
 *   here, not just the one that ends up chosen.
 *
 * The unit walk is **transitive**: an Action's attack spawns a Unit, that
 * Unit's own Actions may spawn more, and a Unit's Parts have their own
 * Action buffets. A bullet that splits into bullets is a supported (and
 * cheap) thing to author, so this follows the same edges the runtime will,
 * with a visited set to terminate on the cycles that model makes possible
 * (a Unit whose attack spawns itself is legal).
 */
import { editorSpriteTextureKey, editorSpriteUrl, editorTileImageUrl, editorTileTextureKey } from "../../sprites/editorArt";
import type { AuthoredContent, AuthoredEncounter, AuthoredTile, AuthoredUnitDef } from "./authoredTypes";
import type { LevelLayout } from "./levelLayout";

export interface AuthoredTextureRequest {
  key: string;
  url: string;
}

function addUnitTextures(
  unit: AuthoredUnitDef,
  content: AuthoredContent,
  visited: Set<string>,
  out: Map<string, string>
): void {
  if (visited.has(unit.id)) return;
  visited.add(unit.id);

  const bodyUrl = editorSpriteUrl(unit.spriteId, unit.customSprite);
  if (bodyUrl) out.set(editorSpriteTextureKey(unit.spriteId, unit.id), bodyUrl);

  for (const part of unit.parts) {
    const partUrl = editorSpriteUrl(part.spriteId, part.customSprite);
    if (partUrl) out.set(editorSpriteTextureKey(part.spriteId, part.id), partUrl);
  }

  const actions = [...unit.actions, ...unit.parts.flatMap((p) => p.actions)];
  for (const action of actions) {
    const spawnId = action.attack?.spawnUnitId;
    if (!spawnId) continue;
    const spawned = content.units.find((u) => u.id === spawnId);
    if (spawned) addUnitTextures(spawned, content, visited, out);
  }
}

function addTileArt(tile: AuthoredTile, out: Map<string, string>): void {
  const url = editorTileImageUrl(tile.imageId, tile.customImage);
  if (url) out.set(editorTileTextureKey(tile.imageId, tile.id), url);
}

function addEncounterUnits(content: AuthoredContent, encounter: AuthoredEncounter, visited: Set<string>, out: Map<string, string>): void {
  for (const placement of encounter.units) {
    const unit = content.units.find((u) => u.id === placement.unitDefId);
    if (unit) addUnitTextures(unit, content, visited, out);
  }
}

/** Every (texture key -> URL) one encounter's units can possibly need. Tile art is not included — see the file header. */
export function collectEncounterUnitTextures(content: AuthoredContent, encounter: AuthoredEncounter): AuthoredTextureRequest[] {
  const out = new Map<string, string>();
  addEncounterUnits(content, encounter, new Set<string>(), out);
  return [...out.entries()].map(([key, url]) => ({ key, url }));
}

/**
 * Every texture a whole level can need: each placed tile's art, plus the
 * units of every Encounter any of those tiles could roll.
 *
 * `forcedEncounterId` narrows the encounter walk to the one the Encounter
 * editor's Play Test pinned — it never narrows the tile-art walk, since the
 * tile is drawn either way.
 */
export function collectLevelTextures(
  content: AuthoredContent,
  layout: LevelLayout,
  forcedEncounterId?: string
): AuthoredTextureRequest[] {
  const out = new Map<string, string>();
  const visited = new Set<string>();

  for (const placement of layout.placements) {
    const tile = content.tiles.find((t) => t.id === placement.tileId);
    if (!tile) continue;
    addTileArt(tile, out);
    const encounters = forcedEncounterId ? tile.encounters.filter((e) => e.id === forcedEncounterId) : tile.encounters;
    for (const encounter of encounters) addEncounterUnits(content, encounter, visited, out);
  }

  return [...out.entries()].map(([key, url]) => ({ key, url }));
}
