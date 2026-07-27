/**
 * prepare-projectiles.mjs
 *
 * One-time processing of the projectile art batch (Noah-supplied, see
 * scripts/assets/projectiles-source/README.md) into built-in sprites for
 * src/experiences/ShmupEditor/enemySprites.ts — a projectile is just a
 * sprite on a Unit like any other (see that file's header comment), so
 * these live in `public/shmup-editor/projectiles/` but register in the
 * same BUILTIN_SPRITES list.
 *
 * `projectiles.png` is a 73-icon contact sheet (7 rows of 9-12 icons,
 * magenta chroma-keyed) — this script extracts a curated 20-icon subset
 * spanning the sheet's visual variety (small-arms bullets, rockets, bombs/
 * mines, fire/energy orbs, sci-fi canisters) rather than all 73, so the
 * Unit picker gets a useful, distinct set instead of a wall of near-
 * duplicates. Cell bounding boxes below were found via a one-off
 * connected-component/column-band scan during authoring (not checked in).
 *
 * The batch also included a standalone `projectile-basic.png` — byte-
 * identical to the already-processed `bullet-basic-source.png` (same
 * ChatGPT-generated glow sprite, see enemies/README.md) — so it's dropped
 * rather than reprocessed into a duplicate built-in sprite.
 *
 * Usage:
 *   node scripts/prepare-projectiles.mjs
 */
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(__dirname, "assets/projectiles-source");
const OUT_DIR = resolve(__dirname, "../public/shmup-editor/projectiles");

const OUT_MAX_DIM = 160;
const TRIM_PADDING = 4;
const SQUARE_MARGIN = 8;
const CROP_PADDING = 10;
const COLOR_TOLERANCE = 40;

function colorClose(r, g, b, ref) {
  return Math.abs(r - ref.r) <= COLOR_TOLERANCE && Math.abs(g - ref.g) <= COLOR_TOLERANCE && Math.abs(b - ref.b) <= COLOR_TOLERANCE;
}

function floodFillTransparent(image, ref) {
  const { width, height, data } = image.bitmap;
  const visited = new Uint8Array(width * height);
  const queue = [];
  function maybeEnqueue(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    const pi = i * 4;
    if (!colorClose(data[pi], data[pi + 1], data[pi + 2], ref)) return;
    visited[i] = 1;
    queue.push(i);
  }
  for (let x = 0; x < width; x++) {
    maybeEnqueue(x, 0);
    maybeEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    maybeEnqueue(0, y);
    maybeEnqueue(width - 1, y);
  }
  while (queue.length) {
    const i = queue.pop();
    const x = i % width;
    const y = Math.floor(i / width);
    data[i * 4 + 3] = 0;
    maybeEnqueue(x + 1, y);
    maybeEnqueue(x - 1, y);
    maybeEnqueue(x, y + 1);
    maybeEnqueue(x, y - 1);
  }
}

function isChromaMagenta(r, g, b) {
  return r > 150 && b > 150 && g < 100 && Math.abs(r - b) < 60;
}

function clearEnclosedMagenta(image) {
  const { width, height, data } = image.bitmap;
  for (let i = 0; i < width * height; i++) {
    const pi = i * 4;
    if (data[pi + 3] > 0 && isChromaMagenta(data[pi], data[pi + 1], data[pi + 2])) {
      data[pi + 3] = 0;
    }
  }
}

function contentBoundingBox(image) {
  const { width, height, data } = image.bitmap;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

async function finishSprite(cell, label) {
  const ref = Jimp.intToRGBA(cell.getPixelColor(1, 1));
  floodFillTransparent(cell, ref);
  clearEnclosedMagenta(cell);

  const box = contentBoundingBox(cell);
  if (!box) throw new Error(`${label}: flood fill removed the entire image — check thresholds`);

  const trimX = Math.max(0, box.minX - TRIM_PADDING);
  const trimY = Math.max(0, box.minY - TRIM_PADDING);
  const trimW = Math.min(cell.bitmap.width - trimX, box.maxX - box.minX + 1 + TRIM_PADDING * 2);
  const trimH = Math.min(cell.bitmap.height - trimY, box.maxY - box.minY + 1 + TRIM_PADDING * 2);
  const trimmed = cell.clone().crop(trimX, trimY, trimW, trimH);

  const side = Math.max(trimmed.bitmap.width, trimmed.bitmap.height) + SQUARE_MARGIN * 2;
  const square = new Jimp(side, side, 0x00000000);
  square.composite(trimmed, Math.round((side - trimmed.bitmap.width) / 2), Math.round((side - trimmed.bitmap.height) / 2));

  if (side > OUT_MAX_DIM) {
    square.resize(OUT_MAX_DIM, OUT_MAX_DIM, Jimp.RESIZE_BILINEAR);
  }
  return square;
}

// [x0,y0,x1,y1] bounding boxes on the 1254x1254 sheet, picked to cover the
// sheet's visual range: small-arms bullets, rockets, bombs/mines, fire/
// energy orbs, and sci-fi canisters.
const SHEET_CELLS = [
  { name: "bullet-tiny", box: [54, 34, 80, 187] },
  { name: "bullet-red-tip", box: [355, 34, 382, 187] },
  { name: "bullet-tracer", box: [656, 34, 684, 187] },
  { name: "shell-heavy", box: [949, 34, 1003, 187] },
  { name: "rocket-red", box: [139, 241, 187, 389] },
  { name: "rocket-gold", box: [842, 241, 905, 389] },
  { name: "missile-static", box: [242, 422, 305, 547] },
  { name: "poison-flask", box: [561, 422, 622, 547] },
  { name: "mine-spiked-ball", box: [1137, 422, 1225, 547] },
  { name: "cluster-shell", box: [193, 595, 274, 747] },
  { name: "mine-morning-star", box: [927, 595, 1060, 747] },
  { name: "bullet-copper", box: [284, 776, 328, 897] },
  { name: "fire-orb", box: [742, 776, 794, 897] },
  { name: "starburst", box: [1127, 776, 1196, 897] },
  { name: "energy-orb-blue", box: [160, 921, 233, 1041] },
  { name: "lightning-bolt", box: [458, 921, 504, 1041] },
  { name: "crystal-burst-green", box: [858, 921, 949, 1041] },
  { name: "orb-capsule-purple", box: [41, 1066, 113, 1214] },
  { name: "toxic-canister", box: [455, 1066, 540, 1214] },
  { name: "energy-canister-blue", box: [990, 1066, 1075, 1214] },
];

async function processSheetCells() {
  const sheetPath = resolve(SOURCE_DIR, "projectiles-sheet.png");
  const sheet = await Jimp.read(sheetPath);
  for (const { name, box } of SHEET_CELLS) {
    const [bx0, by0, bx1, by1] = box;
    const x0 = Math.max(0, bx0 - CROP_PADDING);
    const y0 = Math.max(0, by0 - CROP_PADDING);
    const x1 = Math.min(sheet.bitmap.width, bx1 + CROP_PADDING);
    const y1 = Math.min(sheet.bitmap.height, by1 + CROP_PADDING);
    const cell = sheet.clone().crop(x0, y0, x1 - x0, y1 - y0);
    const square = await finishSprite(cell, name);
    const outPath = resolve(OUT_DIR, `${name}.png`);
    await square.writeAsync(outPath);
    console.log(`  -> ${outPath} (${square.bitmap.width}x${square.bitmap.height})`);
  }
}

(async () => {
  console.log("=== Curated projectile sheet cells ===");
  await processSheetCells();
  console.log("\nDone.");
})();
