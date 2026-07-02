import Phaser from "phaser";

/** The manifest key the ground-tile mosaic is baked from (manifest.json's 16-frame "bgGround" sheet). */
const GROUND_TILE_KEY = "bgGround";

/**
 * Bakes a `gridSize x gridSize` mosaic of randomly-picked frames from the
 * ground tile sheet into a single `CanvasTexture` keyed `outKey`, sized
 * `tileSizePx * gridSize` square — used as a normal `TileSprite` texture the
 * same way the starfield background (`bgSpace`) already is, so the existing
 * scroll code needs no changes.
 *
 * A `RenderTexture`'s `saveTexture()` produces a `DynamicTexture`, which
 * Phaser's `TileSprite` explicitly refuses ("TileSprite cannot use Dynamic
 * Texture") — so this draws directly onto a 2D canvas via
 * `TextureManager.createCanvas` instead, using each source frame's `cutX/Y/
 * Width/Height` rect on its underlying image.
 *
 * Falls back to repeating the single placeholder frame when the real
 * spritesheet hasn't loaded (`ensurePlaceholderTextures` only ever generates
 * one static frame per key) — same "gameplay never blocks on art" contract
 * as every other sprite, just applied to a baked composite instead of a
 * single image.
 *
 * Safe to call again (e.g. on `scene.restart()`) — replaces any
 * previously-baked texture at `outKey` rather than erroring on a duplicate key.
 */
export function bakeGroundTexture(
  scene: Phaser.Scene,
  outKey: string,
  tileSizePx: number,
  gridSize: number,
  rng: () => number = Math.random
): void {
  if (scene.textures.exists(outKey)) scene.textures.remove(outKey);
  const sourceTexture = scene.textures.get(GROUND_TILE_KEY);
  const frameNames = sourceTexture.getFrameNames();
  const size = tileSizePx * gridSize;
  const canvasTexture = scene.textures.createCanvas(outKey, size, size);
  if (!canvasTexture) return; // Texture manager refused the key (shouldn't happen — we just removed it above).
  const ctx = canvasTexture.getContext();
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const frameName = frameNames.length > 0 ? frameNames[Math.floor(rng() * frameNames.length)] : undefined;
      const frame = sourceTexture.get(frameName);
      ctx.drawImage(
        frame.source.image as CanvasImageSource,
        frame.cutX,
        frame.cutY,
        frame.cutWidth,
        frame.cutHeight,
        col * tileSizePx,
        row * tileSizePx,
        tileSizePx,
        tileSizePx
      );
    }
  }
  canvasTexture.refresh();
}
