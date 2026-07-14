/**
 * prepare-parts-demo-sprites.mjs
 *
 * One-time processing of two "body + turret" reference sheets (ChatGPT-
 * generated, supplied directly by Noah — see
 * scripts/assets/parts-demo-sprites-source/README.md) into four separate
 * built-in sprites for testing the Shmup Editor's multi-Part Unit system
 * (specs/shmup-editor.todo.md's Parts/weapon-track pass): a vehicle body
 * and its independently-selectable turret, split apart so each can be
 * assigned to its own `UnitPart`.
 *
 * Unlike the skull sprite sheets (prepare-skull-sprites.mjs), these have a
 * **solid magenta background** (not a baked-in checkerboard), and each
 * sheet contains **two distinct objects side by side** (body, turret) that
 * need to become two separate output files, not one. Approach:
 *   1. Chroma-key the magenta out with a **global** per-pixel color test,
 *      not a border flood fill — the turret art has a closed ring shape
 *      whose interior is a magenta "lake" fully enclosed by opaque
 *      pixels, unreachable from the canvas edge. A flood fill (right
 *      choice for the skull sheets, where near-gray art pixels could
 *      false-positive against the checkerboard and needed connectivity to
 *      stay safe) would miss that lake entirely; a solid, saturated
 *      magenta never appears in either vehicle's actual paint, so a plain
 *      global color test is both simpler and correct here.
 *   2. Once the background is real transparency, find each disjoint
 *      opaque connected component (a flood fill, over alpha this time) —
 *      the body and turret are two separate components since a wide
 *      magenta gap always separates them with no opaque bridge.
 *   3. Sort components by size (body is always the larger one) and crop/
 *      trim/pad/resize each exactly like the skull script does.
 *
 * Usage:
 *   node scripts/prepare-parts-demo-sprites.mjs
 */
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(__dirname, "assets/parts-demo-sprites-source");
const OUT_DIR = resolve(__dirname, "../public/shmup-editor/enemies");

const OUT_MAX_DIM = 256;
const TRIM_PADDING = 6; // px kept around each trimmed component's content
const SQUARE_MARGIN = 10; // extra transparent px on each side of the square canvas

// The sheets' magenta isn't pure #FF00FF — sampled corners land around
// (252, 3, 251) — and anti-aliased edges blend it with the art underneath
// into much darker, less-saturated pinks/purples. Testing absolute R/B
// brightness only caught the solid fill, leaving a visible magenta fringe
// on every edge. Every vehicle color in these sheets (olive/gray/brown/
// black, even the blue-ish windshield glazing) has B as its *weakest*
// channel; magenta (full-strength or blended) always has G as the weakest
// channel by a wide margin, with both R and B clearly above it — a
// relative test rather than an absolute-brightness one, so it catches the
// blended fringe too without eating any real paint color.
function isMagenta(r, g, b) {
  return g < 100 && r - g > 40 && b - g > 40;
}

function keyOutMagenta(image) {
  const { data } = image.bitmap;
  for (let i = 0; i < data.length; i += 4) {
    if (isMagenta(data[i], data[i + 1], data[i + 2])) data[i + 3] = 0;
  }
}

/** Labels every 4-connected group of non-transparent pixels, returning each as a bounding box. */
function findOpaqueComponents(image) {
  const { width, height, data } = image.bitmap;
  const visited = new Uint8Array(width * height);
  const components = [];

  for (let start = 0; start < width * height; start++) {
    if (visited[start] || data[start * 4 + 3] === 0) continue;
    const queue = [start];
    visited[start] = 1;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    let pixelCount = 0;
    while (queue.length) {
      const i = queue.pop();
      const x = i % width;
      const y = Math.floor(i / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      pixelCount++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        if (visited[ni] || data[ni * 4 + 3] === 0) continue;
        visited[ni] = 1;
        queue.push(ni);
      }
    }
    // Drop stray specks (anti-aliasing crumbs, JPEG-adjacent noise) that aren't a real part of either shape.
    if (pixelCount > 50) components.push({ minX, minY, maxX, maxY, pixelCount });
  }
  return components;
}

async function cropTrimSquare(image, box) {
  const cropped = image.clone().crop(box.minX, box.minY, box.maxX - box.minX + 1, box.maxY - box.minY + 1);
  const side = Math.max(cropped.bitmap.width, cropped.bitmap.height) + TRIM_PADDING * 2 + SQUARE_MARGIN * 2;
  const square = new Jimp(side, side, 0x00000000);
  square.composite(cropped, Math.round((side - cropped.bitmap.width) / 2), Math.round((side - cropped.bitmap.height) / 2));
  if (side > OUT_MAX_DIM) {
    square.resize(OUT_MAX_DIM, OUT_MAX_DIM, Jimp.RESIZE_BILINEAR);
  }
  return square;
}

async function processOne(sheetPath, bodyOut, turretOut) {
  console.log(`\nProcessing ${sheetPath}`);
  const sheet = await Jimp.read(sheetPath);
  keyOutMagenta(sheet);

  const components = findOpaqueComponents(sheet);
  if (components.length < 2) {
    throw new Error(`${sheetPath}: expected 2 separate components (body + turret), found ${components.length} — check isMagenta thresholds`);
  }
  // Largest bounding-box area = body, next largest = turret; extras (if any) are dropped as noise.
  components.sort((a, b) => (b.maxX - b.minX) * (b.maxY - b.minY) - (a.maxX - a.minX) * (a.maxY - a.minY));
  const [bodyBox, turretBox] = components;

  const body = await cropTrimSquare(sheet, bodyBox);
  await body.writeAsync(resolve(OUT_DIR, bodyOut));
  console.log(`  -> ${bodyOut} (${body.bitmap.width}x${body.bitmap.height})`);

  const turret = await cropTrimSquare(sheet, turretBox);
  await turret.writeAsync(resolve(OUT_DIR, turretOut));
  console.log(`  -> ${turretOut} (${turret.bitmap.width}x${turret.bitmap.height})`);
}

const SHEETS = [
  { sheet: "armored-truck-sheet.png", body: "armored-truck-body.png", turret: "armored-truck-turret.png" },
  { sheet: "battle-tank-sheet.png", body: "battle-tank-body.png", turret: "battle-tank-turret.png" },
];

(async () => {
  console.log("=== Parts-demo sprite extraction ===");
  for (const { sheet, body, turret } of SHEETS) {
    await processOne(resolve(SOURCE_DIR, sheet), body, turret);
  }
  console.log("\nDone.");
})();
