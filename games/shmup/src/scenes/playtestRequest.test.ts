import { describe, expect, it } from "vitest";
import { PLAYTEST_DEFAULT_DIFFICULTY, parsePlaytestRequest } from "./playtestRequest";

describe("parsePlaytestRequest", () => {
  it("reads an encounter request", () => {
    expect(parsePlaytestRequest("?playtest=encounter&tile=t1&encounter=e1&difficulty=25")).toEqual({
      kind: "encounter",
      tileId: "t1",
      encounterId: "e1",
      difficulty: 25,
    });
  });

  it("reads a level request, which carries no ids — it plays whatever LEVEL.DAT holds", () => {
    expect(parsePlaytestRequest("?playtest=level&difficulty=7")).toEqual({ kind: "level", difficulty: 7 });
  });

  it("is null for an ordinary launch", () => {
    expect(parsePlaytestRequest("")).toBeNull();
    expect(parsePlaytestRequest("?something=else")).toBeNull();
  });

  it("rejects an encounter request missing its ids rather than half-running it", () => {
    expect(parsePlaytestRequest("?playtest=encounter&tile=t1")).toBeNull();
    expect(parsePlaytestRequest("?playtest=encounter&encounter=e1")).toBeNull();
  });
});

describe("difficulty parsing", () => {
  it("falls back when the parameter is absent, rather than reading as zero", () => {
    // `Number(null)` is 0, so a naive parse turns "no difficulty given" into
    // Difficulty 0 — which spawns nothing at all (`scaling.ts`) and looks
    // exactly like broken content.
    expect(parsePlaytestRequest("?playtest=level")).toEqual({ kind: "level", difficulty: PLAYTEST_DEFAULT_DIFFICULTY });
  });

  it("falls back on an empty or unparseable value", () => {
    expect(parsePlaytestRequest("?playtest=level&difficulty=")).toEqual({ kind: "level", difficulty: PLAYTEST_DEFAULT_DIFFICULTY });
    expect(parsePlaytestRequest("?playtest=level&difficulty=abc")).toEqual({ kind: "level", difficulty: PLAYTEST_DEFAULT_DIFFICULTY });
    expect(parsePlaytestRequest("?playtest=level&difficulty=-5")).toEqual({ kind: "level", difficulty: PLAYTEST_DEFAULT_DIFFICULTY });
  });

  it("honours an explicit zero — 'spawns nothing' is a legitimate thing to want to see", () => {
    expect(parsePlaytestRequest("?playtest=level&difficulty=0")).toEqual({ kind: "level", difficulty: 0 });
  });

  it("never defaults to zero itself", () => {
    expect(PLAYTEST_DEFAULT_DIFFICULTY).toBeGreaterThan(0);
  });
});
