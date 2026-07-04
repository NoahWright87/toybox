/**
 * Built-in tile background images (specs/shmup-editor.todo.md, E1 #191
 * follow-up) — a small fixed set of placeholder art for now. Real per-tile
 * art import/sketching is still future work. Each image is a whole 1x1
 * tile's art, scaled to fit its square (not a small repeating pattern) —
 * a footprint > 1 tile shows one full copy of the image per column.
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
  { id: "shore", label: "Shore (water→grass)", url: "/shmup-editor/tiles/shore.png" },
];

export function tileImageById(id: string): TileImageOption {
  return TILE_IMAGES.find((img) => img.id === id) ?? TILE_IMAGES[0];
}
