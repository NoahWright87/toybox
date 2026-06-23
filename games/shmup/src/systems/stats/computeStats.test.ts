import { describe, it, expect } from "vitest";
import { computeStats, aggregateRaw } from "./computeStats";
import { STAT_DEFS } from "./statDefs";
import { MAIN_STAT_IDS, EXOTIC_STAT_IDS } from "./types";
import { formatStatValue } from "./format";
import type { StatModifier } from "./types";

describe("STAT_DEFS", () => {
  it("has exactly the 16 main stats + 6 exotic stats", () => {
    expect(MAIN_STAT_IDS).toHaveLength(16);
    expect(EXOTIC_STAT_IDS).toHaveLength(6);
    expect(Object.keys(STAT_DEFS)).toHaveLength(22);
  });

  it("every hyperbolic stat declares a K", () => {
    for (const def of Object.values(STAT_DEFS)) {
      if (def.archetype === "hyperbolic") expect(def.K).toBeGreaterThan(0);
    }
  });
});

describe("computeStats — defaults", () => {
  it("falls back to STAT_DEFS.base with no mods", () => {
    const stats = computeStats();
    expect(stats.damage).toBe(STAT_DEFS.damage.base);
    expect(stats.maxHp).toBe(100);
  });

  it("is pure: identical inputs produce identical outputs", () => {
    const persistent: StatModifier[] = [{ kind: "flat", stat: "damage", amount: 5 }];
    const a = computeStats({}, persistent, []);
    const b = computeStats({}, persistent, []);
    expect(a).toEqual(b);
  });

  it("base overrides (e.g. per-chassis) replace the StatDef default", () => {
    const stats = computeStats({ damage: 20 });
    expect(stats.damage).toBe(20);
    expect(stats.maxHp).toBe(STAT_DEFS.maxHp.base);
  });
});

describe("computeStats — flat adds", () => {
  it("sums flat modifiers onto base", () => {
    const mods: StatModifier[] = [
      { kind: "flat", stat: "damage", amount: 3 },
      { kind: "flat", stat: "damage", amount: 2 },
    ];
    const stats = computeStats({}, mods);
    expect(stats.damage).toBe(STAT_DEFS.damage.base + 5);
  });
});

describe("computeStats — percent composition grammar", () => {
  it("adds percent bonuses within the same category", () => {
    const mods: StatModifier[] = [
      { kind: "percent", stat: "damage", category: "vsGround", amount: 0.5 },
      { kind: "percent", stat: "damage", category: "vsGround", amount: 0.5 },
    ];
    // two "+50% vs ground" -> +100% (one category), not +125%
    const stats = computeStats({}, mods);
    expect(stats.damage).toBeCloseTo(STAT_DEFS.damage.base * 2.0, 10);
  });

  it("multiplies percent bonuses across different categories", () => {
    const mods: StatModifier[] = [
      { kind: "percent", stat: "damage", category: "vsGround", amount: 0.5 },
      { kind: "percent", stat: "damage", category: "grazing", amount: 0.25 },
    ];
    // +50% vs ground x +25% while grazing -> x1.5 x x1.25 (combat.spec.todo.md)
    const stats = computeStats({}, mods);
    expect(stats.damage).toBeCloseTo(STAT_DEFS.damage.base * 1.5 * 1.25, 10);
  });

  it("defaults uncategorized percent mods to one shared 'global' pool", () => {
    const mods: StatModifier[] = [
      { kind: "percent", stat: "damage", amount: 0.1 },
      { kind: "percent", stat: "damage", amount: 0.2 },
    ];
    const stats = computeStats({}, mods);
    expect(stats.damage).toBeCloseTo(STAT_DEFS.damage.base * 1.3, 10);
  });
});

describe("computeStats — hyperbolic archetype", () => {
  it("computes evasion as raw / (raw + K), approaching but never reaching 1", () => {
    const K = STAT_DEFS.evasion.K!;
    const mods: StatModifier[] = [{ kind: "flat", stat: "evasion", amount: K }];
    const stats = computeStats({}, mods);
    // base evasion + K flat -> raw = base + K; expected = raw / (raw + K)
    const raw = STAT_DEFS.evasion.base + K;
    expect(stats.evasion).toBeCloseTo(raw / (raw + K), 10);
    expect(stats.evasion).toBeLessThan(1);
  });

  it("never goes negative even with large negative flat adds", () => {
    const mods: StatModifier[] = [{ kind: "flat", stat: "armor", amount: -1000 }];
    const stats = computeStats({}, mods);
    expect(stats.armor).toBe(0);
  });

  it("crit chance is NOT hyperbolic-capped — it can exceed 100% (combat.spec.todo.md)", () => {
    const mods: StatModifier[] = [{ kind: "flat", stat: "critChance", amount: 2.4 }];
    const stats = computeStats({}, mods);
    expect(stats.critChance).toBeCloseTo(2.41, 10);
  });
});

describe("computeStats — flat archetype clamps", () => {
  it("clamps magnetRadius to its declared min", () => {
    const mods: StatModifier[] = [{ kind: "flat", stat: "magnetRadius", amount: -1000 }];
    const stats = computeStats({}, mods);
    expect(stats.magnetRadius).toBe(0);
  });
});

describe("computeStats — persistent + transient layering", () => {
  it("layers transient mods on top of persistent without mutating the persistent result", () => {
    const persistent: StatModifier[] = [{ kind: "percent", stat: "damage", amount: 0.5 }];
    const grazingBuff: StatModifier[] = [
      { kind: "percent", stat: "damage", category: "grazing", amount: 0.25 },
    ];

    const baseline = computeStats({}, persistent, []);
    const whileGrazing = computeStats({}, persistent, grazingBuff);

    expect(baseline.damage).toBeCloseTo(STAT_DEFS.damage.base * 1.5, 10);
    expect(whileGrazing.damage).toBeCloseTo(STAT_DEFS.damage.base * 1.5 * 1.25, 10);
    // toggling the condition off (dropping transientMods) reverts exactly to baseline
    expect(computeStats({}, persistent, []).damage).toBeCloseTo(baseline.damage, 10);
  });
});

describe("aggregateRaw", () => {
  it("exposes the pre-archetype-transform value for channel-specific consumers (e.g. Reflexes)", () => {
    const mods: StatModifier[] = [{ kind: "flat", stat: "reflexes", amount: 3 }];
    expect(aggregateRaw("reflexes", {}, mods)).toBe(3);
    // reflexes itself is unboundedMult, so computeStats returns the same raw value
    expect(computeStats({}, mods).reflexes).toBe(3);
  });
});

describe("formatStatValue", () => {
  it("formats percent, multiplier, px and flat units", () => {
    expect(formatStatValue(STAT_DEFS.critChance, 0.25)).toBe("25%");
    expect(formatStatValue(STAT_DEFS.damage, 1.2345)).toBe("1.23×");
    expect(formatStatValue(STAT_DEFS.magnetRadius, 64)).toBe("64px");
    expect(formatStatValue(STAT_DEFS.fork, 2)).toBe("2");
  });
});
