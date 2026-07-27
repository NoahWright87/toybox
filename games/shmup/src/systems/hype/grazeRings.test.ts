import { describe, it, expect } from "vitest";
import { grazeRingAt, grazeHypeGainPerSecond } from "./grazeRings";
import { TUNING } from "../../tuning";

const RINGS = TUNING.graze.rings;

describe("grazeRingAt", () => {
  it("returns the innermost (highest-mult) ring when within all of them", () => {
    const ring = grazeRingAt(10, 100, RINGS);
    expect(ring?.mult).toBe(4);
  });

  it("returns a mid ring when outside the innermost but inside a middle one", () => {
    const ring = grazeRingAt(40, 100, RINGS);
    expect(ring?.mult).toBe(2);
  });

  it("returns the outermost ring at the edge of grazeRadius", () => {
    const ring = grazeRingAt(99, 100, RINGS);
    expect(ring?.mult).toBe(1);
  });

  it("returns undefined outside every ring", () => {
    expect(grazeRingAt(150, 100, RINGS)).toBeUndefined();
  });

  it("returns undefined for a non-positive grazeRadius", () => {
    expect(grazeRingAt(0, 0, RINGS)).toBeUndefined();
  });

  it("never stacks -- a point inside multiple rings only returns one", () => {
    const ring = grazeRingAt(5, 100, RINGS);
    expect([1, 2, 4]).toContain(ring?.mult);
    // exactly one ring def returned, not a combined value
    expect(typeof ring?.mult).toBe("number");
  });
});

describe("grazeHypeGainPerSecond", () => {
  it("scales the base rate by ring mult and grazeMultiplier stat", () => {
    const ring = { frac: 0.25, mult: 4 };
    expect(grazeHypeGainPerSecond(ring, 2, 10)).toBe(80);
  });

  it("grazeMultiplier of 1 (the stat's base) leaves ring mult untouched", () => {
    const ring = { frac: 1.0, mult: 1 };
    expect(grazeHypeGainPerSecond(ring, 1, 18)).toBe(18);
  });
});
