/**
 * prepare-bullet-sprite.mjs
 *
 * Processes the generic bullet glow sprite (ChatGPT-generated, supplied
 * directly by Noah — see scripts/assets/bullet-basic-source.png) into the
 * built-in sprite used to seed the default "Bullet" Unit
 * (unitTypes.ts's `createDefaultBulletUnit`). Same magenta chroma-key +
 * trim/pad/resize pipeline as prepare-parts-demo-sprites.mjs (see that
 * script's header for why a global color test beats a border flood fill
 * here) — just a single object, no connected-component split needed.
 *
 * Usage:
 *   node scripts/prepare-bullet-sprite.mjs
 */
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(__dirname, "assets/bullet-basic-source.png");
const OUT = resolve(__dirname, "../public/shmup-editor/enemies/bullet-basic.png");

const OUT_MAX_DIM = 128; // a bullet is a small icon, not a full enemy sprite
const TRIM_PADDING = 4;
const SQUARE_MARGIN = 6;

function isMagenta(r, g, b) {
  return g < 100 && r - g > 40 && b - g > 40;
}

function keyOutMagenta(image) {
  const { data } = image.bitmap;
  for (let i = 0; i < data.length; i += 4) {
    if (isMagenta(data[i], data[i + 1], data[i + 2])) data[i + 3] = 0;
  }
}

function contentBoundingBox(image) {
  const { width, height, data } = image.bitmap;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
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

(async () => {
  console.log(`Processing ${SOURCE}`);
  const image = await Jimp.read(SOURCE);
  keyOutMagenta(image);

  const box = contentBoundingBox(image);
  if (!box) throw new Error("bullet sprite: chroma-key removed the entire image — check isMagenta thresholds");

  const trimX = Math.max(0, box.minX - TRIM_PADDING);
  const trimY = Math.max(0, box.minY - TRIM_PADDING);
  const trimW = Math.min(image.bitmap.width - trimX, box.maxX - box.minX + 1 + TRIM_PADDING * 2);
  const trimH = Math.min(image.bitmap.height - trimY, box.maxY - box.minY + 1 + TRIM_PADDING * 2);
  const trimmed = image.clone().crop(trimX, trimY, trimW, trimH);

  const side = Math.max(trimmed.bitmap.width, trimmed.bitmap.height) + SQUARE_MARGIN * 2;
  const square = new Jimp(side, side, 0x00000000);
  square.composite(trimmed, Math.round((side - trimmed.bitmap.width) / 2), Math.round((side - trimmed.bitmap.height) / 2));

  if (side > OUT_MAX_DIM) {
    square.resize(OUT_MAX_DIM, OUT_MAX_DIM, Jimp.RESIZE_BILINEAR);
  }

  await square.writeAsync(OUT);
  console.log(`  -> ${OUT} (${square.bitmap.width}x${square.bitmap.height})`);
})();
