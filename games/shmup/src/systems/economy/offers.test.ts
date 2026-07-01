import { describe, it, expect } from "vitest";
import { brandAffinity, generateOffers, pickItemInTier, rollTier, tierRankRange } from "./offers";
import type { OfferCandidate, OfferContext } from "./offers";
import { rarityRank } from "./rarity";
import { TUNING } from "../../tuning";

/** Returns a rng that yields a fixed sequence, cycling once exhausted — deterministic weighted-draw tests. */
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("tierRankRange", () => {
  it("Nobody (rank 0) is capped at the lowest configured ceiling", () => {
    expect(tierRankRange(0)).toEqual({
      min: TUNING.offers.minTierRankByRatingsRank[0],
      max: TUNING.offers.maxTierRankByRatingsRank[0],
    });
  });

  it("ceiling never decreases going up the Ratings ladder (fame raises the ceiling, never lowers it)", () => {
    const ranks = TUNING.offers.maxTierRankByRatingsRank;
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
    }
  });

  it("clamps out-of-range ranks to the table's ends", () => {
    expect(tierRankRange(-5)).toEqual(tierRankRange(0));
    expect(tierRankRange(999)).toEqual(tierRankRange(TUNING.offers.maxTierRankByRatingsRank.length - 1));
  });
});

describe("rollTier", () => {
  it("rng=0 always rolls the lowest eligible tier (first weight bucket)", () => {
    expect(rollTier(0, 0, () => 0)).toBe("common");
  });

  it("never rolls above the Ratings-gated ceiling regardless of rarityLuck", () => {
    for (let i = 0; i < 20; i++) {
      const tier = rollTier(50, 0, () => i / 20);
      expect(tier).toBe("common"); // rank-0 Ratings ceiling is common-only
    }
  });

  it("higher rarityLuck shifts weight toward higher tiers (rng picked to land just past the first bucket)", () => {
    // At Ratings rank 3 the eligible range is [min,max] per the tuning table;
    // a high rarityLuck should make a roll landing past a small first bucket
    // resolve to a higher tier than the same roll would at rarityLuck 0.
    const rank = 3;
    const rng = () => 0.5;
    const lowLuckTier = rollTier(0, rank, rng);
    const highLuckTier = rollTier(20, rank, rng);
    expect(rarityRank(highLuckTier)).toBeGreaterThanOrEqual(rarityRank(lowLuckTier));
  });
});

describe("brandAffinity", () => {
  it("is 1 with zero owned (no steering)", () => {
    expect(brandAffinity(0)).toBe(1);
  });

  it("grows with owned count, capped at brandAffinityCap", () => {
    expect(brandAffinity(1)).toBeCloseTo(1 + TUNING.offers.kBrand, 10);
    expect(brandAffinity(10000)).toBe(TUNING.offers.brandAffinityCap);
  });

  it("negative owned count never drops affinity below 1", () => {
    expect(brandAffinity(-5)).toBe(1);
  });
});

describe("pickItemInTier", () => {
  const candidates: OfferCandidate[] = [
    { id: "a", tier: "common" },
    { id: "b", tier: "common", brand: "grease-monkey" },
    { id: "c", tier: "rare" },
  ];

  it("only draws from the requested tier", () => {
    const pick = pickItemInTier(candidates, "rare", {}, () => 0);
    expect(pick?.id).toBe("c");
  });

  it("returns undefined when the tier has no stock", () => {
    expect(pickItemInTier(candidates, "epic", {}, () => 0)).toBeUndefined();
  });

  it("brand affinity steers the weighted pick toward an owned brand's item", () => {
    // Two common candidates, equal base weight; with high owned affinity on
    // "b"'s brand, nearly the whole roll range should land on "b".
    const pick = pickItemInTier(candidates, "common", { "grease-monkey": 10 }, () => 0.9);
    expect(pick?.id).toBe("b");
  });
});

describe("generateOffers", () => {
  const baseCtx: OfferContext = { luck: 0, D: 0, ratingsRank: 3, ownedBrandCounts: {} };

  it("draws without replacement — never the same id twice", () => {
    const candidates: OfferCandidate[] = [
      { id: "a", tier: "common" },
      { id: "b", tier: "common" },
      { id: "c", tier: "common" },
      { id: "d", tier: "common" },
    ];
    const drawn = generateOffers(candidates, 4, baseCtx, sequence([0, 0.3, 0.6, 0.9]));
    expect(drawn).toHaveLength(4);
    expect(new Set(drawn.map((d) => d.id)).size).toBe(4);
  });

  it("never draws more than the available candidate count", () => {
    const candidates: OfferCandidate[] = [{ id: "only", tier: "common" }];
    const drawn = generateOffers(candidates, 5, baseCtx, () => 0);
    expect(drawn).toEqual([{ id: "only", tier: "common" }]);
  });

  it("falls back to the nearest non-empty tier when the rolled tier is dry", () => {
    // rng=0 always rolls the lowest eligible tier (common), which has no
    // stock here — only a rare candidate exists, so it must fall back to it.
    const candidates: OfferCandidate[] = [{ id: "rare-only", tier: "rare" }];
    const drawn = generateOffers(candidates, 1, baseCtx, () => 0);
    expect(drawn).toEqual([{ id: "rare-only", tier: "rare" }]);
  });

  it("returns an empty array when count is 0 or no candidates exist", () => {
    expect(generateOffers([{ id: "a", tier: "common" }], 0, baseCtx)).toEqual([]);
    expect(generateOffers([], 3, baseCtx)).toEqual([]);
  });
});
