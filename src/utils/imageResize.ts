// Shared helper for resizing user-uploaded images down to a manageable size
// before storing them (e.g. as a data URL in fsStore). Unlike
// NsDoors97/imageDegrade.ts, this does NOT apply any 256-color dithering —
// it's a plain high-quality resize for apps that want to keep image detail
// (e.g. a jigsaw puzzle photo).

import { loadImage } from "./loadImage";

const DEFAULT_MAX_DIM = 1024;
const DEFAULT_QUALITY = 0.85;

export interface ResizedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Resizes an image so its largest dimension is at most `maxDim`, preserving
 * aspect ratio, and returns a JPEG data URL plus the final dimensions.
 */
export async function resizeImageToDataUrl(
  src: string,
  maxDim: number = DEFAULT_MAX_DIM,
  quality: number = DEFAULT_QUALITY
): Promise<ResizedImage> {
  const img = await loadImage(src);
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;
  if (!origW || !origH) throw new Error("Could not read image dimensions");

  let width = origW;
  let height = origH;
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  return { dataUrl: canvas.toDataURL("image/jpeg", quality), width, height };
}

/** Loads an image and resolves its natural pixel dimensions. */
export async function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(src);
  return { width: img.naturalWidth, height: img.naturalHeight };
}
