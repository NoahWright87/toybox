import { describe, it, expect } from "vitest";
import { eliteChance, eliteUnlocked, rollSpawnArchetype, scaledEnemyStats } from "./archetypes";
import { TUNING } from "../../tuning";

describe("eliteUnlocked / eliteChance", () => {
  it("elites are locked out below eliteUnlockD", () => {
    expect(eliteUnlocked(TUNING.difficulty.eliteUnlockD - 0.01)).toBe(false);
    expect(eliteChance(TUNING.difficulty.eliteUnlockD - 0.01)).toBe(0);
  });

  it("elites unlock at eliteUnlockD with eliteChanceAtUnlock", () => {
    expect(eliteUnlocked(TUNING.difficulty.eliteUnlockD)).toBe(true);
    expect(eliteChance(TUNING.difficulty.eliteUnlockD)).toBeCloseTo(TUNING.difficulty.eliteChanceAtUnlock, 10);
  });

  it("ramps up to eliteChanceMax by eliteChanceMaxD and caps there", () => {
    expect(eliteChance(TUNING.difficulty.eliteChanceMaxD)).toBeCloseTo(TUNING.difficulty.eliteChanceMax, 10);
    expect(eliteChance(TUNING.difficulty.eliteChanceMaxD + 1000)).toBe(TUNING.difficulty.eliteChanceMax);
  });
});

describe("rollSpawnArchetype", () => {
  it("always rolls drone below the elite unlock threshold", () => {
    expect(rollSpawnArchetype(0, () => 0)).toBe("drone");
  });

  it("rolls elite once unlocked and the roll lands under eliteChance", () => {
    expect(rollSpawnArchetype(TUNING.difficulty.eliteChanceMaxD, () => 0)).toBe("elite");
  });

  it("rolls drone when the roll lands above eliteChance", () => {
    expect(rollSpawnArchetype(TUNING.difficulty.eliteChanceMaxD, () => 0.999)).toBe("drone");
  });
});

describe("scaledEnemyStats", () => {
  const base = TUNING.enemies.drone;

  it("returns the base stats unchanged at D=0", () => {
    const scaled = scaledEnemyStats("drone", base, 0);
    expect(scaled.maxHp).toBeCloseTo(base.maxHp, 10);
    expect(scaled.bulletDamage).toBeCloseTo(base.bulletDamage, 10);
  });

  it("elite leans harder into HP/damage than drone at the same D (per-archetype emphasis)", () => {
    const D = 30;
    const droneHpMult = scaledEnemyStats("drone", TUNING.enemies.drone, D).maxHp / TUNING.enemies.drone.maxHp;
    const eliteHpMult = scaledEnemyStats("elite", TUNING.enemies.elite, D).maxHp / TUNING.enemies.elite.maxHp;
    expect(eliteHpMult).toBeGreaterThan(droneHpMult);
  });

  it("boss HP gets the extra bossHpMult on top of its curve", () => {
    const D = 10;
    const bossScaled = scaledEnemyStats("boss", TUNING.enemies.boss, D);
    expect(bossScaled.maxHp).toBeGreaterThan(TUNING.enemies.boss.maxHp * TUNING.difficulty.bossHpMult);
  });

  it("fireIntervalMs shrinks (faster fire) as D rises", () => {
    const at0 = scaledEnemyStats("drone", base, 0).fireIntervalMs;
    const at50 = scaledEnemyStats("drone", base, 50).fireIntervalMs;
    expect(at50).toBeLessThan(at0);
  });

  it("scoreValue grows with D (D scales rewards)", () => {
    const at0 = scaledEnemyStats("drone", base, 0).scoreValue;
    const at50 = scaledEnemyStats("drone", base, 50).scoreValue;
    expect(at50).toBeGreaterThan(at0);
  });
});
