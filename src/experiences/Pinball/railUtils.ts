import type { BoardRailPoint } from "./boardTypes";

export interface RailSample {
  x: number;
  y: number;
  tanX: number;
  tanY: number;
}

// Distance from centerline to the inner face of each wall
export const RAIL_HALF_INNER = 12;
// Wall body thickness
export const RAIL_WALL_THICK = 4;
// Distance from centerline to wall body center
export const RAIL_WALL_OFFSET = RAIL_HALF_INNER + RAIL_WALL_THICK / 2; // 14 px

/**
 * Sample a Catmull-Rom spline through `pts` at intervals of `step` px.
 * Returns centerline points with normalized tangent vectors.
 */
export function sampleRailCenterline(pts: BoardRailPoint[], step = 6): RailSample[] {
  if (pts.length < 2) return [];
  const n = pts.length;
  const result: RailSample[] = [];

  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const numSamples = Math.max(2, Math.ceil(segLen / step));

    for (let j = 0; j < numSamples; j++) {
      const t = j / numSamples;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      const dx = 0.5 * ((-p0.x + p2.x) + 2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t + 3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t2);
      const dy = 0.5 * ((-p0.y + p2.y) + 2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t + 3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t2);
      const len = Math.hypot(dx, dy) || 1;
      result.push({ x, y, tanX: dx / len, tanY: dy / len });
    }
  }

  // Endpoint
  const last = pts[n - 1];
  const prev = pts[n - 2];
  const ex = last.x - prev.x, ey = last.y - prev.y;
  const elen = Math.hypot(ex, ey) || 1;
  result.push({ x: last.x, y: last.y, tanX: ex / elen, tanY: ey / elen });

  return result;
}
