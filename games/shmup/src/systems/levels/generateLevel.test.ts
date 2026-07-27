import { describe, it, expect } from "vitest";
import { generateLevel } from "./generateLevel";
import { HARDWALL } from "./types";
import type { TileDef } from "./types";

describe("generateLevel", () => {
  it("is deterministic: same tile set/seed always produces the same result", () => {
    const tiles: TileDef[] = [
      { id: "straight", footprint: 1, north: ["A"], south: ["A"], east: HARDWALL, west: HARDWALL },
      { id: "alt", footprint: 1, north: ["A"], south: ["A"], east: HARDWALL, west: HARDWALL, weight: 2 },
    ];
    const a = generateLevel(tiles, { seed: 42, startTag: "A", maxRows: 5, maxWidth: 4 });
    const b = generateLevel(tiles, { seed: 42, startTag: "A", maxRows: 5, maxWidth: 4 });
    expect(a).toEqual(b);
  });

  it("different seeds can pick different equally-weighted candidates", () => {
    const tiles: TileDef[] = [
      { id: "left", footprint: 1, north: ["A"], south: ["A"], east: HARDWALL, west: HARDWALL },
      { id: "right", footprint: 1, north: ["A"], south: ["A"], east: HARDWALL, west: HARDWALL },
    ];
    const results = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const result = generateLevel(tiles, { seed, startTag: "A", maxRows: 1, maxWidth: 4 });
      results.add(result.placedTiles[0].tileId);
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("a hard-wall slot narrows a physically-2-wide tile back to one open frontier (spec's 2x1 example)", () => {
    const tiles: TileDef[] = [
      // Occupies 2 columns (only one needs to match the incoming 1-wide frontier -- the
      // other lands on unclaimed space), but only one of its two north slots stays open.
      { id: "narrow", footprint: 2, north: ["mid", HARDWALL], south: ["start", "start"], east: HARDWALL, west: HARDWALL },
      // Heavily favored: "narrow"'s own north (rotated) can also re-match its own
      // "mid" output, same self-similarity every rotation-aware tile has against
      // its own emitted tags -- weight keeps this specific test deterministic.
      { id: "boss", footprint: 1, north: [HARDWALL], south: ["mid"], east: HARDWALL, west: HARDWALL, weight: 1000 },
    ];
    const result = generateLevel(tiles, { seed: 1, startTag: "start", maxRows: 2, maxWidth: 6 });

    const row0 = result.placedTiles.filter((t) => t.row === 0);
    expect(row0).toHaveLength(1);
    expect(row0[0].tileId).toBe("narrow");
    expect(row0[0].xEnd - row0[0].xStart).toBe(2); // physically 2 columns wide

    // Only one of those two columns produced a new frontier -- the level narrowed back to width 1.
    const row1 = result.placedTiles.filter((t) => t.row === 1);
    expect(row1).toHaveLength(1);
    expect(row1[0].tileId).toBe("boss");
    expect(row1[0].isDeadEnd).toBe(true);

    expect(result.openFrontiers).toHaveLength(0);
  });

  it("a single tile can consume two adjacent open frontiers at once (merge)", () => {
    const tiles: TileDef[] = [
      // Opens two DIFFERENT adjacent tags -- a later tile must match both positionally to attach here.
      { id: "opener", footprint: 2, north: ["L", "R"], south: ["start", "start"], east: HARDWALL, west: HARDWALL },
      { id: "merger", footprint: 2, north: ["done", "done"], south: ["L", "R"], east: HARDWALL, west: HARDWALL, weight: 1000 },
    ];
    const result = generateLevel(tiles, { seed: 4, startTag: "start", maxRows: 2, maxWidth: 6 });

    const row0 = result.placedTiles.filter((t) => t.row === 0);
    expect(row0).toHaveLength(1);
    const [rowZeroTile] = row0;

    // Whatever placed at row 1 must span BOTH columns row 0 opened in one placement -- a merge, not two separate ones.
    const row1 = result.placedTiles.filter((t) => t.row === 1);
    expect(row1).toHaveLength(1);
    expect(row1[0].xStart).toBe(rowZeroTile.xStart);
    expect(row1[0].xEnd).toBe(rowZeroTile.xEnd);
  });

  it("a tile with a gapped north edge splits one frontier into two independent ones", () => {
    const tiles: TileDef[] = [
      { id: "split", footprint: 3, north: ["A", HARDWALL, "B"], south: ["A", "A", "A"], east: HARDWALL, west: HARDWALL },
    ];
    const result = generateLevel(tiles, { seed: 7, startTag: "A", maxRows: 1, maxWidth: 6 });

    expect(result.placedTiles).toHaveLength(1);
    expect(result.openFrontiers).toHaveLength(2);
    const tags = result.openFrontiers.map((f) => f.tag).sort();
    expect(tags).toEqual(["A", "B"]);
    // The two new frontiers are not adjacent -- a genuine split, not just a wide opening.
    const columns = result.openFrontiers.map((f) => f.column).sort((a, b) => a - b);
    expect(columns[1] - columns[0]).toBeGreaterThan(1);
  });

  it("only matches via a rotation that actually aligns the tags (tries all valid orientations)", () => {
    // Unrotated this tile's south is "Z" (won't match the "A" frontier) but its
    // east edge is "A" -- a single 90deg clockwise rotation moves east into
    // the south slot (only rotation that does, for this tile's four distinct tags).
    const tiles: TileDef[] = [{ id: "rotated", footprint: 1, north: ["N"], south: ["Z"], east: "A", west: "W" }];
    const result = generateLevel(tiles, { seed: 3, startTag: "A", maxRows: 1, maxWidth: 4 });

    expect(result.placedTiles).toHaveLength(1);
    expect(result.placedTiles[0].tileId).toBe("rotated");
    expect(result.placedTiles[0].orientation.rotation).toBe(90);
  });

  it("rejects a placement that would extend past maxWidth", () => {
    const tiles: TileDef[] = [
      { id: "wide", footprint: 3, north: ["A", "A", "A"], south: ["A", "A", "A"], east: HARDWALL, west: HARDWALL },
      { id: "narrow", footprint: 1, north: ["A"], south: ["A"], east: HARDWALL, west: HARDWALL },
    ];
    // Starting one column from the right edge of a width-2 playfield leaves no room for the footprint-3 tile.
    const result = generateLevel(tiles, { seed: 5, startTag: "A", startColumn: 1, maxRows: 1, maxWidth: 2 });

    expect(result.placedTiles).toHaveLength(1);
    expect(result.placedTiles[0].tileId).toBe("narrow");
  });

  it("stops a branch (no new frontiers) once a dead-end tile is placed, regardless of remaining maxRows", () => {
    const tiles: TileDef[] = [{ id: "boss", footprint: 1, north: [HARDWALL], south: ["A"], east: HARDWALL, west: HARDWALL }];
    const result = generateLevel(tiles, { seed: 9, startTag: "A", maxRows: 10, maxWidth: 4 });

    expect(result.placedTiles).toHaveLength(1);
    expect(result.placedTiles[0].isDeadEnd).toBe(true);
    expect(result.openFrontiers).toHaveLength(0);
  });

  it("surfaces frontiers still open at the maxRows horizon (not yet terminated by a dead end)", () => {
    const tiles: TileDef[] = [{ id: "straight", footprint: 1, north: ["A"], south: ["A"], east: HARDWALL, west: HARDWALL }];
    const result = generateLevel(tiles, { seed: 2, startTag: "A", maxRows: 3, maxWidth: 4 });

    expect(result.placedTiles).toHaveLength(3);
    expect(result.openFrontiers).toHaveLength(1);
    expect(result.openFrontiers[0].row).toBe(3);
  });
});
