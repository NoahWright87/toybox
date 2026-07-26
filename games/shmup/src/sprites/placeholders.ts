import Phaser from "phaser";
import type { SpriteManifestEntry } from "./types";

function colorToNumber(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

/** Stroke width (px) for placeholders that declare an `outline` — fixed rather than proportional so it stays a crisp, visible line at any of the small sizes these primitives render at. */
const OUTLINE_WIDTH = 3;

/** Draws one manifest entry's placeholder primitive into `g`, sized to its frame. Caller generates+clears the texture. */
export function drawPlaceholder(g: Phaser.GameObjects.Graphics, def: SpriteManifestEntry): void {
  const { shape, color, outline } = def.placeholder;
  const w = def.frameWidth;
  const h = def.frameHeight;
  g.fillStyle(colorToNumber(color));
  switch (shape) {
    case "rect":
      g.fillRect(0, 0, w, h);
      break;
    case "circle":
      g.fillCircle(w / 2, h / 2, Math.min(w, h) / 2);
      break;
    case "triangle":
      g.fillTriangle(w / 2, 0, 0, h, w, h);
      break;
  }
  if (!outline) return;
  // Inset half the stroke width so the line stays fully inside the frame — generateTexture()
  // crops exactly to frameWidth/frameHeight, and Graphics strokes are centered on the path.
  const inset = OUTLINE_WIDTH / 2;
  g.lineStyle(OUTLINE_WIDTH, colorToNumber(outline));
  switch (shape) {
    case "rect":
      g.strokeRect(inset, inset, w - OUTLINE_WIDTH, h - OUTLINE_WIDTH);
      break;
    case "circle":
      g.strokeCircle(w / 2, h / 2, Math.min(w, h) / 2 - inset);
      break;
    case "triangle":
      g.strokeTriangle(w / 2, inset, inset, h - inset, w - inset, h - inset);
      break;
  }
}
