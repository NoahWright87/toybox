/**
 * Custom tile art upload (specs/shmup-editor.todo.md, E1 #191's remaining
 * "import custom background art per tile" gap). The tile library is
 * fsStore-backed, which persists through LocalStorageAdapter — an
 * unconstrained photo upload could blow past localStorage's ~5-10MB quota
 * after a handful of tiles, so every upload is decoded, redrawn onto a
 * small square canvas (cover-fit crop, matching how built-in tile images
 * fill their square), then quantized to a limited palette and stored as a
 * genuine indexed-color PNG (utils/paletteQuantize.ts + utils/indexedPng.ts)
 * — much smaller than truecolor PNG or JPEG for flat, low-color tile/sprite
 * art, and (unlike JPEG) keeps pixel-perfect edges and real transparency.
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

/** Reads an uploaded image file and returns a downscaled, cover-cropped, palette-quantized indexed PNG data URL. */
export async function loadTileImageFile(file: File, paletteSize: number = DEFAULT_PALETTE_SIZE): Promise<string> {
  // A non-empty MIME type that isn't image/* is a reliable reject; an empty
  // type (some mobile pickers/renamed files) is not — let decode below be
  // the real gate rather than false-rejecting a legitimate image.
  if (file.type && !file.type.startsWith("image/")) throw new Error("That file isn't an image.");

  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  if (!img.width || !img.height) throw new Error("That image has no visible content.");

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

  const imageData = ctx.getImageData(0, 0, MAX_DIM, MAX_DIM);
  const quantized = quantizeImage(imageData, paletteSize);
  const pngBytes = await encodeIndexedPng(quantized);
  return pngBytesToDataUrl(pngBytes);
}
