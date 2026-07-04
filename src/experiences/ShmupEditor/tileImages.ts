/**
 * Built-in tile background images (specs/shmup-editor.todo.md, E1 #191
 * follow-up) — a small fixed set of placeholder textures for now. Real
 * per-tile art import/sketching is still future work; this replaces the
 * flat color swatch with something closer to what an actual tile will
 * look like, tiled to scale across the footprint.
 */
export interface TileImageOption {
  id: string;
  label: string;
  /** Public path — Vite serves everything under public/ from the site root. */
  url: string | null;
}

export const NONE_IMAGE_ID = "none";

export const TILE_IMAGES: TileImageOption[] = [
  { id: NONE_IMAGE_ID, label: "None", url: null },
  { id: "water", label: "Water", url: "/shmup-editor/tiles/water.png" },
  { id: "grass", label: "Grass", url: "/shmup-editor/tiles/grass.png" },
];

export function tileImageById(id: string): TileImageOption {
  return TILE_IMAGES.find((img) => img.id === id) ?? TILE_IMAGES[0];
}
