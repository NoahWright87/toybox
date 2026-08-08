/**
 * doodadSegment.mjs — shared magenta-key + contact-sheet segmentation used
 * by prepare-doodads.mjs and its authoring aid analyze-doodad-sheets.mjs.
 *
 * The doodad art (Noah-supplied, see assets/doodads-source/README.md) arrives
 * as contact sheets of loose top-down props on a flat magenta chroma-key
 * background. Two things differ from prepare-projectiles.mjs's approach and
 * are worth stating, because they drove the design here:
 *
 * 1. **Global key, not an edge flood fill.** Several doodads (camouflage
 *    netting, the chain-link roof railing) are meshes whose holes show the
 *    magenta backdrop through them. A flood fill seeded from the sheet border
 *    cannot reach those enclosed holes, so it would leave magenta confetti
 *    baked inside the sprite. Keying every magenta pixel wherever it sits is
 *    what actually matches the art's intent — magenta is never a real color
 *    in this batch, it is always "see through here".
 *
 * 2. **Row/column-band segmentation, not connected components.** Many props
 *    are deliberately scattered (loose pebbles, a bone pile, a run of
 *    bollards, a lamp separated from its post). Connected components would
 *    shatter each of those into a dozen sprites. Bands split only on runs of
 *    fully-empty rows/columns at least MIN_GAP wide, which is comfortably
 *    larger than the space inside a scattered prop and comfortably smaller
 *    than the space between two different props on these sheets.
 */

/** Chroma-key distance: how far a pixel may sit from the sheet's backdrop magenta and still be treated as background. Generous because the art is lightly anti-aliased against it. */
const COLOR_TOLERANCE = 60;

/**
 * A run of empty rows/columns this wide (px) separates two sprites; anything
 * narrower is interior space within one scattered sprite.
 *
 * 40 is the middle of the window that segments seven of the eight sheets
 * correctly (they tolerate anything from 28 to 48). `rooftops.png` is the
 * exception and passes its own value: its props are single large structures
 * packed close together, so the space *between* two of them is narrower than
 * the space inside a scattered pebble field on the other sheets — see
 * SHEETS in prepare-doodads.mjs.
 */
const DEFAULT_MIN_GAP = 40;

/** Boxes smaller than this on both axes are keying speckle, not a prop. */
const MIN_SPRITE_PX = 12;

function isBackground(r, g, b, ref) {
  return Math.abs(r - ref.r) <= COLOR_TOLERANCE && Math.abs(g - ref.g) <= COLOR_TOLERANCE && Math.abs(b - ref.b) <= COLOR_TOLERANCE;
}

/** The sheet's backdrop color, sampled from a corner (every sheet in this batch has a clean magenta margin). */
export function backdropColor(image) {
  const { data } = image.bitmap;
  return { r: data[0], g: data[1], b: data[2] };
}

/** 1 = sprite pixel, 0 = keyed-out backdrop. */
export function buildMask(image) {
  const { width, height, data } = image.bitmap;
  const ref = backdropColor(image);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    if (!isBackground(data[p], data[p + 1], data[p + 2], ref)) mask[i] = 1;
  }
  return mask;
}

/** Splits `occupied` (per-index "has any sprite pixel") into runs, then merges any two runs separated by a gap narrower than MIN_GAP — that gap is interior space within one scattered sprite, not a boundary between two. */
function bandsOf(occupied, length, minGap) {
  const runs = [];
  let start = -1;
  for (let i = 0; i < length; i++) {
    if (occupied[i]) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      runs.push({ start, end: i - 1 });
      start = -1;
    }
  }
  if (start !== -1) runs.push({ start, end: length - 1 });

  const bands = [];
  for (const run of runs) {
    const prev = bands[bands.length - 1];
    if (prev && run.start - prev.end - 1 < minGap) prev.end = run.end;
    else bands.push({ ...run });
  }
  return bands;
}

/**
 * Every sprite box on the sheet, in reading order (top-to-bottom rows, then
 * left-to-right within each row) — the order the sheets are laid out in, so
 * the name tables in prepare-doodads.mjs read the same way the art does.
 */
export function findSpriteBoxes(mask, width, height, minGap = DEFAULT_MIN_GAP) {
  const rowOccupied = new Uint8Array(height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        rowOccupied[y] = 1;
        break;
      }
    }
  }

  const boxes = [];
  for (const row of bandsOf(rowOccupied, height, minGap)) {
    const colOccupied = new Uint8Array(width);
    for (let y = row.start; y <= row.end; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x]) colOccupied[x] = 1;
      }
    }
    for (const col of bandsOf(colOccupied, width, minGap)) {
      // Tighten vertically: the row band spans the tallest sprite in the row,
      // so re-measure this column's own top and bottom within it.
      let top = -1;
      let bottom = -1;
      for (let y = row.start; y <= row.end; y++) {
        for (let x = col.start; x <= col.end; x++) {
          if (mask[y * width + x]) {
            if (top === -1) top = y;
            bottom = y;
            break;
          }
        }
      }
      if (top === -1) continue;
      const box = { x: col.start, y: top, w: col.end - col.start + 1, h: bottom - top + 1 };
      if (box.w < MIN_SPRITE_PX && box.h < MIN_SPRITE_PX) continue;
      boxes.push(box);
    }
  }
  return boxes;
}

export { COLOR_TOLERANCE, DEFAULT_MIN_GAP, isBackground };
