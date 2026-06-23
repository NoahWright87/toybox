/**
 * Content / copy registry — "copy is an asset" (specs/content-and-assets.spec.todo.md).
 *
 * All player-facing text lives in this directory as data, referenced by
 * key. Noah edits these files; systems code never inlines strings. Missing
 * keys/ids degrade gracefully (never throw). See ./README.md for the full
 * authoring guide.
 *
 * Public surface:
 * - `copy(key, tokens?)` — the flat string table (./copy.ts), with `{token}` interpolation.
 * - `ratingsTierName` / `ratingsTierRank` / `RATINGS_LADDER` — the fame ladder (./ratings.ts).
 * - `brand(id)` / `BRANDS` — sponsor brand names/taglines/personalities (./brands.ts).
 * - `pickCrowdComment(context)` — the tag-matched, weighted crowd-comment pool (./crowdComments.ts).
 * - The tag dimension types (./tags.ts) used to build a `CrowdCommentContext`.
 */
import { COPY } from "./copy";
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

export { COPY };
export { interpolate };
export * from "./tags";
export * from "./ratings";
export * from "./brands";
export * from "./crowdComments";
