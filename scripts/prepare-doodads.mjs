/**
 * prepare-doodads.mjs
 *
 * One-time processing of the doodad art batch (Noah-supplied, see
 * scripts/assets/doodads-source/README.md) into built-in sprites for
 * src/experiences/ShmupEditor/enemySprites.ts. A doodad is just a Unit on
 * the `"doodad"` layer wearing one of these sprites (see unitTypes.ts's
 * DOODAD_SPECS), so they register in the same BUILTIN_SPRITES list as
 * enemies and projectiles do — only the output folder differs.
 *
 * Eight contact sheets of top-down scenery props on a flat magenta
 * chroma-key backdrop, 93 props total. Unlike prepare-projectiles.mjs,
 * neither the keying nor the cell boxes are hand-listed here: the props are
 * laid out on a loose grid with no cell borders to measure against, so
 * doodadSegment.mjs derives the boxes from the art itself (see that file
 * for why it keys globally and bands rather than flood-filling and
 * connected-component-ing). The NAMES tables below are therefore positional
 * — one name per prop, in the sheets' own reading order (left-to-right,
 * top-to-bottom). Re-run `node scripts/analyze-doodad-sheets.mjs` to see
 * the detected boxes drawn over each sheet if a name ever looks off.
 *
 * Usage:
 *   node scripts/prepare-doodads.mjs
 */
import { createRequire } from "module";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { buildMask, findSpriteBoxes, isBackground, backdropColor, COLOR_TOLERANCE } from "./doodadSegment.mjs";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(__dirname, "assets/doodads-source");
const OUT_DIR = resolve(__dirname, "../public/shmup-editor/doodads");

/** Matches the enemy set's 256x256 canvas — see public/shmup-editor/enemies/. */
const OUT_MAX_DIM = 256;
/** Transparent breathing room around the trimmed prop, in source pixels, before the square canvas is fitted. */
const SQUARE_MARGIN = 8;

/**
 * Each sheet's props in reading order. Length must equal the number of
 * boxes the segmenter finds, or the script fails loudly rather than
 * silently pairing a name with the wrong prop.
 *
 * `minGap` overrides doodadSegment.mjs's default where a sheet's spacing
 * needs it — `rooftops` packs large single structures closer together than
 * the loose pebble fields on the other sheets are internally spaced.
 */
const SHEETS = [
  {
    file: "trees.png",
    folder: "foliage",
    prefix: "tree",
    names: [
      ["broadleaf", "Tree (broadleaf)"],
      ["round", "Tree (round canopy)"],
      ["lobed", "Tree (lobed)"],
      ["dense", "Tree (dense)"],
      ["clover", "Tree (clover)"],
      ["fan-palm", "Tree (fan palm)"],
      ["canopy-wide", "Tree (wide canopy)"],
      ["cluster", "Tree (cluster)"],
      ["bush-large", "Bush (large)"],
      ["bush-round", "Bush (round)"],
      ["fan-palm-large", "Tree (fan palm, large)"],
      ["leafy", "Tree (leafy)"],
    ],
  },
  {
    file: "rocks.png",
    folder: "rocks",
    prefix: "rock",
    names: [
      ["small", "Rocks (small)"],
      ["boulder-pile", "Boulder Pile"],
      ["twin", "Boulders (twin)"],
      ["cluster", "Rock Cluster"],
      ["pebbles", "Pebbles (scattered)"],
      ["ridge", "Rock Ridge"],
      ["field", "Rock Field"],
      ["slab", "Rock Slab"],
      ["jagged", "Rocks (jagged)"],
      ["boulders", "Boulders"],
      ["rubble-strip", "Rubble Strip"],
      ["pile", "Rock Pile"],
    ],
  },
  {
    file: "desert.png",
    folder: "desert",
    prefix: "desert",
    names: [
      ["boulder", "Desert Boulder"],
      ["sandstone", "Sandstone Cluster"],
      ["pebbles", "Desert Pebbles"],
      ["shrub-small", "Desert Shrub (small)"],
      ["bush", "Desert Bush"],
      ["tumbleweed", "Tumbleweed"],
      ["cactus", "Prickly Pear Cactus"],
      ["agave", "Agave"],
      ["grass-tuft", "Dry Grass Tuft"],
      ["bones", "Bones"],
      ["cracked-ground", "Cracked Ground"],
      ["sand-patch", "Sand Patch"],
    ],
  },
  {
    file: "camp-green.png",
    folder: "camp",
    prefix: "camp",
    names: [
      ["tent-small", "Camp Tent (small)"],
      ["tent-large", "Camp Tent (large)"],
      ["sandbag-wall", "Sandbag Wall"],
      ["sandbag-ring", "Sandbag Ring"],
      ["foxhole", "Foxhole"],
      ["foxhole-double", "Foxhole (double)"],
      ["trench", "Trench"],
      ["netting", "Camo Netting"],
      ["crates", "Supply Crates"],
      ["barrels", "Fuel Barrels"],
      ["barriers", "Concrete Barriers"],
      ["sandbag-emplacement", "Sandbag Emplacement"],
    ],
  },
  {
    file: "camp-desert.png",
    folder: "camp-desert",
    prefix: "camp-sand",
    names: [
      ["tent-small", "Desert Tent (small)"],
      ["tent-large", "Desert Tent (large)"],
      ["netting", "Desert Camo Netting"],
      ["sandbag-wall", "Desert Sandbag Wall"],
      ["sandbag-ring", "Desert Sandbag Ring"],
      ["sandbag-line", "Desert Sandbag Line"],
      ["foxhole", "Desert Foxhole"],
      ["foxhole-double", "Desert Foxhole (double)"],
      ["trench", "Desert Trench"],
      ["crates", "Desert Supply Crates"],
      ["barrels", "Desert Fuel Barrels"],
      ["tarp", "Desert Tarp"],
    ],
  },
  {
    file: "urban-props.png",
    folder: "urban",
    prefix: "urban",
    names: [
      ["manhole", "Manhole Cover"],
      ["utility-plate", "Utility Plate"],
      ["storm-drain", "Storm Drain"],
      ["guardrail", "Guardrail"],
      ["pipe-run", "Pipe Run"],
      ["concrete-barriers", "Concrete Barrier Row"],
      ["barricade", "Construction Barricade"],
      ["warning-lights", "Warning Lights"],
      ["street-lamp", "Street Lamp"],
      ["bollards", "Bollards"],
      ["crater", "Crater"],
      ["access-hatch", "Access Hatch"],
    ],
  },
  {
    file: "industrial-props.png",
    folder: "industrial",
    prefix: "ind",
    names: [
      ["pallet", "Wooden Pallet"],
      ["crates", "Wooden Crates"],
      ["container-small", "Container (small)"],
      ["oil-barrels", "Oil Barrels"],
      ["cable-spool", "Cable Spool"],
      ["hose-coil", "Hose Coil"],
      ["generator", "Generator"],
      ["exhaust-fan", "Exhaust Fan"],
      ["hatch", "Metal Hatch"],
      ["oil-spill", "Oil Spill"],
      ["rubble", "Rubble"],
      ["tires", "Tire Stack"],
    ],
  },
  {
    file: "rooftops.png",
    folder: "rooftops",
    prefix: "roof",
    minGap: 20,
    names: [
      ["warehouse", "Warehouse Roof"],
      ["factory", "Factory Roof"],
      ["helipad", "Helipad"],
      ["container-large", "Container (large)"],
      ["container-row", "Container Row"],
      ["tank", "Storage Tank"],
      ["tank-cluster", "Tank Cluster"],
      ["plant", "Plant Roof"],
      ["fenced-platform", "Fenced Platform"],
    ],
  },
];

/**
 * How magenta a pixel is: red *and* blue in excess of green, which is the
 * signature the backdrop leaves on anything it bleeds into.
 *
 * Measuring contamination this way, rather than by distance from the
 * backdrop color, is what keeps neutral art intact. Mid-gray stone sits
 * only ~140 from this magenta in the widest channel — near enough that a
 * distance threshold generous enough to catch the real halo also swallows
 * every rock and concrete slab on these sheets and leaves them olive.
 * Excess-over-green is 0 for any neutral, so gray passes through untouched
 * no matter how the thresholds are set. It is also 0 or negative for every
 * saturated color in this batch: green foliage, the orange barricade and
 * rust containers (red high, blue low), and the blue container (blue high,
 * red low).
 */
function magentaExcess(r, g, b) {
  return Math.min(r, b) - g;
}

/**
 * Keys the backdrop magenta out of an already-cropped prop, everywhere it
 * appears — including holes enclosed by netting or fencing.
 *
 * An anti-aliased edge pixel is `observed = a*art + (1-a)*backdrop`. The
 * backdrop is the most magenta thing in frame, so the fraction of *its*
 * magenta excess that a pixel carries is a direct read on `(1 - a)` — which
 * gives both the alpha and the amount of backdrop color to divide back out.
 * Skipping that un-mix is what leaves the classic pink rim: the pixel gets
 * the right alpha but keeps its contaminated color.
 */
function keyBackdrop(image, ref) {
  const { width, height, data } = image.bitmap;
  const backdropExcess = magentaExcess(ref.r, ref.g, ref.b);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];

    if (isBackground(r, g, b, ref)) {
      data[p + 3] = 0;
      continue;
    }

    const excess = magentaExcess(r, g, b);
    if (excess <= 0) continue; // Uncontaminated art — leave it exactly as drawn.

    const coverage = 1 - excess / backdropExcess;
    if (coverage <= 0) {
      data[p + 3] = 0;
      continue;
    }

    data[p] = clampByte((r - (1 - coverage) * ref.r) / coverage);
    data[p + 1] = clampByte((g - (1 - coverage) * ref.g) / coverage);
    data[p + 2] = clampByte((b - (1 - coverage) * ref.b) / coverage);
    data[p + 3] = Math.round(data[p + 3] * coverage);
  }
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Centers the keyed prop on a transparent square canvas, scaled down to OUT_MAX_DIM if needed — same output convention as prepare-projectiles.mjs. */
function toSquare(sprite) {
  const { width, height } = sprite.bitmap;
  const side = Math.max(width, height) + SQUARE_MARGIN * 2;
  const square = new Jimp(side, side, 0x00000000);
  square.composite(sprite, Math.round((side - width) / 2), Math.round((side - height) / 2));
  if (side > OUT_MAX_DIM) square.resize(OUT_MAX_DIM, OUT_MAX_DIM, Jimp.RESIZE_BILINEAR);
  return square;
}

mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
for (const sheet of SHEETS) {
  const image = await Jimp.read(resolve(SOURCE_DIR, sheet.file));
  const { width, height } = image.bitmap;
  const ref = backdropColor(image);
  const boxes = findSpriteBoxes(buildMask(image), width, height, sheet.minGap);

  if (boxes.length !== sheet.names.length) {
    throw new Error(`${sheet.file}: found ${boxes.length} props but ${sheet.names.length} names are listed — re-run analyze-doodad-sheets.mjs and reconcile before trusting the pairing`);
  }

  const outDir = resolve(OUT_DIR, sheet.folder);
  mkdirSync(outDir, { recursive: true });
  console.log(`\n${sheet.file} — ${boxes.length} props`);

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    const [slug] = sheet.names[i];
    const cropped = image.clone().crop(box.x, box.y, box.w, box.h);
    keyBackdrop(cropped, ref);
    const square = toSquare(cropped);
    const outPath = resolve(outDir, `${slug}.png`);
    await square.writeAsync(outPath);
    console.log(`  -> ${sheet.folder}/${slug}.png (${square.bitmap.width}x${square.bitmap.height}, from ${box.w}x${box.h})`);
    total++;
  }
}

console.log(`\nDone — ${total} doodad sprites.`);
