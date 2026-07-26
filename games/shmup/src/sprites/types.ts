/**
 * Sprite registry types — see specs/games/shmup/content-and-assets.spec.md.
 *
 * Code never draws a primitive or loads a file path directly; it asks the
 * registry for a sprite **key**, and the manifest (manifest.json) decides
 * whether that key currently means "colored placeholder" or "real PNG."
 */

/** Top-level asset folders under assets/sprites/. */
export type SpriteCategory = "ships" | "enemies" | "effects" | "projectiles";

/** Recommended fixed canvas size (px, square) per category for new art. */
export const CATEGORY_DEFAULT_SIZE: Record<SpriteCategory, number> = {
  projectiles: 32,
  ships: 64,
  enemies: 64,
  effects: 64,
};

export type PlaceholderShape = "rect" | "circle" | "triangle";

/** Default colored-primitive render, used until/unless real art exists for a key. */
export interface SpritePlaceholder {
  shape: PlaceholderShape;
  /** Hex color string, e.g. "#ff6b00". Color-codes the primitive by faction/type. */
  color: string;
  /** Optional stroke color, e.g. "#1a1a1a" — for a fill that reads as too low-contrast against a busy background on its own (e.g. the turret's grey against the ground tiles). */
  outline?: string;
}

export interface SpriteManifestEntry {
  category: SpriteCategory;
  /** Path relative to assets/sprites/, e.g. "ships/ship_player_idle_01.png". */
  path: string;
  frameWidth: number;
  frameHeight: number;
  /** Number of frames in the sheet at `path`. 1 = single static image. */
  frameCount: number;
  /** Milliseconds per frame, used once frameCount > 1. */
  frameDuration: number;
  placeholder: SpritePlaceholder;
}

export type SpriteManifest = Record<string, SpriteManifestEntry>;
