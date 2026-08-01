import { describe, expect, it } from "vitest";
import { shouldCull } from "./EncounterRunner";
import { TUNING } from "../../tuning";

/**
 * Regression cover for the cull rule. The bug this pins: a placed instance used
 * to be culled on `offScreen && pathOver`, and `pathOver` is trivially true for
 * a stationary or single-step unit — a Turret's one step sits at time 0, so its
 * path is "over" on frame 1. Every scaling slot that happened to start outside
 * the viewport was therefore recycled immediately, which is why a `maxCount: 30`
 * turret group only put a handful on the field, and why adding a spawn delay
 * appeared to fix it (staggering meant each slot was already on screen by the
 * time it spawned, rather than changing how many were resolved).
 */
describe("shouldCull", () => {
  const placed = { placed: true, offScreen: true, seenOnScreen: false, ageSec: 0.016, pathOver: true };

  it("keeps a placed instance that has never been on screen, even once its path is over", () => {
    // The exact case that ate 26 of 30 turrets.
    expect(shouldCull(placed)).toBe(false);
  });

  it("keeps a stationary instance waiting off screen for the level to scroll to it", () => {
    expect(shouldCull({ ...placed, ageSec: 5, pathOver: true })).toBe(false);
  });

  it("culls a placed instance once it has been seen and has left again", () => {
    expect(shouldCull({ ...placed, seenOnScreen: true })).toBe(true);
  });

  it("keeps a seen instance that is off screen but still mid-path", () => {
    // An authored path may loop out of view and come back.
    expect(shouldCull({ ...placed, seenOnScreen: true, pathOver: false })).toBe(false);
  });

  it("keeps a seen instance that is still on screen", () => {
    expect(shouldCull({ ...placed, seenOnScreen: true, offScreen: false })).toBe(false);
  });

  it("eventually culls a placed instance the scroll never reaches, so it can't hold a pool slot", () => {
    expect(shouldCull({ ...placed, ageSec: TUNING.encounters.placedUnseenLifespanSec + 1 })).toBe(true);
  });

  it("culls a spawned instance as soon as it leaves the screen", () => {
    expect(shouldCull({ placed: false, offScreen: true, seenOnScreen: false, ageSec: 0.1, pathOver: false })).toBe(true);
  });

  it("culls a spawned instance that overstays on screen", () => {
    const ageSec = TUNING.encounters.spawnedLifespanSec + 1;
    expect(shouldCull({ placed: false, offScreen: false, seenOnScreen: true, ageSec, pathOver: false })).toBe(true);
  });
});
