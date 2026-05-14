// Sprite loader with optional animation frame support.
// Each sprite is loaded from a PNG file. Frames describe sub-rects
// within the sheet — leave empty to use the whole image as one frame.
// The game falls back gracefully if the PNG hasn't been generated yet.

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Sprite {
  private img: HTMLImageElement | null = null;
  public loaded = false;
  private frames: FrameRect[];

  constructor(src: string, frames: FrameRect[] = []) {
    this.frames = frames;
    const img = new Image();
    img.onload = () => { this.img = img; this.loaded = true; };
    img.onerror = () => {}; // graceful: sprite just won't render
    img.src = src;
  }

  /** Draw frame `frameIdx` into destination rect (dx,dy,dw,dh) on ctx. */
  draw(
    ctx: CanvasRenderingContext2D,
    frameIdx: number,
    dx: number, dy: number, dw: number, dh: number,
  ): void {
    if (!this.img || !this.loaded || dw <= 0 || dh <= 0) return;
    if (this.frames.length === 0) {
      ctx.drawImage(this.img, dx, dy, dw, dh);
    } else {
      const f = this.frames[Math.floor(frameIdx) % this.frames.length];
      ctx.drawImage(this.img, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
    }
  }

  /** Number of animation frames (1 if no explicit frames defined). */
  get frameCount(): number {
    return this.frames.length || 1;
  }
}
