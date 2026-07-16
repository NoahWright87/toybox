/**
 * Pure geometry for spawn-node origins (spawnTypes.ts, E3 #193 —
 * specs/games/shmup/spawn-and-warnings.spec.todo.md §2). Two layers:
 *
 * - `computeShapePositions` — a `shape` origin's local-space template
 *   (centered on its own origin, direction=0): spanStart/spanEnd are
 *   normalized boundary percentages of a reference width (spec: "a V
 *   spanning 25-75% of tile width"), and spacing between individuals is
 *   derived from `count` filling that span — a count of 3 spaces widely, a
 *   count of 15 packs tightly, same shape either way, exactly as spec
 *   requires. Deterministic and pure, so it's directly unit-testable.
 * - `resolveSpawnPositions` — the full world-space result for any origin
 *   type (point/region/shape), applying rotation (`direction`), anchor
 *   translation, and `mirror` (a second full copy reflected across the
 *   owning tile's own center axis). `region`'s scatter uses `Math.random()`
 *   — a representative editor preview, not a seeded/deterministic result;
 *   the real game generator's own placement math (not built yet) is a
 *   separate, seeded system per levels-and-tiles.spec.todo.md §2.
 */
import type { Vec2 } from "./encounterTypes";
import type { SpawnNodeDef, SpawnShapeKind } from "./spawnTypes";

/** How sharply a "v" shape's arms rise from its center apex, relative to the span's own width. */
const V_HEIGHT_FACTOR = 0.5;
/** How far an "arc" shape's ends bow out from its center, relative to the span's own width. */
const ARC_HEIGHT_FACTOR = 0.35;

function percentToLocalX(pct: number, referenceWidth: number): number {
  return (pct / 100 - 0.5) * referenceWidth;
}

/** Evenly-spaced normalized percentages from spanStart to spanEnd, `count` of them — a lone individual lands at the span's midpoint rather than one edge. */
function spanPercents(spanStart: number, spanEnd: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(spanStart + spanEnd) / 2];
  return Array.from({ length: count }, (_, i) => spanStart + ((spanEnd - spanStart) * i) / (count - 1));
}

/** Local-space (shape centered on its own origin, direction=0) positions for `count` individuals filling one shape template's span. */
export function computeShapePositions(shapeKind: SpawnShapeKind, spanStart: number, spanEnd: number, count: number, referenceWidth: number): Vec2[] {
  if (count <= 0) return [];
  const spanWidthPx = Math.abs(percentToLocalX(spanEnd, referenceWidth) - percentToLocalX(spanStart, referenceWidth)) || 1;

  if (shapeKind === "grid") {
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return Array.from({ length: count }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const colFrac = cols > 1 ? col / (cols - 1) : 0.5;
      const rowFrac = rows > 1 ? row / (rows - 1) : 0.5;
      return { x: (colFrac - 0.5) * spanWidthPx, y: (rowFrac - 0.5) * spanWidthPx };
    });
  }

  const centerPct = (spanStart + spanEnd) / 2;
  const halfSpan = Math.abs(spanEnd - spanStart) / 2 || 1;
  return spanPercents(spanStart, spanEnd, count).map((pct) => {
    const x = percentToLocalX(pct, referenceWidth);
    const u = (pct - centerPct) / halfSpan; // -1..1, 0 at the span's center
    let y = 0;
    if (shapeKind === "v") y = Math.abs(u) * V_HEIGHT_FACTOR * spanWidthPx;
    else if (shapeKind === "arc") y = (1 - Math.cos((u * Math.PI) / 2)) * ARC_HEIGHT_FACTOR * spanWidthPx;
    return { x, y };
  });
}

function rotate(p: Vec2, degrees: number): Vec2 {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

function basePositions(node: SpawnNodeDef, count: number, tileWidthPx: number): Vec2[] {
  const { origin } = node;
  if (count <= 0) return [];
  if (origin.type === "point") {
    return Array.from({ length: count }, () => ({ ...origin.anchor }));
  }
  if (origin.type === "region") {
    return Array.from({ length: count }, () => ({
      x: origin.anchor.x + (Math.random() - 0.5) * origin.regionWidth,
      y: origin.anchor.y + (Math.random() - 0.5) * origin.regionHeight,
    }));
  }
  const local = computeShapePositions(origin.shapeKind, origin.spanStart, origin.spanEnd, count, tileWidthPx);
  return local.map((p) => {
    const rotated = rotate(p, node.direction);
    return { x: rotated.x + origin.anchor.x, y: rotated.y + origin.anchor.y };
  });
}

/** Full world-space individual positions for a spawn node at a given resolved count — the render/preview surface EncounterEditor.tsx uses. Mirroring appends a second full copy reflected across the owning tile's own width (`tileWidthPx - x`), per spec: "reflects the entire origin (post-rotation) across a center axis... composes with any origin type." */
export function resolveSpawnPositions(node: SpawnNodeDef, count: number, tileWidthPx: number): Vec2[] {
  const base = basePositions(node, count, tileWidthPx);
  if (!node.mirror) return base;
  return [...base, ...base.map((p) => ({ x: tileWidthPx - p.x, y: p.y }))];
}
