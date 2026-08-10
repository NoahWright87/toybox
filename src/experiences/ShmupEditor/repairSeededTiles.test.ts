import { describe, expect, it } from "vitest";
import { createDefaultTileLibrary, edgeSlot, repairSeededTiles, slotTag, type TileDef } from "./types";

/**
 * Two seeded tiles shipped with edge tags that contradicted their own art:
 * Road (Curve) claimed a road continued north where the art shows grass, and
 * "Grass / Sand" was rocky scrubland tagged as sand. Both are matcher-visible
 * bugs — they let the generator butt tiles together at seams that read as
 * obviously wrong — so these tests pin the corrected seed *and* the repair
 * that reaches libraries already saved with the old values.
 */

function seeded(name: string): TileDef {
  const tile = createDefaultTileLibrary().find((t) => t.name === name);
  if (!tile) throw new Error(`no seeded tile named ${name}`);
  return tile;
}

describe("seeded tile tags match their art", () => {
  it("routes Road (Curve) south-to-east, not south-to-north", () => {
    const curve = seeded("Road (Curve)");
    expect(slotTag(curve.south[0])).toBe("grass-road");
    expect(slotTag(curve.east)).toBe("grass-road");
    // The two the bug got wrong: the art is plain grass on both.
    expect(slotTag(curve.north[0])).toBe("grass");
    expect(slotTag(curve.west)).toBe("grass");
  });

  it("leaves Road (Straight) continuing north/south", () => {
    const straight = seeded("Road (Straight)");
    expect(slotTag(straight.north[0])).toBe("grass-road");
    expect(slotTag(straight.south[0])).toBe("grass-road");
    expect(slotTag(straight.east)).toBe("grass");
  });

  it("names and tags the rocky transition as rocky", () => {
    const rocky = seeded("Grass / Rocky");
    expect(slotTag(rocky.north[0])).toBe("rocky");
    expect(slotTag(rocky.south[0])).toBe("grass");
    // The art id keeps its original spelling — ids are stored references.
    expect(rocky.imageId).toBe("grass-sand");
  });

  it("keeps the genuine grass/sand transition tagged sand", () => {
    const sand = seeded("Grass / Sand (Natural)");
    expect(slotTag(sand.north[0])).toBe("sand");
    expect(sand.imageId).toBe("grass-sand-natural");
  });
});

describe("repairSeededTiles", () => {
  /** Road (Curve) as it was stored before the fix — Road (Straight)'s edges. */
  function staleCurve(overrides: Partial<TileDef> = {}): TileDef {
    return {
      ...seeded("Road (Curve)"),
      north: [edgeSlot("grass-road")],
      south: [edgeSlot("grass-road")],
      east: edgeSlot("grass"),
      west: edgeSlot("grass"),
      ...overrides,
    };
  }

  /** "Grass / Sand" as it was stored before the fix. */
  function staleRocky(overrides: Partial<TileDef> = {}): TileDef {
    return { ...seeded("Grass / Rocky"), name: "Grass / Sand", north: [edgeSlot("sand")], ...overrides };
  }

  it("re-routes a stale Road (Curve)", () => {
    const [fixed] = repairSeededTiles([staleCurve()]);
    expect(slotTag(fixed.north[0])).toBe("grass");
    expect(slotTag(fixed.south[0])).toBe("grass-road");
    expect(slotTag(fixed.east)).toBe("grass-road");
    expect(slotTag(fixed.west)).toBe("grass");
  });

  it("renames and retags a stale Grass / Sand", () => {
    const [fixed] = repairSeededTiles([staleRocky()]);
    expect(fixed.name).toBe("Grass / Rocky");
    expect(slotTag(fixed.north[0])).toBe("rocky");
    expect(slotTag(fixed.south[0])).toBe("grass");
  });

  it("never touches a tile the user renamed", () => {
    const mine = staleCurve({ name: "My Curve" });
    expect(repairSeededTiles([mine])[0]).toEqual(mine);
  });

  it("never touches a tile the user retagged, even partially", () => {
    // Someone who already fixed the north edge by hand — but chose `dirt`
    // rather than what the seed would have written. Overwriting that would
    // silently undo their authoring.
    const mine = staleCurve({ north: [edgeSlot("dirt")] });
    expect(repairSeededTiles([mine])[0]).toEqual(mine);
  });

  it("never touches a user tile built on the same art", () => {
    const mine = staleRocky({ name: "My Scrubland" });
    expect(repairSeededTiles([mine])[0]).toEqual(mine);
  });

  it("leaves every other seeded tile alone", () => {
    const others = createDefaultTileLibrary().filter((t) => t.name !== "Road (Curve)" && t.name !== "Grass / Rocky");
    expect(repairSeededTiles(others)).toEqual(others);
  });

  it("is idempotent — a freshly seeded library is already correct", () => {
    const fresh = createDefaultTileLibrary();
    expect(repairSeededTiles(fresh)).toEqual(fresh);
  });
});
