/**
 * Median-cut color quantization + palette-based Floyd-Steinberg dithering.
 * Reduces an image's RGBA pixels down to a fixed-size palette (<=256
 * entries — indexed PNG's hard limit) so the result can be losslessly
 * stored as a tiny indexed PNG (see indexedPng.ts) instead of full
 * truecolor. Shared by anything that wants to constrain an uploaded/drawn
 * image to a limited palette (shmup-editor tile/sprite art today; NS Art's
 * planned palette-size feature and the wallpaper degrade pipeline later).
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface QuantizedImage {
  width: number;
  height: number;
  palette: RGBA[];
  /** One palette index per pixel, row-major. */
  indices: Uint8Array;
}

const CHANNELS: Array<keyof RGBA> = ["r", "g", "b", "a"];

function channelRange(pixels: RGBA[], channel: keyof RGBA): number {
  let min = 255;
  let max = 0;
  for (const p of pixels) {
    const v = p[channel];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}

function widestChannel(pixels: RGBA[]): keyof RGBA {
  let best: keyof RGBA = "r";
  let bestRange = -1;
  for (const channel of CHANNELS) {
    const range = channelRange(pixels, channel);
    if (range > bestRange) {
      bestRange = range;
      best = channel;
    }
  }
  return best;
}

function averageColor(pixels: RGBA[]): RGBA {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (const p of pixels) {
    r += p.r;
    g += p.g;
    b += p.b;
    a += p.a;
  }
  const n = pixels.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), a: Math.round(a / n) };
}

/** Repeatedly splits the bucket with the most pixels along its widest channel until `maxColors` buckets exist. */
function medianCut(pixels: RGBA[], maxColors: number): RGBA[] {
  if (pixels.length === 0) return [{ r: 0, g: 0, b: 0, a: 0 }];
  const buckets: RGBA[][] = [pixels];

  while (buckets.length < maxColors) {
    let splitIndex = -1;
    let splitSize = 1; // never split a bucket down to zero pixels
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].length > splitSize) {
        splitSize = buckets[i].length;
        splitIndex = i;
      }
    }
    if (splitIndex === -1) break; // every bucket is already a single pixel

    const bucket = buckets[splitIndex];
    const channel = widestChannel(bucket);
    const sorted = [...bucket].sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(sorted.length / 2);
    buckets.splice(splitIndex, 1, sorted.slice(0, mid), sorted.slice(mid));
  }

  return buckets.map(averageColor);
}

function colorDistanceSq(a: RGBA, b: RGBA): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const da = a.a - b.a;
  return dr * dr + dg * dg + db * db + da * da;
}

function nearestPaletteIndex(color: RGBA, palette: RGBA[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dist = colorDistanceSq(color, palette[i]);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, v));
}

/**
 * Reduces `imageData` to at most `maxColors` colors via median-cut, then
 * maps every pixel to its nearest palette entry.
 *
 * When `dither` is true, Floyd-Steinberg error diffusion runs against the
 * *chosen discrete palette* rather than independently posterizing each
 * channel (the approach NsDoors97/imageDegrade.ts uses for its wallpaper
 * effect). That distinction matters: diffusing error toward arbitrary RGB
 * values can produce more distinct final colors than the source palette
 * has entries for, which won't fit in a PNG PLTE chunk. Dithering against
 * a fixed palette is also the historically-accurate technique real
 * 256-color VGA/GIF art used.
 */
export function quantizeImage(imageData: { width: number; height: number; data: Uint8ClampedArray }, maxColors: number, dither = true): QuantizedImage {
  const { width, height, data } = imageData;
  const clampedMax = Math.max(2, Math.min(256, Math.round(maxColors)));

  const pixels: RGBA[] = new Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    pixels[p] = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
  }
  const palette = medianCut(pixels, clampedMax);
  const indices = new Uint8Array(width * height);

  if (!dither) {
    for (let i = 0; i < pixels.length; i++) indices[i] = nearestPaletteIndex(pixels[i], palette);
    return { width, height, palette, indices };
  }

  // Mutable working copy so diffused error can push channel values outside 0-255
  // (clamped again right before each pixel is quantized).
  const work: RGBA[] = pixels.map((p) => ({ ...p }));
  const diffuse = (x: number, y: number, err: RGBA, factor: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const n = work[y * width + x];
    n.r += err.r * factor;
    n.g += err.g * factor;
    n.b += err.b * factor;
    n.a += err.a * factor;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const src = work[i];
      const clamped: RGBA = { r: clampByte(src.r), g: clampByte(src.g), b: clampByte(src.b), a: clampByte(src.a) };
      const idx = nearestPaletteIndex(clamped, palette);
      indices[i] = idx;
      const chosen = palette[idx];
      const err: RGBA = { r: clamped.r - chosen.r, g: clamped.g - chosen.g, b: clamped.b - chosen.b, a: clamped.a - chosen.a };
      diffuse(x + 1, y, err, 7 / 16);
      diffuse(x - 1, y + 1, err, 3 / 16);
      diffuse(x, y + 1, err, 5 / 16);
      diffuse(x + 1, y + 1, err, 1 / 16);
    }
  }

  return { width, height, palette, indices };
}
