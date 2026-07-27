import Phaser from "phaser";
import type { SpriteManifestEntry } from "./types";

function colorToNumber(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

/** Draws one manifest entry's placeholder primitive into `g`, sized to its frame. Caller generates+clears the texture. */
export function drawPlaceholder(g: Phaser.GameObjects.Graphics, def: SpriteManifestEntry): void {
  const { shape, color } = def.placeholder;
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
}
