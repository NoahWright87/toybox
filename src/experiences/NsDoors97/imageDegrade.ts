/**
 * imageDegrade.ts — browser-side "1997 quality" image degradation
 *
 * Mirrors the Node.js script in scripts/degrade-wallpapers.mjs so that
 * user-uploaded images get the same treatment as the built-in presets:
 *
 *   1. Downscale to ~31% with smooth interpolation
 *   2. Posterize each channel to 4 levels (colour banding)
 *   3. JPEG round-trip at quality 8% (block compression artifacts)
 *   4. Upscale back to original size with nearest-neighbour (chunky pixels)
 */

const DOWNSCALE_FACTOR = 0.31;
const POSTERIZE_LEVELS = 4;
const JPEG_QUALITY     = 0.08; // Canvas toDataURL uses 0–1

// ── Pixel-level posterize ─────────────────────────────────────────────────────

function posterizeData(data: Uint8ClampedArray, levels: number): void {
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.round(data[i]     / step) * step;
    data[i + 1] = Math.round(data[i + 1] / step) * step;
    data[i + 2] = Math.round(data[i + 2] / step) * step;
    // alpha [i+3] left untouched
  }
}

// ── Load a URL into an HTMLImageElement ───────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Degrades an image source URL to look like a 1997-era Windows wallpaper.
 * Returns a PNG data URL with the artifacts baked in.
 */
export async function degradeForWallpaper(src: string): Promise<string> {
  const img = await loadImage(src);
  const origW = img.naturalWidth  || img.width;
  const origH = img.naturalHeight || img.height;

  const downW = Math.max(Math.round(origW * DOWNSCALE_FACTOR), 16);
  const downH = Math.max(Math.round(origH * DOWNSCALE_FACTOR), 16);

  // ── Step 1: Downscale with smooth interpolation ───────────────────────────
  const small = document.createElement("canvas");
  small.width  = downW;
  small.height = downH;
  const smallCtx = small.getContext("2d")!;
  smallCtx.imageSmoothingEnabled = true;
  smallCtx.imageSmoothingQuality = "high";
  smallCtx.drawImage(img, 0, 0, downW, downH);

  // ── Step 2: Posterize — snap channels to POSTERIZE_LEVELS values ──────────
  const px = smallCtx.getImageData(0, 0, downW, downH);
  posterizeData(px.data, POSTERIZE_LEVELS);
  smallCtx.putImageData(px, 0, 0);

  // ── Step 3: JPEG round-trip — bakes in block-compression artifacts ────────
  const jpegDataUrl = small.toDataURL("image/jpeg", JPEG_QUALITY);
  const jpegImg = await loadImage(jpegDataUrl);

  // ── Step 4: Upscale with nearest-neighbour (chunky pixel blocks) ──────────
  const out = document.createElement("canvas");
  out.width  = origW;
  out.height = origH;
  const outCtx = out.getContext("2d")!;
  outCtx.imageSmoothingEnabled = false; // nearest-neighbour = no blurring
  outCtx.drawImage(jpegImg, 0, 0, origW, origH);

  return out.toDataURL("image/png");
}
