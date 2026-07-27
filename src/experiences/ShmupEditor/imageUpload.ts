/**
 * Custom art upload, shared by tiles (E1 #191) and enemy/bullet sprites (E2
 * #192). Both libraries are fsStore-backed, which persists through
 * LocalStorageAdapter — an unconstrained photo upload could blow past
 * localStorage's ~5-10MB quota after a handful of uploads, so every upload
 * is decoded, redrawn onto a small square canvas, then quantized to a
 * limited palette and stored as a genuine indexed-color PNG
 * (utils/paletteQuantize.ts + utils/indexedPng.ts) — much smaller than
 * truecolor PNG or JPEG for flat, low-color tile/sprite art, and (unlike
 * JPEG) keeps pixel-perfect edges and real transparency. Tiles use a
 * cover-fit crop (fill the whole square, matching built-in tile images);
 * sprites use a contain-fit with a transparent surround (the whole subject
 * must stay visible, not cropped, against a see-through background) — see
 * loadTileImageFile vs loadSpriteImageFile below.
 */
import { loadImage } from "../../utils/loadImage";
import { quantizeImage } from "../../utils/paletteQuantize";
import { encodeIndexedPng, pngBytesToDataUrl } from "../../utils/indexedPng";

const MAX_DIM = 256;

export const DEFAULT_PALETTE_SIZE = 32;
export const PALETTE_SIZE_OPTIONS = [256, 128, 64, 32, 16, 8] as const;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

async function decodeUpload(file: File): Promise<HTMLImageElement> {
  // A non-empty MIME type that isn't image/* is a reliable reject; an empty
  // type (some mobile pickers/renamed files) is not — let decode below be
  // the real gate rather than false-rejecting a legitimate image.
  if (file.type && !file.type.startsWith("image/")) throw new Error("That file isn't an image.");
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  if (!img.width || !img.height) throw new Error("That image has no visible content.");
  return img;
}

async function canvasToIndexedPngDataUrl(canvas: HTMLCanvasElement, paletteSize: number): Promise<string> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const quantized = quantizeImage(imageData, paletteSize);
  const pngBytes = await encodeIndexedPng(quantized);
  return pngBytesToDataUrl(pngBytes);
}

/** Reads an uploaded image file and returns a downscaled, cover-cropped, palette-quantized indexed PNG data URL. Used for full-square tile background art, where filling the whole square (cropping any excess) is correct. */
export async function loadTileImageFile(file: File, paletteSize: number = DEFAULT_PALETTE_SIZE): Promise<string> {
  const img = await decodeUpload(file);

  const canvas = document.createElement("canvas");
  canvas.width = MAX_DIM;
  canvas.height = MAX_DIM;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const scale = Math.max(MAX_DIM / img.width, MAX_DIM / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (MAX_DIM - w) / 2, (MAX_DIM - h) / 2, w, h);

  return canvasToIndexedPngDataUrl(canvas, paletteSize);
}

/** Reads an uploaded image file and returns a downscaled, contain-fit (not cropped), palette-quantized indexed PNG data URL with a transparent surround. Used for enemy/bullet sprites, where the whole subject must stay visible against a transparent background rather than filling a square — see enemySprites.ts. */
export async function loadSpriteImageFile(file: File, paletteSize: number = DEFAULT_PALETTE_SIZE): Promise<string> {
  const img = await decodeUpload(file);

  const canvas = document.createElement("canvas");
  canvas.width = MAX_DIM;
  canvas.height = MAX_DIM;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Leave the canvas at its default fully-transparent fill (no fillRect) —
  // unlike tile art, a sprite's surrounding square must stay see-through.

  const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (MAX_DIM - w) / 2, (MAX_DIM - h) / 2, w, h);

  return canvasToIndexedPngDataUrl(canvas, paletteSize);
}
