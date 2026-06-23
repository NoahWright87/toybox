# SHMUP Content — Authoring Guide

This directory is the single home for every player-facing string in SHMUP.
**Editing a line here is a one-file change — zero systems code.** Nothing
in `scenes/` or `systems/` should ever have an inline string; it calls into
this layer instead.

Every lookup function here is safe: a missing key or id returns a visible
placeholder (`[missing: foo]`) instead of throwing, so a bad reference is
obvious in-game without crashing anything.

## Files

| File | What it holds |
|---|---|
| `copy.ts` | The flat string table — titles, flavor text, node text, weapon/item/enemy names+descriptions. |
| `ratings.ts` | The Ratings tier ladder (Nobody → … → Kevin Bacon) — ordered, names, rank lookup. |
| `brands.ts` | Sponsor brand names, taglines, and personalities. |
| `tags.ts` | The typed tag vocabulary (event, stage timing, damage source, trend, crowd size, tier). |
| `crowdComments.ts` | The crowd-comment pool + the tag-matching weighted picker. |
| `interpolate.ts` | The `{token}` substitution helper shared by `copy()` and the crowd-comment picker. |
| `index.ts` | Public exports. Everything outside this directory imports from `../content` (or `./content`), never from an individual file. |

## Adding/editing flat copy (`copy.ts`)

Add a new dotted key in the right section of the `COPY` object, or edit an
existing line's value in place — that's it. Keys are grouped by namespace
in comments; put new keys in the matching group rather than starting a new
one. For weapon/item/chassis/enemy text, follow the existing convention:

```ts
"weapon.<id>.name": "...",
"weapon.<id>.description": "...",
```

(same shape for `item.`, `chassis.`, `enemy.`). Code looks it up with
`copy("weapon.laser.name")`.

Strings can contain `{token}` placeholders, filled at call time:

```ts
"cancelled.flavor": "The execs pulled the plug, {playerName}. Better luck next career.",
```

```ts
copy("cancelled.flavor", { playerName: "Noah" });
```

A placeholder with no matching token is left as literal text (`{playerName}`)
rather than throwing.

## Editing the Ratings ladder (`ratings.ts`)

`RATINGS_LADDER` is an ordered array, low tier to high. Rename a tier or
reorder the array directly — `ratingsTierName()` and `ratingsTierRank()`
read from this array, so there's nothing else to keep in sync.

## Editing sponsor brands (`brands.ts`)

Add an entry to `BRANDS` keyed by a short id. `personality` should read as
a build archetype (what kind of build owning this brand's items signals),
since that's the text players actually see on item synergy hints.

## Adding a tag *value* (`tags.ts`)

Each tag dimension is a string-literal union, e.g.:

```ts
export type CrowdEventTag = "death" | "hit" | "graze" | "clear" | "levelStart" | "bossIntro" | "scoreGain";
```

Add a new value to the union it belongs to. Every line/context that
references that union gets autocomplete and a compile error on typos —
this is what "tags are a single typed source of truth" means in practice.

Adding a whole new *dimension* (rare) means adding a new union here, then a
matching optional field to both `CrowdCommentLine` and `CrowdCommentContext`
in `crowdComments.ts`, plus a branch in that file's `matches()`/`weight()`.

## Adding a crowd-comment line (`crowdComments.ts`)

Append an object to `CROWD_COMMENTS`. Every field but `says` is optional;
an omitted field is a **wildcard** — the line is eligible regardless of
that part of the context. The exception is `minStreak`, a numeric floor
(the line is eligible once `context.streak >= minStreak`).

```ts
{ when: "death", at: "early", says: "That's it?! These seats cost me $5000!!" }
{ when: "death", tier: "has-been", trend: "falling", says: "Oh, how the mighty have fallen." }
{ when: "graze", minStreak: 5, says: "DUUUUDE!!" }
{ says: "We love you {playerName}!!" }   // no tags = generic filler, still eligible for everything
```

**Weighting:** among lines eligible for a given context, pick weight is
`1 + (number of tags the line specifies)`. So a line with three matching
tags is far more likely to be picked than a zero-tag filler line whenever
both apply — specific zingers win when they're relevant, but generic filler
keeps the pool from going silent when nothing specific fits. You don't
manage weights by hand; just add tags to make a line more specific.

Call `pickCrowdComment(context)` to get a string (already token-interpolated)
or `undefined` if nothing in the pool matches the context.
