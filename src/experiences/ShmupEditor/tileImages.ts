/**
 * Built-in tile background images (specs/shmup-editor.todo.md, E1 #191
 * follow-up) — a small fixed set of placeholder art for now. Real per-tile
 * art import/sketching is still future work. Each image is a whole 1x1
 * tile's art, scaled to fit its square (not a small repeating pattern) —
 * a footprint > 1 tile shows one full copy of the image per column.
 *
 * **The game mirrors this table** in
 * `games/shmup/src/sprites/editorArt.ts`, so an authored tile's background
 * renders in the real engine. Add an image here and add it there too. See
 * enemySprites.ts's matching note.
 */
export interface TileImageOption {
  id: string;
  label: string;
  /** Public path — Vite serves everything under public/ from the site root. */
  url: string | null;
}

export const NONE_IMAGE_ID = "none";

/** imageId value meaning "use this tile's own `customImage` upload instead of a built-in". */
export const CUSTOM_IMAGE_ID = "custom";

export const TILE_IMAGES: TileImageOption[] = [
  { id: NONE_IMAGE_ID, label: "None", url: null },
  // Plain biomes
  { id: "water", label: "Water", url: "/shmup-editor/tiles/water.png" },
  { id: "grass", label: "Grass", url: "/shmup-editor/tiles/grass.png" },
  { id: "sand", label: "Sand", url: "/shmup-editor/tiles/sand.png" },
  { id: "swamp", label: "Swamp", url: "/shmup-editor/tiles/swamp.png" },
  { id: "lava", label: "Lava", url: "/shmup-editor/tiles/lava.png" },
  { id: "rocky", label: "Rocky", url: "/shmup-editor/tiles/rocky.png" },
  { id: "concrete", label: "Concrete", url: "/shmup-editor/tiles/concrete.png" },
  { id: "forest", label: "Forest", url: "/shmup-editor/tiles/forest.png" },
  // Horizontal (north/south) biome transitions
  { id: "grass-water", label: "Grass → Water", url: "/shmup-editor/tiles/grass-water.png" },
  // Labelled for what the art actually shows — rocky scrubland over grass, not
  // sand. The id keeps its original `grass-sand` spelling on purpose: it is a
  // stored reference on every tile saved against it, and renaming it would
  // blank their art. See types.ts's "Grass / Rocky" seed entry.
  { id: "grass-sand", label: "Grass → Rocky", url: "/shmup-editor/tiles/grass-sand.png" },
  { id: "grass-sand-natural", label: "Grass → Sand (natural)", url: "/shmup-editor/tiles/grass-sand-natural.png" },
  { id: "grass-swamp", label: "Grass → Swamp", url: "/shmup-editor/tiles/grass-swamp.png" },
  { id: "sand-rocky", label: "Sand → Rocky", url: "/shmup-editor/tiles/sand-rocky.png" },
  { id: "sand-water-natural", label: "Sand → Water", url: "/shmup-editor/tiles/sand-water-natural.png" },
  { id: "sand-concrete", label: "Sand → Concrete", url: "/shmup-editor/tiles/sand-concrete.png" },
  { id: "sand-concrete-wall", label: "Sand → Concrete (gate)", url: "/shmup-editor/tiles/sand-concrete-wall.png" },
  { id: "concrete-water", label: "Concrete → Water", url: "/shmup-editor/tiles/concrete-water.png" },
  { id: "concrete-water-wall", label: "Concrete → Water (pier)", url: "/shmup-editor/tiles/concrete-water-wall.png" },
  { id: "concrete-lava", label: "Concrete → Lava", url: "/shmup-editor/tiles/concrete-lava.png" },
  { id: "concrete-lava-wall", label: "Concrete → Lava (barrier)", url: "/shmup-editor/tiles/concrete-lava-wall.png" },
  { id: "forest-water", label: "Forest → Water", url: "/shmup-editor/tiles/forest-water.png" },
  // Vertical (east/west) biome transition
  { id: "grass-forest", label: "Forest → Grass", url: "/shmup-editor/tiles/grass-forest.png" },
  // Diagonal corner
  { id: "grass-water-diag", label: "Water/Grass Corner", url: "/shmup-editor/tiles/grass-water-diag.png" },
  // Road (grass biome, road tag north/south)
  { id: "grass-road-straight", label: "Road (straight)", url: "/shmup-editor/tiles/grass-road-straight.png" },
  { id: "grass-road-curve", label: "Road (curve)", url: "/shmup-editor/tiles/grass-road-curve.png" },
  { id: "grass-road-start", label: "Road (trailhead)", url: "/shmup-editor/tiles/grass-road-start.png" },
  { id: "grass-road-concrete", label: "Road → Concrete (gate)", url: "/shmup-editor/tiles/grass-road-concrete.png" },
];

export function tileImageById(id: string): TileImageOption {
  return TILE_IMAGES.find((img) => img.id === id) ?? TILE_IMAGES[0];
}
