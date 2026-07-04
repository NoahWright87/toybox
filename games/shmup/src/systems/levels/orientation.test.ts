import { describe, it, expect } from "vitest";
import { applyOrientation, edgeTagsMatch, validOrientations } from "./orientation";
import { HARDWALL, WILDCARD } from "./types";
import type { TileDef } from "./types";

describe("validOrientations", () => {
  it("offers all 4 rotations x flip (8 orientations) for a 1x1 footprint", () => {
    expect(validOrientations(1)).toHaveLength(8);
  });

  it("offers only 0/180 rotations x flip (4 orientations) for footprint > 1", () => {
    expect(validOrientations(2)).toHaveLength(4);
    expect(validOrientations(3)).toHaveLength(4);
    for (const o of validOrientations(2)) expect([0, 180]).toContain(o.rotation);
  });
});

describe("applyOrientation", () => {
  const wide: TileDef = { id: "wide", footprint: 2, north: ["A", "B"], south: ["C", "D"], east: "E", west: "W" };

  it("identity (0deg, no flip) leaves edges unchanged", () => {
    const oriented = applyOrientation(wide, { rotation: 0, flip: false });
    expect(oriented).toEqual({ footprint: 2, north: ["A", "B"], south: ["C", "D"], east: "E", west: "W" });
  });

  it("180deg swaps north/south (reversed) and east/west", () => {
    const oriented = applyOrientation(wide, { rotation: 180, flip: false });
    expect(oriented).toEqual({ footprint: 2, north: ["D", "C"], south: ["B", "A"], east: "W", west: "E" });
  });

  it("horizontal flip reverses north/south column order and swaps east/west", () => {
    const oriented = applyOrientation(wide, { rotation: 0, flip: true });
    expect(oriented).toEqual({ footprint: 2, north: ["B", "A"], south: ["D", "C"], east: "W", west: "E" });
  });

  it("90deg on a 1x1 tile cycles west->north, north->east, east->south, south->west", () => {
    const square: TileDef = { id: "square", footprint: 1, north: ["N"], south: ["S"], east: "E", west: "W" };
    const oriented = applyOrientation(square, { rotation: 90, flip: false });
    expect(oriented).toEqual({ footprint: 1, north: ["W"], south: ["E"], east: "N", west: "S" });
  });

  it("four 90deg rotations return to the original edges", () => {
    const square: TileDef = { id: "square", footprint: 1, north: ["N"], south: ["S"], east: "E", west: "W" };
    let current: TileDef = square;
    for (let i = 0; i < 4; i++) {
      const oriented = applyOrientation(current, { rotation: 90, flip: false });
      current = { id: "square", ...oriented };
    }
    expect(current).toEqual(square);
  });

  it("270deg matches three consecutive 90deg rotations", () => {
    const square: TileDef = { id: "square", footprint: 1, north: ["N"], south: ["S"], east: "E", west: "W" };
    const via270 = applyOrientation(square, { rotation: 270, flip: false });

    let current: TileDef = square;
    for (let i = 0; i < 3; i++) {
      const oriented = applyOrientation(current, { rotation: 90, flip: false });
      current = { id: "square", ...oriented };
    }
    expect(via270).toEqual({ footprint: current.footprint, north: current.north, south: current.south, east: current.east, west: current.west });
  });
});

describe("edgeTagsMatch", () => {
  it("matches identical tags", () => {
    expect(edgeTagsMatch("dirt", "dirt")).toBe(true);
  });

  it("rejects different tags", () => {
    expect(edgeTagsMatch("dirt", "water")).toBe(false);
  });

  it("wildcard matches any frontier tag", () => {
    expect(edgeTagsMatch("dirt", WILDCARD)).toBe(true);
    expect(edgeTagsMatch(HARDWALL, WILDCARD)).toBe(true);
  });
});
