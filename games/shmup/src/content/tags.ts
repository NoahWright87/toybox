/**
 * The crowd-comment tag vocabulary — single typed source of truth
 * (specs/content-and-assets.spec.todo.md, F2 #130). One flat pool of tags,
 * not named dimensions: a "context" is just the list of tags that are true
 * right now, and a line is eligible if every tag it carries is in that
 * list. Lines and contexts both reference this union, never raw strings,
 * so a typo is a compile error instead of a silently-dead line.
 *
 * Add a new tag by adding a value to the union below — nothing else needs
 * to change. (Numeric facts like a graze streak count aren't tags
 * themselves; whoever builds the context decides which bucket tags like
 * `grazeStreak5` apply and includes them.)
 */
import type { RatingsTierId } from "./ratings";

export type { RatingsTierId };

export type CrowdTag =
  // what happened
  | "death"
  | "hit"
  | "graze"
  | "clear"
  | "levelStart"
  | "bossIntro"
  | "scoreGain"
  // when in the episode
  | "earlyGame"
  | "midGame"
  | "lateGame"
  | "bossFight"
  // what dealt the damage (death/hit reactions)
  | "damageContact"
  | "damageProjectile"
  | "damageBoss"
  | "damageHazard"
  // career trajectory
  | "rising"
  | "falling"
  | "comeback"
  // how big (and rowdy) the studio audience is right now
  | "smallCrowd"
  | "mediumCrowd"
  | "largeCrowd"
  | "packedCrowd"
  // graze-streak buckets
  | "grazeStreak5"
  | "grazeStreak10"
  // current Ratings tier — the tier ids double as tags
  | RatingsTierId;
