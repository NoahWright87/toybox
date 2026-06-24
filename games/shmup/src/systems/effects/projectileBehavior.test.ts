import { describe, it, expect } from "vitest";
import { resolveProjectileBehavior } from "./projectileBehavior";
import type {
  ProjectileBehaviorStats,
  ProjectileBehaviorTuningOverrides,
} from "./projectileBehavior";

const NO_EXOTICS: ProjectileBehaviorStats = { pierce: 0, bounce: 0, fork: 0, chain: 0, blastRadius: 0 };

interface Case {
  name: string;
  given: { stats: ProjectileBehaviorStats; overrides?: ProjectileBehaviorTuningOverrides };
  then: {
    hitFractions: number[];
    avgTargetsHit?: number;
    totalDamageFraction?: number;
    blastBonusTargets?: number;
  };
}

const CASES: Case[] = [
  {
    name: "no exotic stats hits exactly one target at full damage",
    given: { stats: NO_EXOTICS },
    then: { hitFractions: [1], avgTargetsHit: 1, totalDamageFraction: 1 },
  },
  {
    name: "pierce 2.25 spends a full+partial budget across pierced targets",
    given: { stats: { ...NO_EXOTICS, pierce: 2.25 } },
    then: { hitFractions: [1, 1, 1, 0.25], avgTargetsHit: 4, totalDamageFraction: 3.25 },
  },
  {
    name: "an exact integer pierce budget produces no trailing partial hit",
    given: { stats: { ...NO_EXOTICS, pierce: 2 } },
    then: { hitFractions: [1, 1, 1] },
  },
  {
    name: "zero pierce still guarantees the one hit",
    given: { stats: { ...NO_EXOTICS, pierce: 0 } },
    then: { hitFractions: [1] },
  },
  {
    name: "bounce 0.5 decays geometrically and stops below the damage floor",
    given: { stats: { ...NO_EXOTICS, bounce: 0.5 } },
    then: { hitFractions: [1, 0.5, 0.25, 0.125, 0.0625] },
  },
  {
    name: "zero bounce contributes no extra hits",
    given: { stats: { ...NO_EXOTICS, bounce: 0 } },
    then: { hitFractions: [1] },
  },
  {
    name: "bounce above 100% is capped by maxBounces, not an infinite loop",
    given: { stats: { ...NO_EXOTICS, bounce: 1.5 }, overrides: { maxBounces: 3 } },
    then: { hitFractions: [1, 1.5, 2.25, 3.375] },
  },
  {
    name: "chain adds a flat number of full-fraction jumps",
    given: { stats: { ...NO_EXOTICS, chain: 3 } },
    then: { hitFractions: [1, 1, 1, 1] },
  },
  {
    name: "a fractional chain count floors down",
    given: { stats: { ...NO_EXOTICS, chain: 2.9 } },
    then: { hitFractions: [1, 1, 1] },
  },
  {
    name: "pierce + fork: every shot splits and each half keeps tunneling",
    given: { stats: { ...NO_EXOTICS, pierce: 2.25, fork: 1 } },
    then: { hitFractions: [1, 1, 1, 0.25, 1, 1, 1, 0.25], avgTargetsHit: 8 },
  },
  {
    name: "chain + blast: chain jumps each also trigger a splash bonus",
    given: {
      stats: { ...NO_EXOTICS, chain: 3, blastRadius: 100 },
      overrides: { blastTargetsPerPx: 0.01, blastDamageFraction: 0.5 },
    },
    then: {
      hitFractions: [1, 1, 1, 1],
      blastBonusTargets: 4,
      avgTargetsHit: 8,
      totalDamageFraction: 6,
    },
  },
];

describe("resolveProjectileBehavior", () => {
  it.each(CASES)("$name", ({ given, then }) => {
    const behavior = resolveProjectileBehavior(given.stats, given.overrides);
    expect(behavior.hitFractions).toEqual(then.hitFractions);
    if (then.avgTargetsHit !== undefined) {
      expect(behavior.avgTargetsHit).toBeCloseTo(then.avgTargetsHit, 10);
    }
    if (then.totalDamageFraction !== undefined) {
      expect(behavior.totalDamageFraction).toBeCloseTo(then.totalDamageFraction, 10);
    }
    if (then.blastBonusTargets !== undefined) {
      expect(behavior.blastBonusTargets).toBeCloseTo(then.blastBonusTargets, 10);
    }
  });

  it("is pure and deterministic: identical stats produce identical behavior", () => {
    const stats: ProjectileBehaviorStats = {
      pierce: 1.5,
      bounce: 0.4,
      fork: 2,
      chain: 1,
      blastRadius: 30,
    };
    const a = resolveProjectileBehavior(stats);
    const b = resolveProjectileBehavior(stats);
    expect(a).toEqual(b);
  });
});
