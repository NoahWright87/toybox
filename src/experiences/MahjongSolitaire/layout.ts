export interface TilePosition {
  x: number;
  y: number;
  z: number;
}

export interface BoardSlot {
  id: string; // `${z},${x},${y}`
  pos: TilePosition;
}

/** Half-cell size in pixels. A tile footprint is 2x2 half-units. */
export const HALF_W = 16;
export const HALF_H = 22;
/** Pixel offset applied per layer (both x and y) to create the layered look. */
export const Z_OFFSET = 4;

/** Tile footprint, in half-cell units. */
const TILE_SIZE = 2;

interface RectSpec {
  xStart: number;
  xCount: number;
  yStart: number;
  yCount: number;
}

// Pre-computed turtle-shaped layout rectangles. Each rect expands to
// xCount * yCount slots at x = xStart + 2*i, y = yStart + 2*j.
// Verified to total exactly 144 slots across 4 layers.
const LAYERS: RectSpec[][] = [
  // Layer 0 (z=0) — main body + head/tail protrusions = 100 slots
  [
    { xStart: 0, xCount: 12, yStart: 0, yCount: 8 }, // 96
    { xStart: -2, xCount: 1, yStart: 6, yCount: 2 }, // 2 (head)
    { xStart: 24, xCount: 1, yStart: 6, yCount: 2 }, // 2 (tail)
  ],
  // Layer 1 (z=1) = 32 slots
  [{ xStart: 3, xCount: 8, yStart: 2, yCount: 4 }],
  // Layer 2 (z=2) = 8 slots
  [{ xStart: 5, xCount: 4, yStart: 4, yCount: 2 }],
  // Layer 3 (z=3) = 4 slots
  [{ xStart: 7, xCount: 2, yStart: 5, yCount: 2 }],
];

export function generateTurtleLayout(): BoardSlot[] {
  const slots: BoardSlot[] = [];
  LAYERS.forEach((rects, z) => {
    for (const rect of rects) {
      for (let i = 0; i < rect.xCount; i++) {
        for (let j = 0; j < rect.yCount; j++) {
          const x = rect.xStart + 2 * i;
          const y = rect.yStart + 2 * j;
          slots.push({ id: `${z},${x},${y}`, pos: { x, y, z } });
        }
      }
    }
  });
  return slots;
}

/**
 * Pixel bounding box of the whole layout, accounting for tile size and the
 * per-layer Z_OFFSET, so the component can size its container dynamically.
 */
export function getBoardPixelSize(slots: BoardSlot[]): { width: number; height: number } {
  const { minLeft, maxRight, minTop, maxBottom } = getBoardBounds(slots);
  return { width: maxRight - minLeft, height: maxBottom - minTop };
}

/**
 * Top-left origin (in pixels) of the layout's bounding box. Subtract this
 * from a tile's computed left/top to position everything within a
 * container sized by getBoardPixelSize.
 */
export function getBoardOrigin(slots: BoardSlot[]): { left: number; top: number } {
  const { minLeft, minTop } = getBoardBounds(slots);
  return { left: minLeft, top: minTop };
}

function getBoardBounds(slots: BoardSlot[]): {
  minLeft: number;
  maxRight: number;
  minTop: number;
  maxBottom: number;
} {
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let minTop = Infinity;
  let maxBottom = -Infinity;

  for (const slot of slots) {
    const { x, y, z } = slot.pos;
    const left = x * HALF_W + z * Z_OFFSET;
    const right = (x + TILE_SIZE) * HALF_W + z * Z_OFFSET;
    const top = y * HALF_H - z * Z_OFFSET;
    const bottom = (y + TILE_SIZE) * HALF_H - z * Z_OFFSET;

    if (left < minLeft) minLeft = left;
    if (right > maxRight) maxRight = right;
    if (top < minTop) minTop = top;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  return { minLeft, maxRight, minTop, maxBottom };
}
