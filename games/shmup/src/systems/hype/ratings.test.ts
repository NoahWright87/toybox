import { describe, it, expect } from "vitest";
import { ratingsGainOnClear, ratingsLossOnDeath, applyRatingsDelta } from "./ratings";
import { TUNING } from "../../tuning";

describe("ratingsGainOnClear", () => {
  it("converts EpisodeScore via crowdConversion, no extra Hype multiplier applied here", () => {
    const gain = ratingsGainOnClear(10000);
    expect(gain).toBeCloseTo(10000 * TUNING.ratings.crowdConversion, 10);
  });

  it("ratingsMods scales the gain", () => {
    const gain = ratingsGainOnClear(10000, 1.5);
    expect(gain).toBeCloseTo(10000 * TUNING.ratings.crowdConversion * 1.5, 10);
  });
});

describe("ratingsLossOnDeath", () => {
  it("loses the full base penalty when stageProgress is 0 (died immediately)", () => {
    expect(ratingsLossOnDeath(0)).toBeCloseTo(TUNING.ratings.deathBasePenalty * TUNING.ratings.deathEmbarrassmentMod, 10);
  });

  it("loses nothing when stageProgress is 1 (died right at the clear line)", () => {
    expect(ratingsLossOnDeath(1)).toBeCloseTo(0, 10);
  });

  it("clamps stageProgress into [0, 1]", () => {
    expect(ratingsLossOnDeath(-5)).toBeCloseTo(ratingsLossOnDeath(0), 10);
    expect(ratingsLossOnDeath(5)).toBeCloseTo(ratingsLossOnDeath(1), 10);
  });

  it("embarrassmentMod scales the loss", () => {
    expect(ratingsLossOnDeath(0, 2)).toBeCloseTo(TUNING.ratings.deathBasePenalty * 2, 10);
  });
});

describe("applyRatingsDelta", () => {
  it("adds a positive gain", () => {
    expect(applyRatingsDelta(100, 50)).toEqual({ ratings: 150, cancelled: false });
  });

  it("flags cancelled when the result drops below 0", () => {
    expect(applyRatingsDelta(10, -50)).toEqual({ ratings: -40, cancelled: true });
  });

  it("is not cancelled at exactly 0", () => {
    expect(applyRatingsDelta(10, -10)).toEqual({ ratings: 0, cancelled: false });
  });
});
