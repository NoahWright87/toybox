import { describe, it, expect } from "vitest";
import { computeAttackBullets, computeAttackDurationMs, computeCameraBoundsRect, resolveActionFacingDeg, resolveBulletRadius, DEFAULT_BULLET_HITBOX_RADIUS, GAME_ASPECT_RATIO } from "./hitboxPreview";
import { createBlankAttack, createBlankUnit } from "./unitTypes";

function attack(overrides: Partial<ReturnType<typeof createBlankAttack>> = {}) {
  return { ...createBlankAttack(), ...overrides };
}

describe("computeCameraBoundsRect", () => {
  it("matches the tile's own width and centers vertically using the real game's aspect ratio", () => {
    const tileRect = { x: 10, y: 20, width: 260, height: 130 };
    const rect = computeCameraBoundsRect(tileRect);
    expect(rect.x).toBe(10);
    expect(rect.width).toBe(260);
    expect(rect.height).toBeCloseTo(260 * GAME_ASPECT_RATIO);
    expect(rect.y).toBeCloseTo(20 + (130 - rect.height) / 2);
  });
});

describe("resolveActionFacingDeg", () => {
  it("uses fixedFacingDeg for a fixed-facing Action", () => {
    const deg = resolveActionFacingDeg({ facing: "fixed", fixedFacingDeg: 45 }, { x: 0, y: 0 }, { x: 0, y: 100 }, 0);
    expect(deg).toBe(45);
  });

  it("aims at the player reference point for facePlayer, ignoring fixedFacingDeg and heading", () => {
    const deg = resolveActionFacingDeg({ facing: "facePlayer", fixedFacingDeg: 0 }, { x: 0, y: 0 }, { x: 0, y: 100 }, 999);
    expect(deg).toBeCloseTo(90); // straight down, matching the aim-handle's 0=+x/90=+y convention
  });

  it("uses the supplied movement heading for faceMovement", () => {
    const deg = resolveActionFacingDeg({ facing: "faceMovement", fixedFacingDeg: 0 }, { x: 0, y: 0 }, { x: 0, y: 100 }, 180);
    expect(deg).toBe(180);
  });
});

describe("computeAttackDurationMs", () => {
  it("is null (indefinite) when repeatCount is null", () => {
    expect(computeAttackDurationMs(attack({ repeatCount: null }))).toBeNull();
  });

  it("is 0 for a single burst with no telegraph or per-shot delay", () => {
    expect(computeAttackDurationMs(attack({ repeatCount: 1, telegraphMs: 0, count: 1, perShotDelayMs: 0 }))).toBe(0);
  });

  it("includes telegraph, every burst-to-burst gap after the first, and the last burst's own per-shot delays", () => {
    const durationMs = computeAttackDurationMs(attack({ repeatCount: 3, burstIntervalMs: 500, telegraphMs: 100, count: 4, perShotDelayMs: 50 }));
    // 100 telegraph + 2 gaps * 500 + 3 delays * 50 = 100 + 1000 + 150
    expect(durationMs).toBe(1250);
  });
});

describe("computeAttackBullets", () => {
  it("nothing before the attack fires", () => {
    expect(computeAttackBullets(attack(), 0, 0, -1)).toEqual([]);
  });

  it("a single-burst attack (durationMs 0) fires exactly once, regardless of the attack's own burstIntervalMs", () => {
    const a = attack({ count: 1, arcStartDeg: 0, arcEndDeg: 0, burstIntervalMs: 500, perShotDelayMs: 0 });
    expect(computeAttackBullets(a, 0, 0, 0)).toHaveLength(1);
    // Once the one-and-only bullet has outlived its lifespan, a repeating attack would have fired fresh bursts at 500/1000/1500ms by now; this attack never repeats, so nothing remains.
    expect(computeAttackBullets(a, 0, 0, 2000)).toHaveLength(0);
  });

  it("a repeating attack fires again at each burstIntervalMs while within durationMs", () => {
    const a = attack({ count: 1, arcStartDeg: 0, arcEndDeg: 0, burstIntervalMs: 500, perShotDelayMs: 0 });
    expect(computeAttackBullets(a, 0, 2000, 500)[0].alpha).toBeCloseTo(1); // fresh spawn at the second burst
    expect(computeAttackBullets(a, 0, 2000, 1000)[0].alpha).toBeCloseTo(1); // fresh spawn at the third burst
  });

  it("stops producing new bursts once elapsed time is past durationMs, even if bullets from the last real burst are still in flight", () => {
    const a = attack({ count: 1, arcStartDeg: 0, arcEndDeg: 0, burstIntervalMs: 500, perShotDelayMs: 0 });
    // durationMs=1000 -> bursts at 0, 500, 1000. At t=1200, both the t=500 and t=1000 bursts are still young enough to be mid-flight (overlapping, same as a real rapid-fire attack).
    const stillFlying = computeAttackBullets(a, 0, 1000, 1200);
    expect(stillFlying).toHaveLength(2);
    // Well past every real burst's lifespan (last real burst was at t=1000): a repeating attack would also have fired fresh bursts at 1500/2000/2500ms by now, but the attack's own duration ended at 1000 — no phantom bursts, nothing left in flight.
    const wellPast = computeAttackBullets(a, 0, 1000, 2600);
    expect(wellPast).toHaveLength(0);
  });

  it("an indefinite (null durationMs) attack keeps firing new bursts with no upper bound", () => {
    const a = attack({ count: 1, arcStartDeg: 0, arcEndDeg: 0, burstIntervalMs: 500, perShotDelayMs: 0 });
    expect(computeAttackBullets(a, 0, null, 10000)[0].alpha).toBeCloseTo(1); // still firing fresh bursts well past any finite duration
  });

  it("travels outward along the resolved aim angle", () => {
    const a = attack({ count: 1, arcStartDeg: 0, arcEndDeg: 0, burstIntervalMs: 5000, perShotDelayMs: 0 });
    const bullets = computeAttackBullets(a, 0 /* aim = +x */, 0, 300);
    expect(bullets).toHaveLength(1);
    expect(bullets[0].x).toBeGreaterThan(0);
    expect(bullets[0].y).toBeCloseTo(0, 1);
  });
});

describe("resolveBulletRadius", () => {
  it("resolves the spawned Unit's real size", () => {
    const bullet = { ...createBlankUnit(0), id: "unit-bullet-x", size: 9 };
    expect(resolveBulletRadius({ spawnUnitId: "unit-bullet-x" }, [bullet])).toBe(9);
  });

  it("falls back to the default when the reference doesn't resolve", () => {
    expect(resolveBulletRadius({ spawnUnitId: "unit-missing" }, [])).toBe(DEFAULT_BULLET_HITBOX_RADIUS);
    expect(resolveBulletRadius({ spawnUnitId: null }, [])).toBe(DEFAULT_BULLET_HITBOX_RADIUS);
  });
});
