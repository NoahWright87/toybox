/**
 * degrade-wallpapers.mjs
 *
 * Converts high-quality wallpaper images into "1997-quality" versions by:
 *   1. Downscaling to ~31% (160×90 for 512×286 sources)
 *   2. Posterizing to 4 levels per channel (creates strong colour banding)
 *   3. JPEG round-trip at quality 8 (creates 8×8 block compression artifacts)
 *   4. Upscaling back to original dimensions with nearest-neighbour
 *      (those JPEG 8×8 blocks now appear as chunky ~26×26 pixel blobs)
 *   5. Saving the result as PNG (artifacts baked in)
 *
 * Usage:
 *   node scripts/degrade-wallpapers.mjs
 *
 * Add new presets to the PRESETS array at the bottom of this file.
 */

import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const WALLPAPERS_DIR = resolve(__dirname, "../src/experiences/NsDoors97/wallpapers");

// ── Degradation parameters ────────────────────────────────────────────────────

const DOWNSCALE_FACTOR = 0.31;   // reduce to 31% before JPEG compression
const POSTERIZE_LEVELS = 4;       // colour levels per channel (4^3 = 64 colours max)
const JPEG_QUALITY     = 8;       // 8% — heavy blocking artifacts

// ── Core algorithm ────────────────────────────────────────────────────────────

async function degradeImage(inputPath, outputPath) {
  console.log(`\nProcessing: ${inputPath}`);

  const img = await Jimp.read(inputPath);
  const origW = img.bitmap.width;
  const origH = img.bitmap.height;

  const downW = Math.max(Math.round(origW * DOWNSCALE_FACTOR), 16);
  const downH = Math.max(Math.round(origH * DOWNSCALE_FACTOR), 16);

  console.log(`  Original: ${origW}×${origH}`);
  console.log(`  Downscale to: ${downW}×${downH} (${Math.round(DOWNSCALE_FACTOR * 100)}%)`);

  // Step 1: Downscale with bilinear interpolation
  img.resize(downW, downH, Jimp.RESIZE_BILINEAR);

  // Step 2: Posterize — snap each channel to POSTERIZE_LEVELS evenly-spaced values.
  //         Jimp's built-in posterize() quantises per-channel.
  img.posterize(POSTERIZE_LEVELS);

  // Step 3: JPEG round-trip — bakes in block-compression artifacts
  const jpegBuf = await img.quality(JPEG_QUALITY).getBufferAsync(Jimp.MIME_JPEG);
  console.log(`  JPEG buffer: ${(jpegBuf.length / 1024).toFixed(1)} KB at quality ${JPEG_QUALITY}`);

  // Step 4: Reload from JPEG buffer
  const degraded = await Jimp.read(jpegBuf);

  // Step 5: Upscale to original size with nearest-neighbour (chunky pixel blocks)
  degraded.resize(origW, origH, Jimp.RESIZE_NEAREST_NEIGHBOR);

  // Step 6: Save as PNG so the artifacts are permanently baked in
  await degraded.writeAsync(outputPath);
  console.log(`  → Saved: ${outputPath}`);
}

// ── Preset list ───────────────────────────────────────────────────────────────

const PRESETS = [
  { input: "sunset-original.png", output: "sunset-degraded.png" },
  { input: "arch-original.png",   output: "arch-degraded.png"   },
];

// ── Run ───────────────────────────────────────────────────────────────────────

(async () => {
  console.log("=== Wallpaper Degradation Script ===");
  console.log(`Settings: downscale ${Math.round(DOWNSCALE_FACTOR * 100)}%, posterize ${POSTERIZE_LEVELS} levels, JPEG quality ${JPEG_QUALITY}`);

  for (const { input, output } of PRESETS) {
    const inputPath  = resolve(WALLPAPERS_DIR, input);
    const outputPath = resolve(WALLPAPERS_DIR, output);
    await degradeImage(inputPath, outputPath);
  }

  console.log("\nDone.");
})();
