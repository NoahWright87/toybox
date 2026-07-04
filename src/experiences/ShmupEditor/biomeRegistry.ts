/**
 * Biome registry (specs/shmup-editor.todo.md, E1 #191's remaining "biome
 * tagging on tiles" gap; per specs/games/shmup/levels-and-tiles.spec.todo.md's
 * L7 #189). Biomes are primarily an art + edge-tag concern, not an
 * enforced enum, so this list is a starting suggestion set — "+ New
 * biome..." (BiomeSelect.tsx) extends it the same way tagRegistry.ts's
 * "+ New tag..." extends edge tags.
 */
import type { TileDef } from "./types";

export const KNOWN_BIOMES = ["water", "dirt", "woods", "city", "desert"];

/** Known biomes plus every distinct biome already used across the library's tiles. */
export function collectUsedBiomes(tiles: TileDef[]): string[] {
  const biomes = new Set<string>(KNOWN_BIOMES);
  for (const tile of tiles) {
    if (tile.biome) biomes.add(tile.biome);
  }
  return [...biomes].sort((a, b) => a.localeCompare(b));
}
