/**
 * The tag vocabulary — single typed source of truth (specs/content-and-
 * assets.spec.todo.md, F2 #130). Crowd-comment lines and the contexts that
 * match against them both reference these unions, never raw strings, so a
 * typo is a compile error instead of a silently-dead line.
 *
 * Add a new tag *value* by extending the relevant union below. Add a new
 * tag *dimension* by adding a union here, then a matching optional field on
 * both `CrowdCommentLine` and `CrowdCommentContext` in ./crowdComments.ts.
 */
import type { RatingsTierId } from "./ratings";

export type { RatingsTierId };

/** What happened — the event the audience is reacting to. */
export type CrowdEventTag =
  | "death"
  | "hit"
  | "graze"
  | "clear"
  | "levelStart"
  | "bossIntro"
  | "scoreGain";

/** Where in the episode it happened. */
export type StageTimingTag = "early" | "mid" | "late" | "boss";

/** What dealt the damage, for hit/death reactions. */
export type DamageSourceTag = "contact" | "projectile" | "boss" | "hazard";

/** Career trajectory — current tier vs. the player's peak. */
export type TrendTag = "rising" | "falling" | "comeback";

/** How big (and how rowdy) the studio audience currently is. */
export type CrowdSizeTag = "small" | "medium" | "large" | "packed";
