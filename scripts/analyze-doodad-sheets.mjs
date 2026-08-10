/**
 * analyze-doodad-sheets.mjs — authoring aid, not part of any build.
 *
 * Reports the sprite bounding boxes prepare-doodads.mjs would extract from
 * each magenta-keyed contact sheet in scripts/assets/doodads-source/, and
 * writes a debug PNG per sheet with every detected box outlined so the
 * row/column-gap thresholds can be eyeballed before committing to names.
 *
 * Usage:
 *   node scripts/analyze-doodad-sheets.mjs
 */
import { createRequire } from "module";
import { readdirSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(__dirname, "assets/doodads-source");
const DEBUG_DIR = resolve(__dirname, "assets/doodads-source/debug");

import { mkdirSync } from "fs";

import { findSpriteBoxes, buildMask } from "./doodadSegment.mjs";

/** Sheets whose spacing needs a non-default gap — see doodadSegment.mjs's DEFAULT_MIN_GAP. */
const MIN_GAP_OVERRIDES = { "rooftops.png": 20 };

mkdirSync(DEBUG_DIR, { recursive: true });

for (const file of readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".png"))) {
  const image = await Jimp.read(resolve(SOURCE_DIR, file));
  const { width, height } = image.bitmap;
  const mask = buildMask(image);
  const boxes = findSpriteBoxes(mask, width, height, MIN_GAP_OVERRIDES[file]);
  console.log(`\n${file} — ${width}x${height} — ${boxes.length} sprites`);
  boxes.forEach((b, i) => {
    console.log(`  [${String(i).padStart(2)}] x=${b.x} y=${b.y} w=${b.w} h=${b.h}`);
  });

  // Debug overlay: red outline per detected box, over the keyed sprite.
  const debug = image.clone();
  const RED = Jimp.rgbaToInt(255, 0, 0, 255);
  for (const b of boxes) {
    for (let x = b.x; x < b.x + b.w; x++) {
      for (const y of [b.y, b.y + b.h - 1]) {
        if (y >= 0 && y < height) debug.setPixelColor(RED, x, y);
      }
    }
    for (let y = b.y; y < b.y + b.h; y++) {
      for (const x of [b.x, b.x + b.w - 1]) {
        if (x >= 0 && x < width) debug.setPixelColor(RED, x, y);
      }
    }
  }
  await debug.scale(0.5).writeAsync(resolve(DEBUG_DIR, `${basename(file, ".png")}-boxes.png`));
}
