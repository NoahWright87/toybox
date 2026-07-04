/**
 * Custom tile art upload (specs/shmup-editor.todo.md, E1 #191's remaining
 * "import custom background art per tile" gap). The tile library is
 * fsStore-backed, which persists through LocalStorageAdapter — an
 * unconstrained photo upload could blow past localStorage's ~5-10MB quota
 * after a handful of tiles, so every upload is decoded and redrawn onto a
 * small square canvas (cover-fit crop, matching how built-in tile images
 * fill their square) before being stored as a data URL.
 */
const MAX_DIM = 256;

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Could not decode that image."));
    img.onload = () => resolve(img);
    img.src = dataUrl;
  });
}

/** Reads an uploaded image file and returns a downscaled, cover-cropped square PNG data URL. */
export async function loadTileImageFile(file: File): Promise<string> {
  if (!isImageFile(file)) throw new Error("That file isn't an image.");
  const dataUrl = await readAsDataUrl(file);
  const img = await decodeImage(dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = MAX_DIM;
  canvas.height = MAX_DIM;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");

  const scale = Math.max(MAX_DIM / img.width, MAX_DIM / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (MAX_DIM - w) / 2, (MAX_DIM - h) / 2, w, h);

  return canvas.toDataURL("image/png");
}
