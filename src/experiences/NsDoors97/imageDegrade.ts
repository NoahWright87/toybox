/**
 * imageDegrade.ts — browser-side "1997 256-color" image degradation
 *
 * Produces images that look like they came from a Windows 95/98 machine
 * with an 8-bit "256 color" display:
 *
 *   1. Cap resolution to MAX_INPUT_DIM to avoid canvas memory failures
 *      on large uploads (phones, hi-res photos)
 *   2. Downscale to DOWNSCALE_FACTOR with bilinear interpolation
 *   3. Floyd-Steinberg dither to a 4-bit-per-channel palette
 *      (16 levels per channel, step ~17 — produces visible stippling on
 *       any smooth gradient)
 *   4. Nearest-neighbour upscale back to the (capped) original dimensions
 *
 * NOTE: the caller must set `imageRendering: pixelated` on the element that
 * displays the result; otherwise the browser bilinear-scales it back to
 * looking smooth.
 */

const DOWNSCALE_FACTOR = 0.35; // 35% → ~2.9× pixel blocks when upscaled
const BITS_PER_CHANNEL = 4;    // 16 levels per R/G/B — max error ~8.5 units
const MAX_INPUT_DIM    = 1024; // cap before processing to stay in memory

const LEVELS = 1 << BITS_PER_CHANNEL;  // 16
const STEP   = 255 / (LEVELS - 1);     // 17

function quantize(v: number): number {
  return Math.round(v / STEP) * STEP;
}

// ── Floyd-Steinberg dithering (in-place on Uint8ClampedArray) ─────────────────

function floydSteinberg(data: Uint8ClampedArray, width: number, height: number): void {
  const errR = new Float32Array(width * height);
  const errG = new Float32Array(width * height);
  const errB = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = (y * width + x) * 4;
      const ei =  y * width + x;

      const oldR = Math.max(0, Math.min(255, data[pi]     + errR[ei]));
      const oldG = Math.max(0, Math.min(255, data[pi + 1] + errG[ei]));
      const oldB = Math.max(0, Math.min(255, data[pi + 2] + errB[ei]));

      const newR = quantize(oldR);
      const newG = quantize(oldG);
      const newB = quantize(oldB);

      data[pi]     = newR;
      data[pi + 1] = newG;
      data[pi + 2] = newB;

      const dR = oldR - newR;
      const dG = oldG - newG;
      const dB = oldB - newB;

      //   right        7/16
      //   bottom-left  3/16
      //   bottom       5/16
      //   bottom-right 1/16
      if (x + 1 < width) {
        errR[ei + 1]         += dR * 7 / 16;
        errG[ei + 1]         += dG * 7 / 16;
        errB[ei + 1]         += dB * 7 / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          errR[ei + width - 1] += dR * 3 / 16;
          errG[ei + width - 1] += dG * 3 / 16;
          errB[ei + width - 1] += dB * 3 / 16;
        }
        errR[ei + width]       += dR * 5 / 16;
        errG[ei + width]       += dG * 5 / 16;
        errB[ei + width]       += dB * 5 / 16;
        if (x + 1 < width) {
          errR[ei + width + 1] += dR * 1 / 16;
          errG[ei + width + 1] += dG * 1 / 16;
          errB[ei + width + 1] += dB * 1 / 16;
        }
      }
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Degrades an image source URL to look like a 1997-era Windows 256-color
 * wallpaper. Returns a PNG data URL with the dithering baked in.
 *
 * The result must be displayed with `imageRendering: "pixelated"` so the
 * browser doesn't bilinear-scale away the dithering pattern.
 */
export async function degradeForWallpaper(src: string): Promise<string> {
  const img = await loadImage(src);

  // Step 0: cap resolution so canvas stays within mobile memory limits
  let origW = img.naturalWidth;
  let origH = img.naturalHeight;
  if (!origW || !origH) throw new Error("Could not read image dimensions");

  if (origW > MAX_INPUT_DIM || origH > MAX_INPUT_DIM) {
    const scale = Math.min(MAX_INPUT_DIM / origW, MAX_INPUT_DIM / origH);
    origW = Math.round(origW * scale);
    origH = Math.round(origH * scale);
  }

  const downW = Math.max(Math.round(origW * DOWNSCALE_FACTOR), 16);
  const downH = Math.max(Math.round(origH * DOWNSCALE_FACTOR), 16);

  // Step 1: downscale with smooth interpolation
  // Use the 5-arg drawImage form so the ENTIRE source image is scaled down,
  // not just the top-left origW×origH pixels of a larger image.
  const small = document.createElement("canvas");
  small.width  = downW;
  small.height = downH;
  const smallCtx = small.getContext("2d")!;
  smallCtx.imageSmoothingEnabled = true;
  smallCtx.imageSmoothingQuality = "high";
  smallCtx.drawImage(img, 0, 0, downW, downH);

  // Step 2: Floyd-Steinberg dither to 4-bit palette
  const px = smallCtx.getImageData(0, 0, downW, downH);
  floydSteinberg(px.data, downW, downH);
  smallCtx.putImageData(px, 0, 0);

  // Step 3: nearest-neighbour upscale (chunky pixel blocks, no blur)
  const out = document.createElement("canvas");
  out.width  = origW;
  out.height = origH;
  const outCtx = out.getContext("2d")!;
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(small, 0, 0, origW, origH);

  return out.toDataURL("image/png");
}
