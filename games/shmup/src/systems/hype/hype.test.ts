import { describe, it, expect } from "vitest";
import { hypeMax, gainHype, decayHype, scoreMult } from "./hype";
import { TUNING } from "../../tuning";
import type { HypeState } from "./types";

describe("hypeMax", () => {
  it("scales with crowd size and item mods", () => {
    expect(hypeMax(1)).toBe(TUNING.hype.base);
    expect(hypeMax(3)).toBe(TUNING.hype.base * 3);
    expect(hypeMax(1, 2)).toBe(TUNING.hype.base * 2);
  });
});

describe("gainHype", () => {
  it("adds eventValue x hypeGainMods and resets idleTimeSec", () => {
    const state: HypeState = { hype: 10, idleTimeSec: 5 };
    const next = gainHype(state, 20, 100, 1);
    expect(next.hype).toBe(30);
    expect(next.idleTimeSec).toBe(0);
  });

  it("clamps to hypeMaxValue", () => {
    const state: HypeState = { hype: 90, idleTimeSec: 0 };
    const next = gainHype(state, 50, 100);
    expect(next.hype).toBe(100);
  });

  it("does not mutate the input state", () => {
    const state: HypeState = { hype: 10, idleTimeSec: 5 };
    gainHype(state, 20, 100);
    expect(state).toEqual({ hype: 10, idleTimeSec: 5 });
  });
});

describe("decayHype", () => {
  it("decays faster the longer idleTimeSec has accumulated (super-linear)", () => {
    const fresh: HypeState = { hype: 50, idleTimeSec: 0 };
    const stale: HypeState = { hype: 50, idleTimeSec: 10 };
    const afterFresh = decayHype(fresh, 1, 100);
    const afterStale = decayHype(stale, 1, 100);
    expect(afterStale.hype).toBeLessThan(afterFresh.hype);
  });

  it("never drops below 0", () => {
    const state: HypeState = { hype: 1, idleTimeSec: 100 };
    const next = decayHype(state, 10, 100);
    expect(next.hype).toBe(0);
  });

  it("idleTimeSec accumulates by dt", () => {
    const state: HypeState = { hype: 50, idleTimeSec: 2 };
    const next = decayHype(state, 0.5, 100);
    expect(next.idleTimeSec).toBe(2.5);
  });

  it("returns zero hype with no decay-by-zero crash when hypeMaxValue is 0", () => {
    const state: HypeState = { hype: 0, idleTimeSec: 0 };
    const next = decayHype(state, 1, 0);
    expect(next.hype).toBe(0);
    expect(Number.isFinite(next.idleTimeSec)).toBe(true);
  });
});

describe("scoreMult", () => {
  it("is 1 at zero Hype", () => {
    expect(scoreMult(0, 100)).toBe(1);
  });

  it("is 1 + M at full Hype", () => {
    expect(scoreMult(100, 100)).toBeCloseTo(1 + TUNING.hype.scoreMultDepth, 10);
  });

  it("is linear between 0 and HypeMax", () => {
    expect(scoreMult(50, 100)).toBeCloseTo(1 + 0.5 * TUNING.hype.scoreMultDepth, 10);
  });

  it("defaults to 1 when hypeMaxValue is 0 (avoids divide-by-zero)", () => {
    expect(scoreMult(0, 0)).toBe(1);
  });
});
