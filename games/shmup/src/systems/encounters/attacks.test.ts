import { describe, expect, it } from "vitest";
import { burstCount, burstStartMs, dueShots, isTelegraphing, shotAngleOffsets, sweepOffsetDeg } from "./attacks";
import type { AuthoredAttack } from "./authoredTypes";

function attack(overrides: Partial<AuthoredAttack> = {}): AuthoredAttack {
  return {
    arcStartDeg: 0,
    arcEndDeg: 0,
    count: 1,
    spacing: "even",
    perShotDelayMs: 0,
    sweepSpeedDeg: 0,
    pingPong: false,
    burstIntervalMs: 1000,
    telegraphMs: 0,
    repeatCount: null,
    spawnUnitId: "unit-bullet",
    spawnScale: 1,
    spawnGroup: "enemyProjectile",
    ...overrides,
  };
}

describe("shotAngleOffsets", () => {
  it("centres a single shot in its arc", () => {
    expect(shotAngleOffsets(attack({ count: 1, arcStartDeg: -30, arcEndDeg: 30 }))).toEqual([0]);
  });

  it("spreads an even fan across the whole arc, endpoints included", () => {
    expect(shotAngleOffsets(attack({ count: 3, arcStartDeg: -30, arcEndDeg: 30 }))).toEqual([-30, 0, 30]);
  });

  it("keeps random spacing stable across calls, so an arc is an authored layout and not per-frame jitter", () => {
    const a = attack({ count: 5, arcStartDeg: 0, arcEndDeg: 90, spacing: "random" });
    expect(shotAngleOffsets(a)).toEqual(shotAngleOffsets(a));
  });

  it("fires nothing at a count of zero", () => {
    expect(shotAngleOffsets(attack({ count: 0 }))).toEqual([]);
  });
});

describe("burstCount", () => {
  it("repeats forever when repeatCount is null", () => {
    expect(burstCount(attack({ repeatCount: null }))).toBe(Infinity);
  });

  it("honours a finite repeat count", () => {
    expect(burstCount(attack({ repeatCount: 3 }))).toBe(3);
  });

  it("collapses to one burst at a zero interval, since repeating at zero has no meaning", () => {
    expect(burstCount(attack({ repeatCount: null, burstIntervalMs: 0 }))).toBe(1);
  });
});

describe("burstStartMs", () => {
  it("offsets the first burst by the telegraph wind-up", () => {
    expect(burstStartMs(attack({ telegraphMs: 250, burstIntervalMs: 1000 }), 0)).toBe(250);
    expect(burstStartMs(attack({ telegraphMs: 250, burstIntervalMs: 1000 }), 2)).toBe(2250);
  });
});

describe("dueShots", () => {
  it("fires a shot scheduled at exactly zero on the first update", () => {
    const shots = dueShots(attack(), 0, 16);
    expect(shots).toHaveLength(1);
    expect(shots[0].atMs).toBe(0);
  });

  it("never fires the same shot twice across consecutive windows", () => {
    const a = attack({ burstIntervalMs: 100 });
    let fired = 0;
    // Frame-by-frame over exactly [0, 1000): bursts at 0, 100, ... 900.
    for (let t = 0; t + 16 <= 1000; t += 16) fired += dueShots(a, t, t + 16).length;
    expect(fired).toBe(10);
  });

  it("stops after a finite repeat count", () => {
    const a = attack({ burstIntervalMs: 100, repeatCount: 3 });
    let fired = 0;
    for (let t = 0; t < 2000; t += 16) fired += dueShots(a, t, t + 16).length;
    expect(fired).toBe(3);
  });

  it("staggers a burst's own shots by perShotDelayMs", () => {
    const shots = dueShots(attack({ count: 3, perShotDelayMs: 50, arcStartDeg: -20, arcEndDeg: 20 }), 0, 200);
    expect(shots.map((s) => s.atMs)).toEqual([0, 50, 100]);
    expect(shots.map((s) => s.angleOffsetDeg)).toEqual([-20, 0, 20]);
  });

  it("shares one sweep offset across every shot in a burst, sampled at the burst's start", () => {
    const a = attack({ count: 2, perShotDelayMs: 100, sweepSpeedDeg: 90, arcStartDeg: 0, arcEndDeg: 0 });
    const shots = dueShots(a, 0, 500);
    expect(shots[0].angleOffsetDeg).toBeCloseTo(shots[1].angleOffsetDeg, 6);
  });

  it("fires nothing when the attack spawns no Unit", () => {
    expect(dueShots(attack({ spawnUnitId: null }), 0, 5000)).toEqual([]);
  });

  it("caps a single catch-up window rather than dumping an unbounded burst", () => {
    const shots = dueShots(attack({ burstIntervalMs: 1, count: 4, perShotDelayMs: 0 }), 0, 10_000);
    expect(shots.length).toBeLessThanOrEqual(64);
  });
});

describe("sweepOffsetDeg", () => {
  it("is inert without a sweep speed", () => {
    expect(sweepOffsetDeg(attack(), 1234)).toBe(0);
  });

  it("rotates linearly when not ping-ponging", () => {
    expect(sweepOffsetDeg(attack({ sweepSpeedDeg: 90 }), 2000)).toBeCloseTo(180, 6);
  });

  it("oscillates within its amplitude when ping-ponging", () => {
    const a = attack({ sweepSpeedDeg: 90, pingPong: true });
    for (let t = 0; t < 20_000; t += 137) {
      expect(Math.abs(sweepOffsetDeg(a, t))).toBeLessThanOrEqual(90.0001);
    }
  });
});

describe("isTelegraphing", () => {
  it("is inert without a wind-up", () => {
    expect(isTelegraphing(attack({ telegraphMs: 0 }), 10)).toBe(false);
  });

  it("runs from the start of a cycle up to the moment its burst fires", () => {
    const a = attack({ telegraphMs: 300, burstIntervalMs: 1000 });
    expect(isTelegraphing(a, 0)).toBe(true);
    expect(isTelegraphing(a, 299)).toBe(true);
    expect(isTelegraphing(a, 300)).toBe(false);
    expect(isTelegraphing(a, 1100)).toBe(true); // winding up for burst 1
    expect(isTelegraphing(a, 1400)).toBe(false);
  });

  it("stops once the last burst has fired", () => {
    expect(isTelegraphing(attack({ telegraphMs: 300, burstIntervalMs: 1000, repeatCount: 1 }), 1100)).toBe(false);
  });
});
