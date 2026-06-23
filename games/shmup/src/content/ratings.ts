/**
 * Ratings tier ladder (specs/hype-and-ratings.spec.todo.md) — the 90s fame
 * progression Ratings converts into. "The tier name IS the progress bar."
 *
 * This is the single source of truth for tier ids, names, and rank order.
 * Noah edits names/order here; nothing elsewhere hard-codes a tier name.
 */
export const RATINGS_LADDER = [
  { id: "nobody", name: "Nobody" },
  { id: "has-been", name: "Has-Been" },
  { id: "cult-following", name: "Cult Following" },
  { id: "local-legend", name: "Local Legend" },
  { id: "up-and-comer", name: "Up-and-Comer" },
  { id: "household-name", name: "Household Name" },
  { id: "radical", name: "Radical 🤙" },
  { id: "kevin-bacon", name: "Kevin Bacon" },
] as const;

export type RatingsTierId = (typeof RATINGS_LADDER)[number]["id"];

/** Display name for a tier; never throws on an unknown id. */
export function ratingsTierName(id: RatingsTierId | string): string {
  return RATINGS_LADDER.find((t) => t.id === id)?.name ?? `[missing tier: ${id}]`;
}

/** 0-indexed rank in the ladder (low → high); -1 if the id isn't found. */
export function ratingsTierRank(id: RatingsTierId | string): number {
  return RATINGS_LADDER.findIndex((t) => t.id === id);
}
