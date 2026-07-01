/**
 * Career construction/transition helpers — pure functions over CareerState.
 * Persistence (loadCareer/saveCareer) lives in persistence.ts.
 */
import { generateSeasonMap } from "../map";
import { ratingsTierForScore, ratingsTierRank } from "../../content";
import { CAREER_STATE_VERSION } from "./types";
import type { CareerState, OwnedWeaponRef } from "./types";

const STARTING_WEAPONS: OwnedWeaponRef[] = [{ weaponId: "placeholder", tier: 0 }];

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function ratingsRankFor(ratings: number): number {
  return Math.max(0, ratingsTierRank(ratingsTierForScore(ratings)));
}

/** A brand-new career: Season 1, a fresh map, no meta-progression from any prior career. */
export function createNewCareer(startingRatings = 0, seed: number = randomSeed()): CareerState {
  return {
    version: CAREER_STATE_VERSION,
    ratings: startingRatings,
    season: 1,
    seasonMap: generateSeasonMap(1, ratingsRankFor(startingRatings), seed),
    currentNodeId: null,
    visitedNodeIds: [],
    deadlinePosition: 0,
    weapons: STARTING_WEAPONS,
    phase: "career",
    syndicationEpisodeIndex: 0,
    finaleScore: null,
    syndicationScore: null,
    savedAt: Date.now(),
  };
}

/**
 * Season always advances, win or lose (run-structure.spec.todo.md) — the
 * caller decides whether the just-resolved boss was a win or a loss and
 * applies any Ratings delta before calling this; it only owns the map/season
 * bookkeeping. The deadline and node history reset — each Season is its own
 * pursuit, run against a freshly generated map.
 */
export function advanceToNextSeason(state: CareerState, seed: number = randomSeed()): CareerState {
  const season = state.season + 1;
  return {
    ...state,
    season,
    seasonMap: generateSeasonMap(season, ratingsRankFor(state.ratings), seed),
    currentNodeId: null,
    visitedNodeIds: [],
    deadlinePosition: 0,
    savedAt: Date.now(),
  };
}
