import { describe, expect, it } from "vitest";
import { autoGenerateLayout } from "./generateLayout";
import { computeAddPoints, type GridEntry } from "./connectionGrid";
import { IDENTITY_ORIENTATION } from "./orientation";
import { createBlankTile, edgeSlot, type TileDef } from "./types";

function tile(id: string, tag: string, overrides: Partial<TileDef> = {}): TileDef {
  return {
    ...createBlankTile(0),
    id,
    name: id,
    north: [edgeSlot(tag)],
    south: [edgeSlot(tag)],
    east: edgeSlot("", true),
    west: edgeSlot("", true),
    ...overrides,
  };
}

/** Deterministic stand-in for Math.random, cycling through fixed values. */
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function entryOf(t: TileDef, row: number, col = 0): GridEntry {
  return { key: `${t.id}-${row}`, tile: t, orientation: IDENTITY_ORIENTATION, row, col };
}

describe("autoGenerateLayout", () => {
  it("picks a starting tile when nothing is placed", () => {
    const out = autoGenerateLayout([tile("grass", "grass")], [], 1, seededRng([0.1]));
    expect(out).toHaveLength(1);
    expect(out[0].tile.id).toBe("grass");
    expect(out[0].row).toBe(0);
  });

  it("grows north — forward, the direction the player flies", () => {
    const out = autoGenerateLayout([tile("grass", "grass")], [], 4, seededRng([0.3]));
    expect(out).toHaveLength(4);
    const rows = out.map((e) => e.row).sort((a, b) => a - b);
    expect(rows).toEqual([-3, -2, -1, 0]);
  });

  it("extends an existing layout instead of replacing it", () => {
    const grass = tile("grass", "grass");
    const existing = [entryOf(grass, 0)];
    const out = autoGenerateLayout([grass], existing, 3, seededRng([0.5]));
    expect(out).toHaveLength(4);
    expect(out[0]).toBe(existing[0]); // the tile already placed is untouched
  });

  it("only ever places tiles that actually connect, by the viewer's own matcher", () => {
    const tiles = [tile("grass", "grass"), tile("lava", "lava"), tile("bridge", "grass", { north: [edgeSlot("lava")] })];
    const out = autoGenerateLayout(tiles, [entryOf(tiles[0], 0)], 6, seededRng([0.2, 0.7, 0.4, 0.9]));
    // Whatever it built, every seam in it must be one the viewer would allow:
    // an illegal pair would leave a north add point still open beneath an
    // occupied cell, which computeAddPoints can never report.
    const occupied = new Set(out.map((e) => `${e.row},${e.col}`));
    for (const point of computeAddPoints(out)) {
      expect(occupied.has(`${point.row},${point.colStart}`)).toBe(false);
    }
  });

  it("stops early at a dead end rather than looping or throwing", () => {
    // A tile hard-walled on its north edge can never be built on.
    const capped = tile("capped", "grass", { north: [edgeSlot("", true)] });
    const out = autoGenerateLayout([capped], [], 8, seededRng([0.5]));
    expect(out).toHaveLength(1);
  });

  it("does nothing with no tiles to draw from", () => {
    expect(autoGenerateLayout([], [], 5, seededRng([0.5]))).toEqual([]);
  });

  it("does nothing when asked for nothing", () => {
    const existing = [entryOf(tile("grass", "grass"), 0)];
    expect(autoGenerateLayout([tile("grass", "grass")], existing, 0, seededRng([0.5]))).toBe(existing);
  });

  it("gives every placed tile a distinct key, so the viewer can select and delete them individually", () => {
    const out = autoGenerateLayout([tile("grass", "grass")], [], 5, seededRng([0.11, 0.37, 0.59, 0.73, 0.91]));
    expect(new Set(out.map((e) => e.key)).size).toBe(out.length);
  });

  it("respects tile weight — a heavily weighted tile dominates the result", () => {
    const common = tile("common", "shared", { weight: 100 });
    const rare = tile("rare", "shared", { weight: 1 });
    const out = autoGenerateLayout([common, rare], [], 12, seededRng([0.05, 0.2, 0.4, 0.6, 0.8]));
    const commonCount = out.filter((e) => e.tile.id === "common").length;
    expect(commonCount).toBeGreaterThan(out.length / 2);
  });
});
