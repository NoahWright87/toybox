/**
 * Built-in enemy/bullet sprites (specs/shmup-editor.todo.md, E2 #192) —
 * mirrors tileImages.ts's structure exactly. Starts with just "None": no
 * placeholder art has been supplied yet (unlike tiles/water.png etc., which
 * Noah supplied directly — see public/shmup-editor/tiles/README.md). Drop
 * additional sprite PNGs into public/shmup-editor/enemies/ and add an entry
 * below (documenting source/SHA-256 in that folder's README.md per root
 * CLAUDE.md's dependency policy) to extend this list — the editor's picker,
 * custom-upload flow, and fsStore persistence all already support it.
 *
 * Unlike a tile image (a full opaque square), a sprite is expected to have
 * a transparent surround — see imageUpload.ts's loadSpriteImageFile, which
 * contain-fits an upload instead of cover-cropping it for exactly this
 * reason.
 */
export interface SpriteOption {
  id: string;
  label: string;
  /** Public path — Vite serves everything under public/ from the site root. */
  url: string | null;
}

export const NONE_SPRITE_ID = "none";

/** spriteId value meaning "use this enemy/bullet's own `customSprite` upload instead of a built-in". */
export const CUSTOM_SPRITE_ID = "custom";

export const BUILTIN_SPRITES: SpriteOption[] = [{ id: NONE_SPRITE_ID, label: "None", url: null }];

export function spriteById(id: string): SpriteOption {
  return BUILTIN_SPRITES.find((s) => s.id === id) ?? BUILTIN_SPRITES[0];
}

/** Resolves the actual image URL to render, accounting for a custom upload overriding the built-in set — same pattern as types.ts's resolveTileImageUrl. */
export function resolveSpriteUrl(spriteId: string, customSprite: string | null): string | null {
  if (spriteId === CUSTOM_SPRITE_ID) return customSprite;
  return spriteById(spriteId).url;
}
