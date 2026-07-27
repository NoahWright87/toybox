/**
 * prepare-incoming-enemies.mjs
 *
 * One-time processing of the "incoming" enemy sprite batch (Noah-supplied,
 * see scripts/assets/incoming-enemies-source/README.md) into the built-in
 * sprites used by src/experiences/ShmupEditor/enemySprites.ts. Mirrors
 * prepare-parts-demo-sprites.mjs's approach (chroma-key background
 * removal, trim to content, pad to square, downsize) but generalizes the
 * background color instead of hardcoding a fixed magenta — this batch
 * mixes magenta-keyed sheets with one near-white-keyed single sprite
 * (heli.png), so the reference color is sampled from each source image's
 * own corner pixel.
 *
 * Three sheets (battleship, missile-truck, train-gun-car) bundle a body
 * plus several turret variants on one canvas — only one representative
 * turret is extracted from each (the rest of the sheet is unused). These
 * three become multi-part enemies (their own subfolder under
 * public/shmup-editor/enemies/), consistent with the armored-truck/
 * battle-tank Parts-demo precedent.
 *
 * Usage:
 *   node scripts/prepare-incoming-enemies.mjs
 */
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(__dirname, "assets/incoming-enemies-source");
const OUT_DIR = resolve(__dirname, "../public/shmup-editor/enemies");

const OUT_MAX_DIM = 256;
const TRIM_PADDING = 6;
const SQUARE_MARGIN = 10;
const CROP_PADDING = 20; // extra margin kept around a sub-region crop before background removal

const COLOR_TOLERANCE = 40;

function colorClose(r, g, b, ref) {
  return Math.abs(r - ref.r) <= COLOR_TOLERANCE && Math.abs(g - ref.g) <= COLOR_TOLERANCE && Math.abs(b - ref.b) <= COLOR_TOLERANCE;
}

/** Iterative 4-connected flood fill from every border pixel, zeroing alpha on every reached background-colored pixel. */
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

/**
 * A second, connectivity-independent cleanup pass for chroma-keyed magenta
 * sheets: border flood fill alone can't reach a pocket of background color
 * fully enclosed by opaque art (e.g. the gap between a motorcycle's frame
 * and its sidecar in motorcycle-sidecar.png). The magenta key used across
 * this batch is a deliberately unnatural, highly saturated hue no
 * legitimate vehicle-art pixel matches, so it's safe to strip anywhere in
 * the image regardless of whether it touches the border. Harmless no-op on
 * heli.png (white-keyed, not magenta).
 */
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

/** Processes an already-cropped Jimp image in place: bg removal, trim, square pad, resize. Returns the final Jimp image. */
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

async function processSingle(sheetName, outRelPath) {
  const sheetPath = resolve(SOURCE_DIR, `${sheetName}.png`);
  console.log(`\nProcessing ${sheetPath}`);
  const sheet = await Jimp.read(sheetPath);
  const square = await finishSprite(sheet, sheetName);
  const outPath = resolve(OUT_DIR, outRelPath);
  await square.writeAsync(outPath);
  console.log(`  -> ${outPath} (${square.bitmap.width}x${square.bitmap.height})`);
}

/** Crops a bounding box (+padding) out of a sheet, then finishes it as its own sprite. */
async function processCrop(sheetName, bbox, outRelPath) {
  const sheetPath = resolve(SOURCE_DIR, `${sheetName}.png`);
  const sheet = await Jimp.read(sheetPath);
  const x0 = Math.max(0, bbox.minX - CROP_PADDING);
  const y0 = Math.max(0, bbox.minY - CROP_PADDING);
  const x1 = Math.min(sheet.bitmap.width, bbox.maxX + CROP_PADDING);
  const y1 = Math.min(sheet.bitmap.height, bbox.maxY + CROP_PADDING);
  const cell = sheet.clone().crop(x0, y0, x1 - x0, y1 - y0);
  const square = await finishSprite(cell, `${sheetName}:${outRelPath}`);
  const outPath = resolve(OUT_DIR, outRelPath);
  await square.writeAsync(outPath);
  console.log(`  -> ${outPath} (${square.bitmap.width}x${square.bitmap.height})`);
}

// Bounding boxes found via connected-component analysis of each sheet
// (see scripts/_tmp_components.mjs used during authoring — not checked in).
const SPLIT_SHEETS = [
  {
    sheet: "battleship-sheet",
    body: { minX: 131, minY: 10, maxX: 490, maxY: 1243 },
    turret: { minX: 928, minY: 135, maxX: 1144, maxY: 406 },
    outDir: "battleship",
    bodyName: "hull",
    turretName: "turret",
  },
  {
    sheet: "missile-truck-sheet",
    body: { minX: 118, minY: 69, maxX: 576, maxY: 1175 },
    turret: { minX: 713, minY: 356, maxX: 1142, maxY: 957 },
    outDir: "missile-truck",
    bodyName: "body",
    turretName: "turret",
  },
  {
    sheet: "train-gun-car-sheet",
    body: { minX: 61, minY: 25, maxX: 554, maxY: 1219 },
    turret: { minX: 668, minY: 123, maxX: 897, maxY: 458 },
    outDir: "train",
    bodyName: "gun-car-body",
    turretName: "gun-car-turret",
  },
];

const SINGLE_SPRITES = [
  { sheet: "heli", out: "heli.png" },
  { sheet: "heli-transport", out: "heli-transport.png" },
  { sheet: "jet-bomber", out: "jet-bomber.png" },
  { sheet: "jet-fighter", out: "jet-fighter.png" },
  { sheet: "jet-stealth", out: "jet-stealth.png" },
  { sheet: "motorcycle-sidecar", out: "motorcycle-sidecar.png" },
  { sheet: "plane-prop", out: "plane-prop.png" },
  { sheet: "truck-transport", out: "truck-transport.png" },
  { sheet: "turret", out: "turret.png" },
  { sheet: "turret-4x", out: "turret-4x.png" },
  { sheet: "train-front", out: "train/front.png" },
  { sheet: "train-rear", out: "train/rear.png" },
];

(async () => {
  console.log("=== Split (body + turret) sheets ===");
  for (const s of SPLIT_SHEETS) {
    await processCrop(s.sheet, s.body, `${s.outDir}/${s.bodyName}.png`);
    await processCrop(s.sheet, s.turret, `${s.outDir}/${s.turretName}.png`);
  }

  console.log("\n=== Single sprites ===");
  for (const { sheet, out } of SINGLE_SPRITES) {
    await processSingle(sheet, out);
  }

  console.log("\nDone.");
})();
