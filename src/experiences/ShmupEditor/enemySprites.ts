/**
 * Built-in enemy/bullet sprites (specs/shmup-editor.todo.md, E2 #192) —
 * mirrors tileImages.ts's structure exactly. The "skull" set (Mad-Max-style
 * vehicles, ChatGPT-generated, supplied directly by Noah — see
 * public/shmup-editor/enemies/README.md and
 * scripts/prepare-skull-sprites.mjs) is the idle-pose frame of each vehicle;
 * drop additional sprite PNGs into public/shmup-editor/enemies/ and add an
 * entry below (documenting source/SHA-256 in that folder's README.md per
 * root CLAUDE.md's dependency policy) to extend this list further — the
 * editor's picker, custom-upload flow, and fsStore persistence all already
 * support it.
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

export const BUILTIN_SPRITES: SpriteOption[] = [
  { id: NONE_SPRITE_ID, label: "None", url: null },
  { id: "skull-buggy", label: "Skull Buggy", url: "/shmup-editor/enemies/skull-buggy.png" },
  { id: "skull-technical", label: "Skull Technical", url: "/shmup-editor/enemies/skull-technical.png" },
  { id: "skull-motorcycle", label: "Skull Motorcycle", url: "/shmup-editor/enemies/skull-motorcycle.png" },
  { id: "skull-helicopter", label: "Skull Helicopter", url: "/shmup-editor/enemies/skull-helicopter.png" },
];

export function spriteById(id: string): SpriteOption {
  return BUILTIN_SPRITES.find((s) => s.id === id) ?? BUILTIN_SPRITES[0];
}

/** Resolves the actual image URL to render, accounting for a custom upload overriding the built-in set — same pattern as types.ts's resolveTileImageUrl. */
export function resolveSpriteUrl(spriteId: string, customSprite: string | null): string | null {
  if (spriteId === CUSTOM_SPRITE_ID) return customSprite;
  return spriteById(spriteId).url;
}
