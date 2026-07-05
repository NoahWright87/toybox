/**
 * prepare-skull-sprites.mjs
 *
 * One-time processing of the "skull" enemy sprite sheets (Mad-Max-style
 * vehicles, ChatGPT-generated, supplied directly by Noah — see
 * scripts/assets/skull-sprites-source/README.md) into the built-in enemy
 * sprites used by src/experiences/ShmupEditor/enemySprites.ts.
 *
 * Each source sheet is a 4x4 grid of frames: row 0 = idle, row 1 = moving,
 * row 2 = attacking, row 3 = dying (4 frames each). This script extracts
 * just the first idle frame per enemy for now (the built-in placement
 * sprite) — see specs/shmup-editor.todo.md for the deferred full-animation
 * preview work, which would reuse this same background-removal step
 * against the other 15 frames.
 *
 * The sheets don't have real alpha — the "transparency" checkerboard is
 * baked into opaque pixels (both checker shades are near-neutral gray:
 * ~238 and ~254). This script flood-fills real transparency in from the
 * cropped cell's border, trims to the remaining content's bounding box,
 * pads back out to a square, and downsizes to a manageable icon size.
 *
 * Usage:
 *   node scripts/prepare-skull-sprites.mjs
 */
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(__dirname, "assets/skull-sprites-source");
const OUT_DIR = resolve(__dirname, "../public/shmup-editor/enemies");

const GRID_SIZE = 4;
const IDLE_ROW = 0;
const IDLE_COL = 0;
const OUT_MAX_DIM = 256;
const TRIM_PADDING = 6; // px kept around the trimmed content on each side
const SQUARE_MARGIN = 10; // extra transparent px on each side of the square canvas

// A pixel counts as removable "checkerboard background" if it's close to
// neutral gray (R≈G≈B) AND light enough to be one of the two checker
// shades (~238/~254) or the anti-aliased blend between them and the art.
const GRAY_TOLERANCE = 6;
const LIGHTNESS_FLOOR = 195;

function isBackgroundColor(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min <= GRAY_TOLERANCE && max >= LIGHTNESS_FLOOR;
}

/** Iterative (non-recursive) 4-connected flood fill from every border pixel, zeroing alpha on every reached background-colored pixel. */
function floodFillTransparent(image) {
  const { width, height, data } = image.bitmap;
  const visited = new Uint8Array(width * height);
  const queue = [];

  function maybeEnqueue(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    const pi = i * 4;
    if (!isBackgroundColor(data[pi], data[pi + 1], data[pi + 2])) return;
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

/** Bounding box of pixels with any non-zero alpha, or null if the image is fully transparent. */
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

async function processOne(sheetPath, outName) {
  console.log(`\nProcessing ${sheetPath}`);
  const sheet = await Jimp.read(sheetPath);
  const cellW = sheet.bitmap.width / GRID_SIZE;
  const cellH = sheet.bitmap.height / GRID_SIZE;
  const x0 = Math.round(IDLE_COL * cellW);
  const y0 = Math.round(IDLE_ROW * cellH);
  const x1 = Math.round((IDLE_COL + 1) * cellW);
  const y1 = Math.round((IDLE_ROW + 1) * cellH);

  const cell = sheet.clone().crop(x0, y0, x1 - x0, y1 - y0);
  floodFillTransparent(cell);

  const box = contentBoundingBox(cell);
  if (!box) throw new Error(`${outName}: flood fill removed the entire cell — check thresholds`);

  const trimX = Math.max(0, box.minX - TRIM_PADDING);
  const trimY = Math.max(0, box.minY - TRIM_PADDING);
  const trimW = Math.min(cell.bitmap.width - trimX, box.maxX - box.minX + 1 + TRIM_PADDING * 2);
  const trimH = Math.min(cell.bitmap.height - trimY, box.maxY - box.minY + 1 + TRIM_PADDING * 2);
  const trimmed = cell.clone().crop(trimX, trimY, trimW, trimH);

  // Pad to a square (centered) so the icon scales/covers consistently in the editor's circular node + thumbnail UI.
  const side = Math.max(trimmed.bitmap.width, trimmed.bitmap.height) + SQUARE_MARGIN * 2;
  const square = new Jimp(side, side, 0x00000000);
  square.composite(trimmed, Math.round((side - trimmed.bitmap.width) / 2), Math.round((side - trimmed.bitmap.height) / 2));

  if (side > OUT_MAX_DIM) {
    square.resize(OUT_MAX_DIM, OUT_MAX_DIM, Jimp.RESIZE_BILINEAR);
  }

  const outPath = resolve(OUT_DIR, outName);
  await square.writeAsync(outPath);
  console.log(`  -> ${outPath} (${square.bitmap.width}x${square.bitmap.height})`);
}

const SPRITES = [
  { sheet: "skull-buggy-sheet.png", out: "skull-buggy.png" },
  { sheet: "skull-technical-sheet.png", out: "skull-technical.png" },
  { sheet: "skull-motorcycle-sheet.png", out: "skull-motorcycle.png" },
  { sheet: "skull-helicopter-sheet.png", out: "skull-helicopter.png" },
];

(async () => {
  console.log("=== Skull enemy sprite extraction ===");
  for (const { sheet, out } of SPRITES) {
    await processOne(resolve(SOURCE_DIR, sheet), out);
  }
  console.log("\nDone.");
})();
