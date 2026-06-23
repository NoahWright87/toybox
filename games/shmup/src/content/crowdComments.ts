/**
 * The crowd-comment pool — the showcase for "copy is an asset"
 * (specs/audience-and-score.spec.todo.md, specs/content-and-assets.spec.todo.md).
 *
 * The studio audience reacts with tagged one-liners. A reaction carries a
 * *context* (what happened + facts); a line is eligible only if every tag
 * it specifies matches the context — an unspecified field is a wildcard.
 * Among eligible lines, **more matching tags = higher pick weight**, so
 * generic filler and hyper-specific zingers can live in the same pool and
 * the specific line wins when it applies.
 *
 * Adding or editing a line is a one-file change to CROWD_COMMENTS below.
 * See ./README.md for the authoring guide.
 */
import type {
  CrowdEventTag,
  StageTimingTag,
  DamageSourceTag,
  TrendTag,
  CrowdSizeTag,
  RatingsTierId,
} from "./tags";
import { interpolate } from "./interpolate";

/**
 * One line in the pool. Every field but `says` is an optional tag; leaving
 * a field out makes the line a wildcard on that dimension.
 */
export interface CrowdCommentLine {
  says: string;
  when?: CrowdEventTag;
  at?: StageTimingTag;
  damageSource?: DamageSourceTag;
  tier?: RatingsTierId;
  trend?: TrendTag;
  crowdSize?: CrowdSizeTag;
  /** Eligible only when the context's streak is at least this high. */
  minStreak?: number;
}

/** What the audience service knows about the moment it's reacting to. */
export interface CrowdCommentContext {
  event: CrowdEventTag;
  stageTiming?: StageTimingTag;
  damageSource?: DamageSourceTag;
  tier?: RatingsTierId;
  trend?: TrendTag;
  crowdSize?: CrowdSizeTag;
  streak?: number;
  /** Values for `{token}` interpolation, e.g. `{ playerName: "Noah" }`. */
  tokens?: Record<string, string | number>;
}

const TAG_FIELDS: readonly (keyof CrowdCommentLine)[] = [
  "when",
  "at",
  "damageSource",
  "tier",
  "trend",
  "crowdSize",
  "minStreak",
];

function matches(line: CrowdCommentLine, ctx: CrowdCommentContext): boolean {
  if (line.when !== undefined && line.when !== ctx.event) return false;
  if (line.at !== undefined && line.at !== ctx.stageTiming) return false;
  if (line.damageSource !== undefined && line.damageSource !== ctx.damageSource) return false;
  if (line.tier !== undefined && line.tier !== ctx.tier) return false;
  if (line.trend !== undefined && line.trend !== ctx.trend) return false;
  if (line.crowdSize !== undefined && line.crowdSize !== ctx.crowdSize) return false;
  if (line.minStreak !== undefined && (ctx.streak ?? 0) < line.minStreak) return false;
  return true;
}

/** Pick weight: a baseline of 1 (so wildcard filler is never zero) plus one per specified tag. */
function weight(line: CrowdCommentLine): number {
  const specified = TAG_FIELDS.filter((field) => line[field] !== undefined).length;
  return 1 + specified;
}

// Author format (illustrative, from #130): unspecified fields are wildcards.
// Keep specific zingers and generic filler side by side — specificity is
// handled entirely by the weighting in pickCrowdComment, not by file order.
export const CROWD_COMMENTS: readonly CrowdCommentLine[] = [
  // Generic filler — always eligible, lowest weight.
  { says: "We love you {playerName}!!" },
  { says: "Let's go!!" },
  { says: "Come on, let's see something good!" },

  // Hits / death.
  { when: "hit", says: "Booooo!" },
  { when: "death", says: "Aw, come on!" },
  { when: "death", at: "early", says: "That's it?! These seats cost me $5000!!" },
  { when: "death", tier: "has-been", trend: "falling", says: "Oh, how the mighty have fallen." },
  { when: "death", at: "boss", says: "SO CLOSE! SO CLOSE!" },

  // Grazing.
  { when: "graze", says: "Whoooaaa!" },
  { when: "graze", minStreak: 5, says: "DUUUUDE!!" },
  { when: "graze", minStreak: 10, crowdSize: "packed", says: "THIS PLACE IS LOSING IT!!" },

  // Clears / comebacks.
  { when: "clear", says: "And the crowd goes wild!" },
  { when: "clear", trend: "comeback", says: "HE'S STILL GOT IT!" },
  { when: "clear", tier: "kevin-bacon", says: "Of course he cleared it. He's Kevin Bacon." },

  // Episode/boss framing.
  { when: "levelStart", says: "Here we go, here we go!" },
  { when: "bossIntro", says: "Ooooooh, here we go!" },
  { when: "bossIntro", crowdSize: "large", says: "EVERYBODY ON YOUR FEET!" },

  // Score.
  { when: "scoreGain", says: "Ka-ching!" },
  { when: "scoreGain", crowdSize: "packed", says: "THE WHOLE PLACE IS GOING NUTS!" },
] as const;

/**
 * Filter the pool to lines whose tags all match the context, then draw a
 * weighted random pick favoring the most specific matches. Returns
 * undefined if nothing in the pool applies — the caller decides the
 * fallback (typically: stay silent rather than show a broken line).
 */
export function pickCrowdComment(
  ctx: CrowdCommentContext,
  rng: () => number = Math.random
): string | undefined {
  const eligible = CROWD_COMMENTS.filter((line) => matches(line, ctx));
  if (eligible.length === 0) return undefined;

  const total = eligible.reduce((sum, line) => sum + weight(line), 0);
  let roll = rng() * total;
  for (const line of eligible) {
    roll -= weight(line);
    if (roll <= 0) return interpolate(line.says, ctx.tokens);
  }
  return interpolate(eligible[eligible.length - 1].says, ctx.tokens);
}
