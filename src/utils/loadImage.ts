/** Shared `<img>`-decode-as-promise helper — used anywhere a data URL or
 * object URL needs to become a drawable `HTMLImageElement` before a canvas
 * operation (resizing, degrading, cover-cropping). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
