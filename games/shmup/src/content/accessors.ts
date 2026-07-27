/**
 * All lookup/picking logic for the content registry lives here. The data
 * files (copy.ts, ratings.ts, brands.ts, crowdComments.ts, tags.ts) are
 * pure content — exported literals and types, no functions — so an
 * authoring change to those files is never a code change. This file is the
 * one place behavior is allowed to live.
 */
import { COPY } from "./copy";
import { RATINGS_LADDER, type RatingsTierId } from "./ratings";
import { BRANDS, type BrandId, type SponsorBrand } from "./brands";
import { CROWD_COMMENTS, type CrowdCommentLine } from "./crowdComments";
import type { CrowdTag } from "./tags";
import { interpolate } from "./interpolate";

export type CopyKey = keyof typeof COPY;

/**
 * Look up a line by key; never throws. A missing key returns a visible
 * `[missing: key]` fallback so a bad reference is obvious without crashing
 * the game. Optional `tokens` interpolate `{name}`-style placeholders.
 */
export function copy(key: CopyKey | string, tokens?: Record<string, string | number>): string {
  const template = (COPY as Record<string, string>)[key];
  if (template === undefined) return `[missing: ${key}]`;
  return interpolate(template, tokens);
}

/** Display name for a Ratings tier; never throws on an unknown id — returns `[missing tier: id]`. */
export function ratingsTierName(id: RatingsTierId | string): string {
  return RATINGS_LADDER.find((t) => t.id === id)?.name ?? `[missing tier: ${id}]`;
}

/** Rank in the ladder ordered by threshold (low → high); -1 if the id isn't found. */
export function ratingsTierRank(id: RatingsTierId | string): number {
  return [...RATINGS_LADDER].sort((a, b) => a.threshold - b.threshold).findIndex((t) => t.id === id);
}

/** Which tier a given cumulative Ratings score currently falls in. */
export function ratingsTierForScore(score: number): RatingsTierId {
  const eligible = RATINGS_LADDER.filter((t) => score >= t.threshold);
  if (eligible.length === 0) return RATINGS_LADDER[0].id;
  return eligible.reduce((best, t) => (t.threshold > best.threshold ? t : best)).id;
}

/** Look up a sponsor brand by id; never throws on an unknown id — returns a `[missing brand: id]` stub. */
export function brand(id: BrandId | string): SponsorBrand {
  return (
    (BRANDS as Record<string, SponsorBrand>)[id] ?? {
      name: `[missing brand: ${id}]`,
      tagline: "",
      personality: "",
    }
  );
}

/** What the audience service knows about the moment it's reacting to. */
export interface CrowdCommentContext {
  /** Every tag that's true right now — event + situational state, all flattened. */
  tags: readonly CrowdTag[];
  /** Values for `{token}` interpolation, e.g. `{ playerName: "Noah" }`. */
  tokens?: Record<string, string | number>;
}

function isEligible(line: CrowdCommentLine, activeTags: readonly CrowdTag[]): boolean {
  return line.tags.every((tag) => activeTags.includes(tag));
}

/** More tags on a line = more specific = higher weight; untagged filler still gets a baseline weight of 1. */
function commentWeight(line: CrowdCommentLine): number {
  return 1 + line.tags.length;
}

/**
 * Filter the pool to lines whose tags are all present in the context, then
 * draw a weighted random pick favoring the most specific matches. Returns
 * undefined if nothing in the pool applies — the caller decides the
 * fallback (typically: stay silent rather than show a broken line).
 */
export function pickCrowdComment(
  ctx: CrowdCommentContext,
  rng: () => number = Math.random
): string | undefined {
  const eligible = CROWD_COMMENTS.filter((line) => isEligible(line, ctx.tags));
  if (eligible.length === 0) return undefined;

  const total = eligible.reduce((sum, line) => sum + commentWeight(line), 0);
  let roll = rng() * total;
  for (const line of eligible) {
    roll -= commentWeight(line);
    if (roll <= 0) return interpolate(line.says, ctx.tokens);
  }
  return interpolate(eligible[eligible.length - 1].says, ctx.tokens);
}
