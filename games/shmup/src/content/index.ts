/**
 * Content / copy registry — "copy is an asset" (specs/content-and-assets.spec.todo.md).
 *
 * The intent is for every player-facing string and tagged content pool to
 * live in this directory as data, referenced by key/tag, so nothing in
 * `scenes/`/`systems/` ever inlines a string. New code should always go
 * through this layer. (Note: the existing scaffold scenes — BootScene,
 * PlayScene — still have some placeholder inline UI text left over from
 * the early prototype slice and haven't been migrated yet.)
 *
 * Content vs. logic split:
 * - copy.ts / ratings.ts / brands.ts / crowdComments.ts / tags.ts are pure
 *   content — exported literals and types only, no functions. Noah edits
 *   these; an authoring change never touches code with behavior.
 * - accessors.ts holds every lookup/picking function.
 * - interpolate.ts is the small shared `{token}` substitution helper.
 *
 * Public surface (everything below is what consumers outside content/ should import):
 */
export { COPY } from "./copy";
export { RATINGS_LADDER } from "./ratings";
export type { RatingsTierId } from "./ratings";
export { BRANDS } from "./brands";
export type { SponsorBrand, BrandId } from "./brands";
export { PLACEHOLDER_WEAPON, ALL_WEAPONS, weaponById } from "./weapons";
export { ALL_ITEMS, itemById } from "./items";
export { CROWD_COMMENTS } from "./crowdComments";
export type { CrowdCommentLine } from "./crowdComments";
export type { CrowdTag } from "./tags";
export { interpolate } from "./interpolate";
export {
  copy,
  ratingsTierName,
  ratingsTierRank,
  ratingsTierForScore,
  brand,
  pickCrowdComment,
} from "./accessors";
export type { CopyKey, CrowdCommentContext } from "./accessors";
