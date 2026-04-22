/**
 * imageDegrade.ts — browser-side "1997 high-color" image degradation
 *
 * Produces images that look like they came from a Windows 95/98 machine
 * with a 16-bit "High Color" display:
 *
 *   1. Downscale to DOWNSCALE_FACTOR with bilinear interpolation
 *   2. Floyd-Steinberg dither to a 5-bit-per-channel palette
 *      (32 levels × 3 channels ≈ 32 768 addressable colours, but colour
 *       transitions produce the characteristic stipple/speckle pattern)
 *   3. Nearest-neighbour upscale back to original dimensions
 *      (each downscaled pixel becomes a small block — subtle pixellation)
 */

const DOWNSCALE_FACTOR   = 0.5; // 50% → 2×2 pixel blocks when upscaled
const BITS_PER_CHANNEL   = 5;   // 32 levels per R/G/B — 16-bit "High Color"

// ── Palette quantisation ──────────────────────────────────────────────────────

const LEVELS = 1 << BITS_PER_CHANNEL;         // 32
const STEP   = 255 / (LEVELS - 1);            // ~8.226

function quantize(v: number): number {
  return Math.round(v / STEP) * STEP;
}

// ── Floyd-Steinberg dithering (in-place on Uint8ClampedArray) ─────────────────

function floydSteinberg(data: Uint8ClampedArray, width: number, height: number): void {
  // Floating-point error accumulators (separate from the clamped pixel data)
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

      // Distribute error to the four neighbours:
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

// ── Load a URL into an HTMLImageElement ───────────────────────────────────────

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
 * Degrades an image source URL to look like a 1997-era Windows wallpaper.
 * Returns a PNG data URL with the dithering baked in.
 */
export async function degradeForWallpaper(src: string): Promise<string> {
  const img  = await loadImage(src);
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

  // ── Step 2: Floyd-Steinberg dither to 5-bit palette ───────────────────────
  const px = smallCtx.getImageData(0, 0, downW, downH);
  floydSteinberg(px.data, downW, downH);
  smallCtx.putImageData(px, 0, 0);

  // ── Step 3: Nearest-neighbour upscale (pixellated, no blur) ──────────────
  const out = document.createElement("canvas");
  out.width  = origW;
  out.height = origH;
  const outCtx = out.getContext("2d")!;
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(small, 0, 0, origW, origH);

  return out.toDataURL("image/png");
}
