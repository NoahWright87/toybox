/**
 * Persistent Ratings — Model 1 conversion (hype-and-ratings.spec.md,
 * F7 #135). Hype is rewarded exactly once via ScoreMult during the episode;
 * these functions must never apply a second Hype multiplier on top of
 * EpisodeScore, which is already Hype-inflated.
 */
import { TUNING } from "../../tuning";

/** on clear: RatingsGain = EpisodeScore x CrowdConversion x ratingsMods. */
export function ratingsGainOnClear(episodeScore: number, ratingsMods = 1): number {
  return episodeScore * TUNING.ratings.crowdConversion * ratingsMods;
}

/**
 * on death: RatingsLoss = BasePenalty x (1 - stageProgress) x embarrassmentMod.
 * stageProgress in [0, 1] -- how far into the episode death occurred; dying
 * early loses more than dying near the end. The episode's would-be
 * RatingsGain is simply never banked (caller doesn't call ratingsGainOnClear).
 */
export function ratingsLossOnDeath(stageProgress: number, embarrassmentMod: number = TUNING.ratings.deathEmbarrassmentMod): number {
  const progress = Math.min(1, Math.max(0, stageProgress));
  return TUNING.ratings.deathBasePenalty * (1 - progress) * embarrassmentMod;
}

/** Applies a signed Ratings delta (positive gain or negative loss); cancelled = cumulative Ratings < 0. */
export function applyRatingsDelta(current: number, delta: number): { ratings: number; cancelled: boolean } {
  const ratings = current + delta;
  return { ratings, cancelled: ratings < 0 };
}
