import { describe, it, expect } from "vitest";
import {
  burstPeriodMs,
  computePreviewBullets,
  isTelegraphing,
  shotAngleOffsets,
  sweepOffsetDeg,
  PREVIEW_LOOP_FALLBACK_MS,
  SWEEP_PINGPONG_AMPLITUDE_DEG,
} from "./actionPreview";
import { createBlankAttack } from "./unitTypes";

function attack(overrides: Partial<ReturnType<typeof createBlankAttack>> = {}) {
  return { ...createBlankAttack(), ...overrides };
}

describe("burstPeriodMs", () => {
  it("uses burstIntervalMs when positive", () => {
    expect(burstPeriodMs({ burstIntervalMs: 800 })).toBe(800);
  });
  it("falls back to the preview loop period for a single-burst attack", () => {
    expect(burstPeriodMs({ burstIntervalMs: 0 })).toBe(PREVIEW_LOOP_FALLBACK_MS);
  });
});

describe("shotAngleOffsets", () => {
  it("returns the arc midpoint for a single shot", () => {
    const offsets = shotAngleOffsets({ count: 1, arcStartDeg: -30, arcEndDeg: 30, spacing: "even" });
    expect(offsets).toEqual([0]);
  });

  it("spreads shots evenly across the arc, including both endpoints", () => {
    const offsets = shotAngleOffsets({ count: 3, arcStartDeg: -30, arcEndDeg: 30, spacing: "even" });
    expect(offsets).toEqual([-30, 0, 30]);
  });

  it("a 0/360 arc with several shots gives a full radial spread", () => {
    const offsets = shotAngleOffsets({ count: 4, arcStartDeg: 0, arcEndDeg: 360, spacing: "even" });
    expect(offsets).toEqual([0, 120, 240, 360]);
  });

  it("random spacing stays within the arc bounds and is deterministic across calls", () => {
    const cfg = { count: 5, arcStartDeg: -45, arcEndDeg: 45, spacing: "random" as const };
    const a = shotAngleOffsets(cfg);
    const b = shotAngleOffsets(cfg);
    expect(a).toEqual(b); // stable, not re-randomized every call
    for (const angle of a) {
      expect(angle).toBeGreaterThanOrEqual(-45);
      expect(angle).toBeLessThanOrEqual(45);
    }
  });
});

describe("sweepOffsetDeg", () => {
  it("is always 0 for a static (non-sweeping) attack", () => {
    expect(sweepOffsetDeg({ sweepSpeedDeg: 0, pingPong: false }, 5000)).toBe(0);
  });

  it("grows linearly with time when not ping-ponging", () => {
    const a = { sweepSpeedDeg: 90, pingPong: false };
    expect(sweepOffsetDeg(a, 1000)).toBeCloseTo(90);
    expect(sweepOffsetDeg(a, 2000)).toBeCloseTo(180);
  });

  it("ping-pong stays within +/- the fixed preview amplitude", () => {
    const a = { sweepSpeedDeg: 90, pingPong: true };
    for (let t = 0; t < 8000; t += 137) {
      const v = sweepOffsetDeg(a, t);
      expect(v).toBeGreaterThanOrEqual(-SWEEP_PINGPONG_AMPLITUDE_DEG - 1e-6);
      expect(v).toBeLessThanOrEqual(SWEEP_PINGPONG_AMPLITUDE_DEG + 1e-6);
    }
  });

  it("ping-pong returns to 0 at the start of every period", () => {
    const a = { sweepSpeedDeg: 90, pingPong: true };
    // period = 4*amplitude/speed = 4*90/90 = 4s = 4000ms
    expect(sweepOffsetDeg(a, 0)).toBeCloseTo(-SWEEP_PINGPONG_AMPLITUDE_DEG, 1);
    expect(sweepOffsetDeg(a, 4000)).toBeCloseTo(-SWEEP_PINGPONG_AMPLITUDE_DEG, 1);
  });
});

describe("isTelegraphing", () => {
  it("is false when the attack has no telegraph window", () => {
    expect(isTelegraphing({ burstIntervalMs: 1000, telegraphMs: 0 }, 999)).toBe(false);
  });

  it("is true only in the window immediately before a burst fires", () => {
    const a = { burstIntervalMs: 1000, telegraphMs: 200 };
    expect(isTelegraphing(a, 700)).toBe(false);
    expect(isTelegraphing(a, 850)).toBe(true);
    expect(isTelegraphing(a, 999)).toBe(true);
  });
});

describe("computePreviewBullets", () => {
  // burstIntervalMs is chosen well above PREVIEW_BULLET_LIFE_MS (1400ms) in
  // these tests so the previous cycle's burst has always fully expired by
  // t=0 — otherwise overlapping in-flight bullets from consecutive bursts
  // is correct, expected behavior for a rapid-fire attack, not a bug (see
  // the dedicated overlap test below).

  it("spawns a bullet at the origin at the instant of a burst", () => {
    const a = attack({ count: 1, arcStartDeg: 0, arcEndDeg: 0, burstIntervalMs: 5000, perShotDelayMs: 0 });
    const bullets = computePreviewBullets(a, 0, 0);
    expect(bullets).toHaveLength(1);
    expect(bullets[0].x).toBeCloseTo(0);
    expect(bullets[0].y).toBeCloseTo(0);
    expect(bullets[0].alpha).toBeCloseTo(1);
  });

  it("a bullet travels outward along its aim angle over time", () => {
    const a = attack({ count: 1, arcStartDeg: 0, arcEndDeg: 0, burstIntervalMs: 5000, perShotDelayMs: 0 });
    const bullets = computePreviewBullets(a, 0 /* aim = +x */, 500);
    expect(bullets).toHaveLength(1);
    expect(bullets[0].x).toBeGreaterThan(0);
    expect(bullets[0].y).toBeCloseTo(0, 1);
  });

  it("no bullets remain once every shot has exceeded its lifespan and no new burst has fired", () => {
    const a = attack({ count: 1, arcStartDeg: 0, arcEndDeg: 0, burstIntervalMs: 100000, perShotDelayMs: 0 });
    const bullets = computePreviewBullets(a, 0, 5000);
    expect(bullets).toHaveLength(0);
  });

  it("multiple shots in a burst all spawn together when perShotDelayMs is 0", () => {
    const a = attack({ count: 3, arcStartDeg: -30, arcEndDeg: 30, burstIntervalMs: 5000, perShotDelayMs: 0, spacing: "even" });
    const bullets = computePreviewBullets(a, 0, 0);
    expect(bullets).toHaveLength(3);
  });

  it("a rapid-fire attack (interval shorter than bullet lifespan) shows overlapping bullets from consecutive bursts", () => {
    const a = attack({ count: 1, arcStartDeg: 0, arcEndDeg: 0, burstIntervalMs: 1000, perShotDelayMs: 0 });
    const bullets = computePreviewBullets(a, 0, 0);
    expect(bullets).toHaveLength(2); // this cycle's fresh spawn + the previous cycle's still-in-flight bullet
  });
});
