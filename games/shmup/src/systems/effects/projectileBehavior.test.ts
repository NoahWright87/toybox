import { describe, it, expect } from "vitest";
import { resolveProjectileBehavior } from "./projectileBehavior";
import type {
  ProjectileBehaviorStats,
  ProjectileBehaviorTuningOverrides,
} from "./projectileBehavior";

const NO_EXOTICS: ProjectileBehaviorStats = { pierce: 0, blastRadius: 0 };

interface Case {
  name: string;
  given: { stats: ProjectileBehaviorStats; pierceDecay?: number; overrides?: ProjectileBehaviorTuningOverrides };
  then: {
    flatLineCount?: number;
    tailHitFractions?: number[];
    tailLength?: number;
    tailFirstTwo?: [number, number];
    maxTailLength?: number;
    blastBonusTargetsPerHit?: number;
    blastDamageFraction?: number;
  };
}

const CASES: Case[] = [
  {
    name: "zero pierce still guarantees the one hit",
    given: { stats: NO_EXOTICS },
    then: { flatLineCount: 0, tailHitFractions: [1] },
  },
  {
    name: "pierce at or below 100% decays geometrically and stops below the floor",
    given: { stats: { ...NO_EXOTICS, pierce: 0.5 } },
    then: { flatLineCount: 0, tailHitFractions: [1, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625] },
  },
  {
    name: "pierce above 100% forks one full-damage line, decaying the overflow by pierceDecay",
    given: { stats: { ...NO_EXOTICS, pierce: 1.5 } },
    then: { flatLineCount: 1, tailHitFractions: [1, 0.25, 0.0625, 0.015625] },
  },
  {
    name: "pierce at exactly 200% forks once and leaves a plain 50% decay tail",
    given: { stats: { ...NO_EXOTICS, pierce: 2.0 } },
    then: { flatLineCount: 1, tailHitFractions: [1, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625] },
  },
  {
    name: "a higher pierceDecay lets forking continue across more generations",
    given: { stats: { ...NO_EXOTICS, pierce: 5 }, pierceDecay: 0.9 },
    then: { flatLineCount: 4, tailFirstTwo: [1, 0.1854] },
  },
  {
    name: "an authored pierceDecay is clamped to the configured cap",
    given: { stats: { ...NO_EXOTICS, pierce: 1.5 }, pierceDecay: 1, overrides: { maxPierceDecay: 0.5 } },
    then: { flatLineCount: 1, tailHitFractions: [1, 0.25, 0.0625, 0.015625] },
  },
  {
    name: "maxForksPerImpact hard-caps forking even when pierce can't converge below 100% on its own",
    given: {
      stats: { ...NO_EXOTICS, pierce: 1_000_000 },
      pierceDecay: 0.99,
      overrides: { maxForksPerImpact: 3, maxTailHits: 5 },
    },
    then: { flatLineCount: 3, maxTailLength: 5 },
  },
  {
    name: "blast radius contributes a per-hit splash bonus, not pre-multiplied by hit count",
    given: {
      stats: { ...NO_EXOTICS, blastRadius: 100 },
      overrides: { blastTargetsPerPx: 0.01, blastDamageFraction: 0.5 },
    },
    then: { blastBonusTargetsPerHit: 1, blastDamageFraction: 0.5 },
  },
];

describe("resolveProjectileBehavior", () => {
  it.each(CASES)("$name", ({ given, then }) => {
    const behavior = resolveProjectileBehavior(given.stats, given.pierceDecay, given.overrides);
    if (then.flatLineCount !== undefined) {
      expect(behavior.flatLineCount).toBe(then.flatLineCount);
    }
    if (then.tailHitFractions !== undefined) {
      expect(behavior.tailHitFractions).toEqual(then.tailHitFractions);
    }
    if (then.tailLength !== undefined) {
      expect(behavior.tailHitFractions.length).toBe(then.tailLength);
    }
    if (then.maxTailLength !== undefined) {
      expect(behavior.tailHitFractions.length).toBeLessThanOrEqual(then.maxTailLength);
    }
    if (then.tailFirstTwo !== undefined) {
      expect(behavior.tailHitFractions[0]).toBeCloseTo(then.tailFirstTwo[0], 10);
      expect(behavior.tailHitFractions[1]).toBeCloseTo(then.tailFirstTwo[1], 4);
    }
    if (then.blastBonusTargetsPerHit !== undefined) {
      expect(behavior.blastBonusTargetsPerHit).toBeCloseTo(then.blastBonusTargetsPerHit, 10);
    }
    if (then.blastDamageFraction !== undefined) {
      expect(behavior.blastDamageFraction).toBeCloseTo(then.blastDamageFraction, 10);
    }
  });

  it("is pure and deterministic: identical stats produce identical behavior", () => {
    const stats: ProjectileBehaviorStats = { pierce: 1.5, blastRadius: 30 };
    const a = resolveProjectileBehavior(stats, 0.6);
    const b = resolveProjectileBehavior(stats, 0.6);
    expect(a).toEqual(b);
  });
});
