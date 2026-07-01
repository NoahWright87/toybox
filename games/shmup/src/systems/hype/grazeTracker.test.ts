import { describe, it, expect } from "vitest";
import { GrazeTracker } from "./grazeTracker";
import type { GrazeRingDef } from "./types";

const RING_A: GrazeRingDef = { frac: 1.0, mult: 1 };
const RING_B: GrazeRingDef = { frac: 0.25, mult: 4 };

describe("GrazeTracker", () => {
  it("emits a start event the first frame an id is grazed", () => {
    const tracker = new GrazeTracker();
    const result = tracker.update(new Map([[1, RING_A]]));
    expect(result.events).toEqual([{ type: "start", id: 1, ring: RING_A, streak: 1 }]);
    expect(result.streak).toBe(1);
    expect(result.totalMult).toBe(1);
  });

  it("emits no events on a frame where nothing changed", () => {
    const tracker = new GrazeTracker();
    tracker.update(new Map([[1, RING_A]]));
    const result = tracker.update(new Map([[1, RING_A]]));
    expect(result.events).toEqual([]);
    expect(result.streak).toBe(1);
  });

  it("emits an end event when an id drops out", () => {
    const tracker = new GrazeTracker();
    tracker.update(new Map([[1, RING_A]]));
    const result = tracker.update(new Map());
    expect(result.events).toEqual([{ type: "end", id: 1, streak: 0 }]);
    expect(result.streak).toBe(0);
  });

  it("tracks multiple simultaneous grazes as an additive streak/totalMult", () => {
    const tracker = new GrazeTracker();
    const result = tracker.update(
      new Map([
        [1, RING_A],
        [2, RING_B],
      ])
    );
    expect(result.streak).toBe(2);
    expect(result.totalMult).toBe(5);
    expect(result.events).toHaveLength(2);
  });

  it("re-grazing a recycled spawnId after an end is treated as a fresh start", () => {
    const tracker = new GrazeTracker();
    tracker.update(new Map([[1, RING_A]]));
    tracker.update(new Map());
    const result = tracker.update(new Map([[1, RING_B]]));
    expect(result.events).toEqual([{ type: "start", id: 1, ring: RING_B, streak: 1 }]);
  });

  it("reset() clears tracked state so the next update treats everything as new", () => {
    const tracker = new GrazeTracker();
    tracker.update(new Map([[1, RING_A]]));
    tracker.reset();
    const result = tracker.update(new Map([[1, RING_A]]));
    expect(result.events).toEqual([{ type: "start", id: 1, ring: RING_A, streak: 1 }]);
  });
});
