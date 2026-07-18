import { describe, it, expect } from "vitest";
import { computeAttackBullets, computeCameraBoundsRect, resolveAttackAimDeg, resolveBulletRadius, DEFAULT_BULLET_HITBOX_RADIUS, GAME_ASPECT_RATIO } from "./hitboxPreview";
import { createBlankWeapon, createBlankUnit } from "./unitTypes";

function weapon(overrides: Partial<ReturnType<typeof createBlankWeapon>> = {}) {
  return { ...createBlankWeapon(0), ...overrides };
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

describe("resolveAttackAimDeg", () => {
  it("uses the override when present for a fixed-aim weapon", () => {
    const deg = resolveAttackAimDeg({ aimAngleOverride: 45 }, { aimMode: "fixed", fixedAngleDeg: 0 }, { x: 0, y: 0 }, { x: 0, y: 100 });
    expect(deg).toBe(45);
  });

  it("falls back to the weapon's fixedAngleDeg when there's no override", () => {
    const deg = resolveAttackAimDeg({ aimAngleOverride: null }, { aimMode: "fixed", fixedAngleDeg: 90 }, { x: 0, y: 0 }, { x: 0, y: 100 });
    expect(deg).toBe(90);
  });

  it("aims at the player reference point for a player-tracked weapon, ignoring fixedAngleDeg", () => {
    const deg = resolveAttackAimDeg({ aimAngleOverride: null }, { aimMode: "player", fixedAngleDeg: 0 }, { x: 0, y: 0 }, { x: 0, y: 100 });
    expect(deg).toBeCloseTo(90); // straight down, matching the aim-handle's 0=+x/90=+y convention
  });
});

describe("computeAttackBullets", () => {
  it("nothing before the attack fires", () => {
    expect(computeAttackBullets(weapon(), 0, 0, -1)).toEqual([]);
  });

  it("a single-burst attack (durationMs 0) fires exactly once, regardless of the weapon's own fireIntervalMs", () => {
    const w = weapon({ count: 1, arcStartDeg: 0, arcEndDeg: 0, fireIntervalMs: 500, perShotDelayMs: 0 });
    expect(computeAttackBullets(w, 0, 0, 0)).toHaveLength(1);
    // Once the one-and-only bullet has outlived its lifespan, a repeating weapon would have fired fresh bursts at 500/1000/1500ms by now; this attack never repeats, so nothing remains.
    expect(computeAttackBullets(w, 0, 0, 2000)).toHaveLength(0);
  });

  it("a repeating attack fires again at each fireIntervalMs while within durationMs", () => {
    const w = weapon({ count: 1, arcStartDeg: 0, arcEndDeg: 0, fireIntervalMs: 500, perShotDelayMs: 0 });
    expect(computeAttackBullets(w, 0, 2000, 500)[0].alpha).toBeCloseTo(1); // fresh spawn at the second burst
    expect(computeAttackBullets(w, 0, 2000, 1000)[0].alpha).toBeCloseTo(1); // fresh spawn at the third burst
  });

  it("stops producing new bursts once elapsed time is past durationMs, even if bullets from the last real burst are still in flight", () => {
    const w = weapon({ count: 1, arcStartDeg: 0, arcEndDeg: 0, fireIntervalMs: 500, perShotDelayMs: 0 });
    // durationMs=1000 -> bursts at 0, 500, 1000. At t=1200, both the t=500 and t=1000 bursts are still young enough to be mid-flight (overlapping, same as a real rapid-fire weapon).
    const stillFlying = computeAttackBullets(w, 0, 1000, 1200);
    expect(stillFlying).toHaveLength(2);
    // Well past every real burst's lifespan (last real burst was at t=1000): a repeating weapon would also have fired fresh bursts at 1500/2000/2500ms by now, but the attack's own duration ended at 1000 — no phantom bursts, nothing left in flight.
    const wellPast = computeAttackBullets(w, 0, 1000, 2600);
    expect(wellPast).toHaveLength(0);
  });

  it("travels outward along the resolved aim angle", () => {
    const w = weapon({ count: 1, arcStartDeg: 0, arcEndDeg: 0, fireIntervalMs: 5000, perShotDelayMs: 0 });
    const bullets = computeAttackBullets(w, 0 /* aim = +x */, 0, 300);
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
