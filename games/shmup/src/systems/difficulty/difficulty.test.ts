import { describe, it, expect } from "vitest";
import { computeDifficulty } from "./difficulty";
import { TUNING } from "../../tuning";

describe("computeDifficulty", () => {
  it("equals seasonBase at episodeIndex=0, no offsets, no mapLag", () => {
    expect(computeDifficulty({ season: 1, episodeIndex: 0, mapLag: 0 })).toBe(TUNING.difficulty.seasonBase[0]);
    expect(computeDifficulty({ season: 3, episodeIndex: 0, mapLag: 0 })).toBe(TUNING.difficulty.seasonBase[2]);
  });

  it("climbs through a Season via episodeRamp * episodeIndex", () => {
    const d0 = computeDifficulty({ season: 1, episodeIndex: 0, mapLag: 0 });
    const d5 = computeDifficulty({ season: 1, episodeIndex: 5, mapLag: 0 });
    expect(d5 - d0).toBeCloseTo(TUNING.difficulty.episodeRamp * 5, 10);
  });

  it("stageOffset and itemModifiers add flat D (special nodes can go negative)", () => {
    const base = computeDifficulty({ season: 2, episodeIndex: 0, mapLag: 0 });
    const withOffset = computeDifficulty({ season: 2, episodeIndex: 0, mapLag: 0, stageOffset: -2, itemModifiers: 1 });
    expect(withOffset).toBeCloseTo(base - 1, 10);
  });

  it("mapLag adds D via deadlinePenalty, and mapLag=0 while ahead of the deadline", () => {
    const behind = computeDifficulty({ season: 1, episodeIndex: 0, mapLag: 3 });
    const ahead = computeDifficulty({ season: 1, episodeIndex: 0, mapLag: 0 });
    expect(behind - ahead).toBeCloseTo(TUNING.difficulty.deadlinePenalty * 3, 10);
  });

  it("never goes negative even with large negative offsets", () => {
    expect(computeDifficulty({ season: 1, episodeIndex: 0, mapLag: 0, stageOffset: -1000 })).toBe(0);
  });

  it("clamps season index into the seasonBase table (Syndication reuses the last Season's base)", () => {
    expect(computeDifficulty({ season: 99, episodeIndex: 0, mapLag: 0 })).toBe(
      TUNING.difficulty.seasonBase[TUNING.difficulty.seasonBase.length - 1]
    );
  });
});
