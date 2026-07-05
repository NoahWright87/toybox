import { describe, it, expect } from "vitest";
import { canDeleteEntry, candidatesForAddPoint, computeAddPoints, orientationValidAt, touchingEntries, type GridEntry } from "./connectionGrid";
import { createBlankTile, edgeSlot } from "./types";
import type { TileDef } from "./types";

const IDENTITY = { rotation: 0 as const, flip: false };

function tile(overrides: Partial<TileDef>): TileDef {
  return { ...createBlankTile(0), ...overrides };
}

function entry(t: TileDef, row: number, col: number, key = t.id): GridEntry {
  return { key, tile: t, orientation: IDENTITY, row, col };
}

describe("computeAddPoints", () => {
  it("offers one add point per open side for a lone 1x1 tile with no hardwalls", () => {
    const t = tile({ footprint: 1, north: [edgeSlot("a")], south: [edgeSlot("a")], east: edgeSlot("a"), west: edgeSlot("a") });
    const points = computeAddPoints([entry(t, 0, 0)]);
    const sides = points.map((p) => p.side).sort();
    expect(sides).toEqual(["east", "north", "south", "west"]);
  });

  it("offers no add point on a hard-wall side", () => {
    const t = tile({ footprint: 1, north: [edgeSlot("a")], south: [edgeSlot("a")], east: edgeSlot("", true), west: edgeSlot("", true) });
    const points = computeAddPoints([entry(t, 0, 0)]);
    expect(points.map((p) => p.side).sort()).toEqual(["north", "south"]);
  });

  it("splits a wide tile's north side into two separate add points around a hard-wall gap", () => {
    const t = tile({
      footprint: 3,
      north: [edgeSlot("a"), edgeSlot("", true), edgeSlot("a")],
      south: [edgeSlot("a"), edgeSlot("a"), edgeSlot("a")],
      east: edgeSlot("", true),
      west: edgeSlot("", true),
    });
    const points = computeAddPoints([entry(t, 0, 0)]).filter((p) => p.side === "north");
    expect(points).toHaveLength(2);
    expect(points.map((p) => [p.colStart, p.colEnd]).sort()).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });

  it("does not offer an add point where a neighbor is already placed", () => {
    const a = tile({ footprint: 1, north: [edgeSlot("a")], south: [edgeSlot("a")], east: edgeSlot("", true), west: edgeSlot("", true) });
    const b = tile({ footprint: 1, north: [edgeSlot("a")], south: [edgeSlot("a")], east: edgeSlot("", true), west: edgeSlot("", true) });
    const points = computeAddPoints([entry(a, 0, 0, "a"), entry(b, -1, 0, "b")]);
    // a's north is occupied by b now; only a's south and b's north should remain.
    expect(points.some((p) => p.entryKey === "a" && p.side === "north")).toBe(false);
    expect(points.some((p) => p.entryKey === "a" && p.side === "south")).toBe(true);
    expect(points.some((p) => p.entryKey === "b" && p.side === "north")).toBe(true);
  });
});

describe("candidatesForAddPoint", () => {
  it("places a matching tile directly above (north), offset 0, for two same-width tiles", () => {
    const anchor = tile({ footprint: 1, north: [edgeSlot("sky")], south: [edgeSlot("ground")] });
    const match = tile({ footprint: 1, north: [edgeSlot("x")], south: [edgeSlot("sky")] });
    const nomatch = tile({ footprint: 1, north: [edgeSlot("x")], south: [edgeSlot("other")] });
    const entries = [entry(anchor, 0, 0)];
    const points = computeAddPoints(entries).filter((p) => p.side === "north");
    expect(points).toHaveLength(1);
    const candidates = candidatesForAddPoint([anchor, match, nomatch], entries, points[0]);
    expect(candidates.map((c) => c.tile.id)).toContain(match.id);
    expect(candidates.map((c) => c.tile.id)).not.toContain(nomatch.id);
    const placedMatch = candidates.find((c) => c.tile.id === match.id)!;
    expect(placedMatch.row).toBe(-1);
    expect(placedMatch.col).toBe(0);
  });

  it("aligns a narrower tile to the matching column of a wider one, not the center", () => {
    // anchor is 3-wide: north = [wall, open("dirt"), wall] — only column 1 can accept a neighbor above.
    const anchor = tile({
      footprint: 3,
      north: [edgeSlot("", true), edgeSlot("dirt"), edgeSlot("", true)],
      south: [edgeSlot("a"), edgeSlot("a"), edgeSlot("a")],
    });
    const narrow = tile({ footprint: 1, south: [edgeSlot("dirt")] });
    const entries = [entry(anchor, 0, 0)];
    const points = computeAddPoints(entries).filter((p) => p.side === "north");
    expect(points).toHaveLength(1);
    expect(points[0].colStart).toBe(1);
    expect(points[0].colEnd).toBe(1);
    const candidates = candidatesForAddPoint([narrow], entries, points[0]);
    expect(candidates).toHaveLength(1);
    // The narrow tile's single column must land exactly on absolute column 1, not centered (e.g. column 0 or 2).
    expect(candidates[0].col).toBe(1);
  });

  it("matches east/west by simple tag equality, positioned immediately adjacent", () => {
    const anchor = tile({ footprint: 1, east: edgeSlot("road"), west: edgeSlot("", true), north: [edgeSlot("a")], south: [edgeSlot("a")] });
    const match = tile({ footprint: 1, west: edgeSlot("road"), north: [edgeSlot("b")], south: [edgeSlot("b")] });
    const entries = [entry(anchor, 0, 0)];
    const points = computeAddPoints(entries).filter((p) => p.side === "east");
    expect(points).toHaveLength(1);
    const candidates = candidatesForAddPoint([match], entries, points[0]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].row).toBe(0);
    expect(candidates[0].col).toBe(1);
  });

  it("skips a placement that would land on an already-occupied cell", () => {
    const anchor = tile({ footprint: 1, north: [edgeSlot("sky")] });
    const already = tile({ footprint: 1, south: [edgeSlot("anything")] });
    const match = tile({ footprint: 1, south: [edgeSlot("sky")] });
    const entries = [entry(anchor, 0, 0, "anchor"), entry(already, -1, 0, "already")];
    // No north add point should even exist since the cell is occupied.
    const points = computeAddPoints(entries).filter((p) => p.entryKey === "anchor" && p.side === "north");
    expect(points).toHaveLength(0);
    // And even if we ask directly, nothing should be offered onto an occupied cell.
    const candidates = candidatesForAddPoint([match], entries, { key: "x", entryKey: "anchor", side: "north", colStart: 0, colEnd: 0, row: -1 });
    expect(candidates).toHaveLength(0);
  });
});

describe("touchingEntries / orientationValidAt / canDeleteEntry", () => {
  it("finds vertical and horizontal neighbors correctly", () => {
    const center = tile({ footprint: 1, north: [edgeSlot("n")], south: [edgeSlot("s")], east: edgeSlot("e"), west: edgeSlot("w") });
    const north = tile({ footprint: 1, south: [edgeSlot("n")] });
    const east = tile({ footprint: 1, west: edgeSlot("e") });
    const entries = [entry(center, 0, 0, "center"), entry(north, -1, 0, "north"), entry(east, 0, 1, "east")];
    const touching = touchingEntries(entries, "center").map((e) => e.key).sort();
    expect(touching).toEqual(["east", "north"]);
  });

  it("a leaf (<=1 neighbor) can be deleted; a tile with 2+ neighbors cannot", () => {
    const center = tile({ footprint: 1, north: [edgeSlot("n")], south: [edgeSlot("s")] });
    const north = tile({ footprint: 1, south: [edgeSlot("n")] });
    const south = tile({ footprint: 1, north: [edgeSlot("s")] });
    const entries = [entry(center, 0, 0, "center"), entry(north, -1, 0, "north"), entry(south, 1, 0, "south")];
    expect(canDeleteEntry(entries, "center")).toBe(false);
    expect(canDeleteEntry(entries, "north")).toBe(true);
    expect(canDeleteEntry(entries, "south")).toBe(true);
  });

  it("rejects a rotation that would break an existing neighbor connection", () => {
    // 1x1 tiles only rotate in place (footprint unchanged), so rotating 180 swaps north/south tags.
    const center = tile({ footprint: 1, north: [edgeSlot("n")], south: [edgeSlot("s")] });
    const north = tile({ footprint: 1, south: [edgeSlot("n")] });
    const entries = [entry(center, 0, 0, "center"), entry(north, -1, 0, "north")];
    // Identity still connects (north tag "n" matches).
    expect(orientationValidAt(entries, "center", IDENTITY)).toBe(true);
    // Rotating 180 swaps center's north/south -> its north becomes "s", no longer matching neighbor's south "n".
    expect(orientationValidAt(entries, "center", { rotation: 180, flip: false })).toBe(false);
  });
});
