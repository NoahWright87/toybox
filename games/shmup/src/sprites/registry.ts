import Phaser from "phaser";
import manifestJson from "./manifest.json";
import type { SpriteManifestEntry } from "./types";
import { resolveSpriteUrl } from "./assetSource";
import { drawPlaceholder } from "./placeholders";

/** Every sprite key declared in manifest.json. Code references these, never a raw string. */
export type SpriteKey = keyof typeof manifestJson;

export const SPRITE_MANIFEST = manifestJson as Record<SpriteKey, SpriteManifestEntry>;

export function spriteKeys(): SpriteKey[] {
  return Object.keys(SPRITE_MANIFEST) as SpriteKey[];
}

export function spriteDef(key: SpriteKey): SpriteManifestEntry {
  return SPRITE_MANIFEST[key];
}

/**
 * Queues every manifest sprite that currently has real art (bundled or
 * FS-overridden) for loading. Call once from a scene's `preload()`.
 * Sprites with no art on disk yet are skipped here — they get a placeholder
 * texture in `ensurePlaceholderTextures` instead.
 */
export function preloadSprites(scene: Phaser.Scene): void {
  for (const key of spriteKeys()) {
    const def = SPRITE_MANIFEST[key];
    const url = resolveSpriteUrl(def.path);
    if (!url) continue;
    if (def.frameCount > 1) {
      scene.load.spritesheet(key, url, {
        frameWidth: def.frameWidth,
        frameHeight: def.frameHeight,
      });
    } else {
      scene.load.image(key, url);
    }
  }
}

/**
 * Generates a colored-primitive texture for any sprite key that didn't load
 * real art in `preloadSprites`. Call from `create()`, after the preload
 * queue has run. Idempotent — re-running on a scene restart is a no-op for
 * keys that already have a texture (real or placeholder).
 */
export function ensurePlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  for (const key of spriteKeys()) {
    if (scene.textures.exists(key)) continue;
    const def = SPRITE_MANIFEST[key];
    drawPlaceholder(g, def);
    g.generateTexture(key, def.frameWidth, def.frameHeight);
    g.clear();
  }
  g.destroy();
}
