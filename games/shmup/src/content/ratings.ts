/**
 * Ratings tier ladder (specs/hype-and-ratings.spec.md) — the 90s fame
 * progression Ratings converts into. "The tier name IS the progress bar."
 *
 * Pure content: id, display name, and `threshold` — the cumulative Ratings
 * score needed to reach that tier, which is what gives the ladder its
 * inherent ordering (not file position). Thresholds here are placeholders;
 * hype-and-ratings.spec.md calls out the real constants as TBD for the
 * balance pass. Lookup/accessor logic lives in ./accessors.ts, not here.
 */
export const RATINGS_LADDER = [
  { id: "nobody", name: "Nobody", threshold: 0 },
  { id: "has-been", name: "Has-Been", threshold: 100 },
  { id: "cult-following", name: "Cult Following", threshold: 500 },
  { id: "local-legend", name: "Local Legend", threshold: 1500 },
  { id: "up-and-comer", name: "Up-and-Comer", threshold: 4000 },
  { id: "household-name", name: "Household Name", threshold: 10000 },
  { id: "radical", name: "Radical 🤙", threshold: 25000 },
  { id: "kevin-bacon", name: "Kevin Bacon", threshold: 60000 },
] as const;

export type RatingsTierId = (typeof RATINGS_LADDER)[number]["id"];
