import { describe, expect, it } from "vitest";
import {
  IDENTITY_ORIENTATION,
  layoutFromGrid,
  orientAngleDeg,
  orientMirrorsArc,
  orientPoint,
  singleTileLayout,
  type GridPlacement,
} from "./levelLayout";
import { TILE_UNIT } from "./scrollModel";

function entry(row: number, col: number, overrides: Partial<GridPlacement> = {}): GridPlacement {
  return { tileId: `t${row}-${col}`, row, col, footprint: 1, orientation: IDENTITY_ORIENTATION, ...overrides };
}

describe("layoutFromGrid", () => {
  it("flips rows into depth — the southernmost tile is where the player flies in", () => {
    const layout = layoutFromGrid([entry(0, 0), entry(1, 0), entry(2, 0)]);
    const byTile = new Map(layout.placements.map((p) => [p.tileId, p.depth]));
    expect(byTile.get("t2-0")).toBe(0); // furthest south, met first
    expect(byTile.get("t1-0")).toBe(1);
    expect(byTile.get("t0-0")).toBe(2);
  });

  it("normalises columns so the westmost placed column is 0", () => {
    const layout = layoutFromGrid([entry(0, -2), entry(0, 1)]);
    expect(layout.placements.map((p) => p.column).sort((a, b) => a - b)).toEqual([0, 3]);
  });

  it("counts the columns a level spans, including a wide tile's own footprint", () => {
    expect(layoutFromGrid([entry(0, 0, { footprint: 3 })]).columns).toBe(3);
    expect(layoutFromGrid([entry(0, 0), entry(0, 1)]).columns).toBe(2);
  });

  it("is empty for an empty grid", () => {
    expect(layoutFromGrid([])).toEqual({ placements: [], columns: 0 });
  });
});

describe("singleTileLayout", () => {
  it("is a level of one at depth 0 — the encounter playtest is not a special case", () => {
    expect(singleTileLayout("tile-1")).toEqual({
      placements: [{ tileId: "tile-1", depth: 0, column: 0, orientation: IDENTITY_ORIENTATION }],
      columns: 1,
    });
  });
});

describe("orientPoint", () => {
  const U = TILE_UNIT;

  it("leaves an unrotated tile alone", () => {
    expect(orientPoint({ x: 100, y: 200 }, 1, IDENTITY_ORIENTATION)).toEqual({ x: 100, y: 200 });
  });

  it("mirrors x on a flip", () => {
    expect(orientPoint({ x: 100, y: 200 }, 1, { rotation: 0, flip: true })).toEqual({ x: U - 100, y: 200 });
  });

  it("mirrors a flip across the tile's whole width, not one column", () => {
    expect(orientPoint({ x: 100, y: 0 }, 3, { rotation: 0, flip: true })).toEqual({ x: 3 * U - 100, y: 0 });
  });

  it("turns 180 about the tile's centre", () => {
    expect(orientPoint({ x: 100, y: 200 }, 1, { rotation: 180, flip: false })).toEqual({ x: U - 100, y: U - 200 });
  });

  it("sends the west edge to the north edge on a quarter turn, matching the edge-tag transform", () => {
    // rotate90CW maps north <- west, so a point ON the west edge (x = 0)
    // must land on the north edge (y = 0).
    const rotated = orientPoint({ x: 0, y: 300 }, 1, { rotation: 90, flip: false });
    expect(rotated.y).toBe(0);
  });

  it("sends the north edge to the east edge on a quarter turn", () => {
    const rotated = orientPoint({ x: 300, y: 0 }, 1, { rotation: 90, flip: false });
    expect(rotated.x).toBe(U);
  });

  it("undoes itself over four quarter turns", () => {
    const quarter = { rotation: 90, flip: false } as const;
    let p = { x: 123, y: 456 };
    for (let i = 0; i < 4; i++) p = orientPoint(p, 1, quarter);
    expect(p.x).toBeCloseTo(123, 6);
    expect(p.y).toBeCloseTo(456, 6);
  });

  it("agrees with 90 applied three times for a 270 turn", () => {
    const quarter = { rotation: 90, flip: false } as const;
    const thrice = orientPoint(orientPoint(orientPoint({ x: 111, y: 222 }, 1, quarter), 1, quarter), 1, quarter);
    expect(orientPoint({ x: 111, y: 222 }, 1, { rotation: 270, flip: false })).toEqual(thrice);
  });
});

describe("orientAngleDeg", () => {
  it("adds the rotation", () => {
    expect(orientAngleDeg(0, { rotation: 90, flip: false })).toBe(90);
  });

  it("mirrors about the vertical axis on a flip — east becomes west, south stays south", () => {
    expect(orientAngleDeg(0, { rotation: 0, flip: true })).toBe(180);
    expect(orientAngleDeg(90, { rotation: 0, flip: true })).toBe(90);
  });
});

describe("orientMirrorsArc", () => {
  it("only reverses a fan's handedness when the tile is flipped", () => {
    expect(orientMirrorsArc({ rotation: 270, flip: false })).toBe(false);
    expect(orientMirrorsArc({ rotation: 0, flip: true })).toBe(true);
  });
});
