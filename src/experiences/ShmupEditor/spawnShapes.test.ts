import { describe, it, expect } from "vitest";
import { computeShapePositions, resolveSpawnPositions } from "./spawnShapes";
import { createSpawnNode, type SpawnNodeDef } from "./spawnTypes";

describe("computeShapePositions", () => {
  it("returns an empty array for count 0", () => {
    expect(computeShapePositions("line", 25, 75, 0, 200)).toEqual([]);
  });

  it("places a lone individual at the span's midpoint", () => {
    const [p] = computeShapePositions("line", 0, 100, 1, 200);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it("line spans spanStart to spanEnd with y always 0", () => {
    const points = computeShapePositions("line", 25, 75, 3, 200);
    expect(points).toHaveLength(3);
    expect(points.map((p) => Math.round(p.x))).toEqual([-50, 0, 50]);
    expect(points.every((p) => p.y === 0)).toBe(true);
  });

  it("v shape has y=0 at its center point and rises toward the edges", () => {
    const points = computeShapePositions("v", 0, 100, 5, 200);
    expect(points[2].y).toBeCloseTo(0); // center individual (index 2 of 5)
    expect(points[0].y).toBeGreaterThan(0);
    expect(points[4].y).toBeGreaterThan(0);
    expect(points[0].y).toBeCloseTo(points[4].y); // symmetric
  });

  it("arc shape bows smoothly, distinct from v's linear rise", () => {
    const arcPoints = computeShapePositions("arc", 0, 100, 5, 200);
    const vPoints = computeShapePositions("v", 0, 100, 5, 200);
    expect(arcPoints[2].y).toBeCloseTo(0);
    expect(arcPoints[0].y).toBeGreaterThan(0);
    expect(arcPoints[0].y).not.toBeCloseTo(vPoints[0].y);
  });

  it("grid arranges points in roughly square rows/cols within the span box", () => {
    const points = computeShapePositions("grid", 0, 100, 4, 200);
    expect(points).toHaveLength(4);
    const xs = new Set(points.map((p) => Math.round(p.x)));
    const ys = new Set(points.map((p) => Math.round(p.y)));
    expect(xs.size).toBe(2);
    expect(ys.size).toBe(2);
  });
});

function node(patch: Partial<SpawnNodeDef>): SpawnNodeDef {
  return { ...createSpawnNode(0, { x: 50, y: 50 }, "unit-1"), ...patch };
}

describe("resolveSpawnPositions", () => {
  it("point origin returns count copies of the anchor", () => {
    const n = node({ origin: { ...createSpawnNode(0, { x: 50, y: 50 }, null).origin, type: "point", anchor: { x: 10, y: 20 } } });
    const positions = resolveSpawnPositions(n, 3, 200);
    expect(positions).toHaveLength(3);
    expect(positions.every((p) => p.x === 10 && p.y === 20)).toBe(true);
  });

  it("region origin scatters within the box bounds", () => {
    const n = node({
      origin: { ...createSpawnNode(0, { x: 0, y: 0 }, null).origin, type: "region", anchor: { x: 100, y: 100 }, regionWidth: 40, regionHeight: 20 },
    });
    const positions = resolveSpawnPositions(n, 20, 200);
    expect(positions).toHaveLength(20);
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(80);
      expect(p.x).toBeLessThanOrEqual(120);
      expect(p.y).toBeGreaterThanOrEqual(90);
      expect(p.y).toBeLessThanOrEqual(110);
    }
  });

  it("shape origin translates local points by the anchor at direction 0", () => {
    const n = node({
      direction: 0,
      origin: { ...createSpawnNode(0, { x: 0, y: 0 }, null).origin, type: "shape", shapeKind: "line", anchor: { x: 100, y: 50 }, spanStart: 0, spanEnd: 100 },
    });
    const positions = resolveSpawnPositions(n, 1, 200);
    expect(positions).toHaveLength(1);
    expect(positions[0]).toEqual({ x: 100, y: 50 });
  });

  it("mirror appends a second copy reflected across tileWidthPx", () => {
    const n = node({
      mirror: true,
      origin: { ...createSpawnNode(0, { x: 0, y: 0 }, null).origin, type: "point", anchor: { x: 30, y: 40 } },
    });
    const positions = resolveSpawnPositions(n, 1, 200);
    expect(positions).toHaveLength(2);
    expect(positions[0]).toEqual({ x: 30, y: 40 });
    expect(positions[1]).toEqual({ x: 170, y: 40 });
  });

  it("returns an empty array for count 0 regardless of origin type", () => {
    expect(resolveSpawnPositions(node({}), 0, 200)).toEqual([]);
  });
});
