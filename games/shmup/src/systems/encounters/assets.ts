/**
 * Works out every texture an authored encounter needs, so a scene can queue
 * them all in one `preload()` pass.
 *
 * The walk has to be **transitive**: an Action's attack spawns a Unit, that
 * Unit's own Actions may spawn more, and a Unit's Parts have their own
 * Action buffets. A bullet that splits into bullets is a supported (and
 * cheap) thing to author, so the art collection follows the same edges the
 * runtime will, with a visited set to terminate on the cycles that model
 * makes possible (a Unit whose attack spawns itself is legal).
 */
import { editorSpriteTextureKey, editorSpriteUrl, editorTileImageUrl, editorTileTextureKey } from "../../sprites/editorArt";
import type { AuthoredContent, AuthoredEncounter, AuthoredTile, AuthoredUnitDef } from "./authoredTypes";

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

/** Every (texture key -> URL) this encounter can possibly need, including the tile's own background art. */
export function collectEncounterTextures(
  content: AuthoredContent,
  tile: AuthoredTile,
  encounter: AuthoredEncounter
): AuthoredTextureRequest[] {
  const out = new Map<string, string>();
  const visited = new Set<string>();

  const tileUrl = editorTileImageUrl(tile.imageId, tile.customImage);
  if (tileUrl) out.set(editorTileTextureKey(tile.imageId, tile.id), tileUrl);

  for (const placement of encounter.units) {
    const unit = content.units.find((u) => u.id === placement.unitDefId);
    if (unit) addUnitTextures(unit, content, visited, out);
  }

  return [...out.entries()].map(([key, url]) => ({ key, url }));
}
