import { describe, it, expect } from "vitest";
import { resolveProjectileBehavior } from "./projectileBehavior";

const NO_EXOTICS = { pierce: 0, bounce: 0, fork: 0, chain: 0, blastRadius: 0 };

describe("resolveProjectileBehavior — baseline", () => {
  it("with no exotic stats, hits exactly one target at full damage", () => {
    const behavior = resolveProjectileBehavior(NO_EXOTICS);
    expect(behavior.hitFractions).toEqual([1]);
    expect(behavior.avgTargetsHit).toBe(1);
    expect(behavior.totalDamageFraction).toBe(1);
  });
});

describe("resolveProjectileBehavior — pierce", () => {
  it("spends a full+partial budget across pierced targets (weapons.spec.todo.md worked example)", () => {
    // pierce 2.25 -> guaranteed first hit (1) + pierce budget 2.25 spent as
    // [1, 1, 0.25]: full damage through three targets total, a quarter to a fourth.
    const behavior = resolveProjectileBehavior({ ...NO_EXOTICS, pierce: 2.25 });
    expect(behavior.hitFractions).toEqual([1, 1, 1, 0.25]);
    expect(behavior.avgTargetsHit).toBe(4);
    expect(behavior.totalDamageFraction).toBeCloseTo(3.25, 10);
  });

  it("an exact integer pierce budget produces no trailing partial hit", () => {
    const behavior = resolveProjectileBehavior({ ...NO_EXOTICS, pierce: 2 });
    expect(behavior.hitFractions).toEqual([1, 1, 1]);
  });

  it("zero pierce still guarantees the one hit", () => {
    const behavior = resolveProjectileBehavior({ ...NO_EXOTICS, pierce: 0 });
    expect(behavior.hitFractions).toEqual([1]);
  });
});

describe("resolveProjectileBehavior — bounce", () => {
  it("decays geometrically per bounce and stops below the damage floor", () => {
    // bounce 0.5: 0.5, 0.25, 0.125, 0.0625, (0.03125 < default floor 0.05 -> stop)
    const behavior = resolveProjectileBehavior({ ...NO_EXOTICS, bounce: 0.5 });
    expect(behavior.hitFractions).toEqual([1, 0.5, 0.25, 0.125, 0.0625]);
  });

  it("zero bounce contributes no extra hits", () => {
    const behavior = resolveProjectileBehavior({ ...NO_EXOTICS, bounce: 0 });
    expect(behavior.hitFractions).toEqual([1]);
  });

  it("a bounce stat above 100% is capped by maxBounces, not an infinite loop", () => {
    const behavior = resolveProjectileBehavior(
      { ...NO_EXOTICS, bounce: 1.5 },
      { maxBounces: 3 }
    );
    // every bounce fraction grows (1.5^1, 1.5^2, 1.5^3) so the floor never
    // triggers; maxBounces is the only thing that bounds it.
    expect(behavior.hitFractions).toHaveLength(1 + 3);
  });
});

describe("resolveProjectileBehavior — chain", () => {
  it("adds a flat number of full-fraction jumps", () => {
    const behavior = resolveProjectileBehavior({ ...NO_EXOTICS, chain: 3 });
    expect(behavior.hitFractions).toEqual([1, 1, 1, 1]);
  });

  it("floors a fractional chain count", () => {
    const behavior = resolveProjectileBehavior({ ...NO_EXOTICS, chain: 2.9 });
    expect(behavior.hitFractions).toEqual([1, 1, 1]);
  });
});

describe("resolveProjectileBehavior — representative stacks", () => {
  it("pierce + fork: every shot splits and each half keeps tunneling", () => {
    const behavior = resolveProjectileBehavior({ ...NO_EXOTICS, pierce: 2.25, fork: 1 });
    // single line is [1, 1, 1, 0.25] (4 hits); fork=1 -> 2 independent copies.
    expect(behavior.hitFractions).toEqual([1, 1, 1, 0.25, 1, 1, 1, 0.25]);
    expect(behavior.avgTargetsHit).toBe(8);
  });

  it("chain + blast: chain jumps each also trigger a splash bonus", () => {
    const behavior = resolveProjectileBehavior(
      { ...NO_EXOTICS, chain: 3, blastRadius: 100 },
      { blastTargetsPerPx: 0.01, blastDamageFraction: 0.5 }
    );
    expect(behavior.hitFractions).toEqual([1, 1, 1, 1]);
    // blastBonusTargets = blastRadius * blastTargetsPerPx * hitCount = 100 * 0.01 * 4
    expect(behavior.blastBonusTargets).toBeCloseTo(4, 10);
    expect(behavior.avgTargetsHit).toBeCloseTo(8, 10);
    expect(behavior.totalDamageFraction).toBeCloseTo(4 + 4 * 0.5, 10);
  });

  it("is pure and deterministic: identical stats produce identical behavior", () => {
    const stats = { ...NO_EXOTICS, pierce: 1.5, bounce: 0.4, fork: 2, chain: 1, blastRadius: 30 };
    const a = resolveProjectileBehavior(stats);
    const b = resolveProjectileBehavior(stats);
    expect(a).toEqual(b);
  });
});
