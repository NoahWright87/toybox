import { describe, it, expect } from "vitest";
import {
  eliteChance,
  eliteUnlocked,
  rollSpawnArchetype,
  rollSpawnArchetypeForDomain,
  scaledEnemyStats,
  swarmerChance,
  turretChance,
} from "./archetypes";
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

  it("passes domain/movement/firePattern through unchanged regardless of D", () => {
    const turretBase = TUNING.enemies.turret;
    const scaled = scaledEnemyStats("turret", turretBase, 25);
    expect(scaled.domain).toBe("ground");
    expect(scaled.movement).toEqual(turretBase.movement);
    expect(scaled.firePattern).toEqual(turretBase.firePattern);
  });

  it("swarmer leans harder into speed than drone at the same D (per-archetype emphasis)", () => {
    const D = 20;
    const droneSpeedMult = scaledEnemyStats("drone", TUNING.enemies.drone, D).speed / TUNING.enemies.drone.speed;
    const swarmerSpeedMult = scaledEnemyStats("swarmer", TUNING.enemies.swarmer, D).speed / TUNING.enemies.swarmer.speed;
    expect(swarmerSpeedMult).toBeGreaterThan(droneSpeedMult);
  });

  it("turret leans harder into HP than drone at the same D (per-archetype emphasis)", () => {
    const D = 20;
    const droneHpMult = scaledEnemyStats("drone", TUNING.enemies.drone, D).maxHp / TUNING.enemies.drone.maxHp;
    const turretHpMult = scaledEnemyStats("turret", TUNING.enemies.turret, D).maxHp / TUNING.enemies.turret.maxHp;
    expect(turretHpMult).toBeGreaterThan(droneHpMult);
  });
});

describe("swarmerChance / turretChance", () => {
  it("both are locked out below their own unlock D", () => {
    expect(swarmerChance(TUNING.difficulty.swarmerUnlockD - 0.01)).toBe(0);
    expect(turretChance(TUNING.difficulty.turretUnlockD - 0.01)).toBe(0);
  });

  it("both ramp up to their max chance and cap there", () => {
    expect(swarmerChance(TUNING.difficulty.swarmerChanceMaxD)).toBeCloseTo(TUNING.difficulty.swarmerChanceMax, 10);
    expect(swarmerChance(TUNING.difficulty.swarmerChanceMaxD + 1000)).toBe(TUNING.difficulty.swarmerChanceMax);
    expect(turretChance(TUNING.difficulty.turretChanceMaxD)).toBeCloseTo(TUNING.difficulty.turretChanceMax, 10);
    expect(turretChance(TUNING.difficulty.turretChanceMaxD + 1000)).toBe(TUNING.difficulty.turretChanceMax);
  });
});

describe("rollSpawnArchetypeForDomain", () => {
  it("still rolls elite first, regardless of domain, when the elite roll lands", () => {
    const D = TUNING.difficulty.eliteChanceMaxD;
    expect(rollSpawnArchetypeForDomain(D, "air", () => 0)).toBe("elite");
    expect(rollSpawnArchetypeForDomain(D, "ground", () => 0)).toBe("elite");
  });

  it("air levels upgrade a non-elite roll to swarmer once unlocked and the flavor roll lands", () => {
    const D = TUNING.difficulty.swarmerChanceMaxD;
    // rng sequence: first call (elite gate) misses elite, second call (flavor gate) lands.
    const rolls = [0.999, 0];
    let i = 0;
    const rng = () => rolls[i++];
    expect(rollSpawnArchetypeForDomain(D, "air", rng)).toBe("swarmer");
  });

  it("ground levels upgrade a non-elite roll to turret once unlocked and the flavor roll lands", () => {
    const D = TUNING.difficulty.turretChanceMaxD;
    const rolls = [0.999, 0];
    let i = 0;
    const rng = () => rolls[i++];
    expect(rollSpawnArchetypeForDomain(D, "ground", rng)).toBe("turret");
  });

  it("falls back to drone when the flavor roll misses", () => {
    const D = TUNING.difficulty.swarmerChanceMaxD;
    expect(rollSpawnArchetypeForDomain(D, "air", () => 0.999)).toBe("drone");
  });
});
