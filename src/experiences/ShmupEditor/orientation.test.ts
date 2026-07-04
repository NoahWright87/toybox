import { describe, it, expect } from "vitest";
import { applyOrientation, edgeTagsMatch, findAlignments, validOrientations } from "./orientation";
import { createBlankTile, edgeSlot } from "./types";
import type { TileDef } from "./types";

function tile(overrides: Partial<TileDef>): TileDef {
  return { ...createBlankTile(0), ...overrides };
}

describe("validOrientations", () => {
  it("offers 8 orientations for a 1x1 footprint", () => {
    expect(validOrientations(1)).toHaveLength(8);
  });

  it("offers only 4 orientations (0/180 x flip) for footprint > 1", () => {
    expect(validOrientations(2)).toHaveLength(4);
    for (const o of validOrientations(3)) expect([0, 180]).toContain(o.rotation);
  });
});

describe("applyOrientation", () => {
  const wide = tile({
    footprint: 2,
    north: [edgeSlot("A"), edgeSlot("B")],
    south: [edgeSlot("C"), edgeSlot("D")],
    east: edgeSlot("E"),
    west: edgeSlot("W"),
  });

  it("identity leaves edges unchanged", () => {
    const o = applyOrientation(wide, { rotation: 0, flip: false });
    expect(o.north.map((s) => s.tag)).toEqual(["A", "B"]);
    expect(o.south.map((s) => s.tag)).toEqual(["C", "D"]);
  });

  it("180deg swaps north/south (reversed) and east/west", () => {
    const o = applyOrientation(wide, { rotation: 180, flip: false });
    expect(o.north.map((s) => s.tag)).toEqual(["D", "C"]);
    expect(o.south.map((s) => s.tag)).toEqual(["B", "A"]);
    expect(o.east.tag).toBe("W");
    expect(o.west.tag).toBe("E");
  });

  it("flip reverses column order and swaps east/west", () => {
    const o = applyOrientation(wide, { rotation: 0, flip: true });
    expect(o.north.map((s) => s.tag)).toEqual(["B", "A"]);
    expect(o.east.tag).toBe("W");
    expect(o.west.tag).toBe("E");
  });
});

describe("edgeTagsMatch", () => {
  it("matches identical tags and rejects different ones", () => {
    expect(edgeTagsMatch("dirt", "dirt")).toBe(true);
    expect(edgeTagsMatch("dirt", "water")).toBe(false);
  });

  it("wildcard matches anything (connector tiles)", () => {
    expect(edgeTagsMatch("dirt", "*")).toBe(true);
  });
});

describe("findAlignments", () => {
  it("finds a matching aligned attachment between two 1x1 tiles sharing a tag", () => {
    const above = tile({ footprint: 1, north: [edgeSlot("dirt")] });
    const below = tile({ footprint: 1, south: [edgeSlot("dirt")] });
    const alignments = findAlignments(
      applyOrientation(above, { rotation: 0, flip: false }),
      applyOrientation(below, { rotation: 0, flip: false })
    );
    expect(alignments).toHaveLength(1);
    expect(alignments[0].allMatch).toBe(true);
  });

  it("reports a mismatch when tags differ", () => {
    const above = tile({ footprint: 1, north: [edgeSlot("dirt")] });
    const below = tile({ footprint: 1, south: [edgeSlot("water")] });
    const [alignment] = findAlignments(
      applyOrientation(above, { rotation: 0, flip: false }),
      applyOrientation(below, { rotation: 0, flip: false })
    );
    expect(alignment.allMatch).toBe(false);
  });

  it("never allows attachment against a hard-wall column, even if both sides literally say hardwall", () => {
    const above = tile({ footprint: 1, north: [edgeSlot("", true)] });
    const below = tile({ footprint: 1, south: [edgeSlot("", true)] });
    const [alignment] = findAlignments(
      applyOrientation(above, { rotation: 0, flip: false }),
      applyOrientation(below, { rotation: 0, flip: false })
    );
    expect(alignment.allMatch).toBe(false);
  });

  it("a wider tile can attach via just one matching column, sliding across every valid offset", () => {
    const above = tile({ footprint: 1, north: [edgeSlot("dirt")] });
    const below = tile({
      footprint: 2,
      south: [edgeSlot("dirt"), edgeSlot("anything")],
    });
    const alignments = findAlignments(
      applyOrientation(above, { rotation: 0, flip: false }),
      applyOrientation(below, { rotation: 0, flip: false })
    );
    // offset 0: below's col0 (dirt) over above's col0 (dirt) -> match on the only overlapping column.
    const zero = alignments.find((a) => a.offset === 0)!;
    expect(zero.allMatch).toBe(true);
    expect(zero.columns).toHaveLength(1);
  });
});
