/**
 * Sprite registry — public surface. See README.md in this directory for the
 * full convention guide (folder structure, naming, sizes, manifest schema,
 * FS overrides) and specs/games/shmup/content-and-assets.spec.md for the
 * design rationale.
 *
 * Scenes never call `generateTexture`/`load.image` with a hardcoded path or
 * draw a primitive inline — they call `preloadSprites`/`ensurePlaceholderTextures`
 * once and then reference sprites by key, exactly like any other Phaser
 * texture key.
 */
export type { SpriteKey } from "./registry";
export type {
  SpriteCategory,
  SpriteManifest,
  SpriteManifestEntry,
  SpritePlaceholder,
  PlaceholderShape,
} from "./types";
export { CATEGORY_DEFAULT_SIZE } from "./types";
export {
  SPRITE_MANIFEST,
  spriteKeys,
  spriteDef,
  preloadSprites,
  ensurePlaceholderTextures,
} from "./registry";
export { SHMUP_SPRITES_FS_DIR, spriteOverridePath } from "./fsOverride";
export { bakeGroundTexture } from "./groundBackground";
