/**
 * degrade-wallpapers.mjs
 *
 * Converts high-quality wallpaper images into "1997 High Color" versions:
 *
 *   1. Downscale to DOWNSCALE_FACTOR with bilinear interpolation
 *   2. Floyd-Steinberg dither to a 5-bit-per-channel palette
 *      (same 32-level quantisation used by the in-browser imageDegrade.ts)
 *   3. Nearest-neighbour upscale back to original dimensions
 *
 * No JPEG round-trip — the retro look comes from dithering, not blocking.
 *
 * Usage:
 *   node scripts/degrade-wallpapers.mjs
 */

import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const require   = createRequire(import.meta.url);
const Jimp      = require("jimp");

const __dirname     = dirname(fileURLToPath(import.meta.url));
const WALLPAPERS    = resolve(__dirname, "../src/experiences/NsDoors97/wallpapers");

// ── Parameters (keep in sync with imageDegrade.ts) ───────────────────────────

const DOWNSCALE_FACTOR = 0.5;  // 50% → 2×2 pixel blocks when upscaled
const BITS_PER_CHANNEL = 5;    // 32 levels per R/G/B — 16-bit "High Color"
const LEVELS           = 1 << BITS_PER_CHANNEL;         // 32
const STEP             = 255 / (LEVELS - 1);            // ~8.226

// ── Palette quantisation ──────────────────────────────────────────────────────

function quantize(v) {
  return Math.min(255, Math.round(v / STEP) * STEP);
}

// ── Floyd-Steinberg dithering on a jimp bitmap Buffer ────────────────────────

function floydSteinberg(bitmap, width, height) {
  const data = bitmap.data; // Buffer (Uint8-like, row-major RGBA)

  // Floating-point error accumulators
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

// ── Core pipeline ─────────────────────────────────────────────────────────────

async function degradeImage(inputPath, outputPath) {
  console.log(`\nProcessing: ${inputPath}`);
  const img   = await Jimp.read(inputPath);
  const origW = img.bitmap.width;
  const origH = img.bitmap.height;

  const downW = Math.max(Math.round(origW * DOWNSCALE_FACTOR), 16);
  const downH = Math.max(Math.round(origH * DOWNSCALE_FACTOR), 16);
  console.log(`  ${origW}×${origH}  →  downscale ${downW}×${downH}  →  upscale ${origW}×${origH}`);

  // Step 1: Downscale
  img.resize(downW, downH, Jimp.RESIZE_BILINEAR);

  // Step 2: Floyd-Steinberg dither
  floydSteinberg(img.bitmap, downW, downH);

  // Step 3: Nearest-neighbour upscale
  img.resize(origW, origH, Jimp.RESIZE_NEAREST_NEIGHBOR);

  await img.writeAsync(outputPath);
  console.log(`  → ${outputPath}`);
}

// ── Preset list ───────────────────────────────────────────────────────────────

const PRESETS = [
  { input: "sunset-original.png", output: "sunset-degraded.png" },
  { input: "arch-original.png",   output: "arch-degraded.png"   },
];

// ── Run ───────────────────────────────────────────────────────────────────────

(async () => {
  console.log("=== Wallpaper Degradation Script ===");
  console.log(`Downscale: ${DOWNSCALE_FACTOR * 100}%  |  Palette: ${BITS_PER_CHANNEL}-bit per channel (${LEVELS} levels)  |  Dithering: Floyd-Steinberg`);

  for (const { input, output } of PRESETS) {
    await degradeImage(resolve(WALLPAPERS, input), resolve(WALLPAPERS, output));
  }

  console.log("\nDone.");
})();
