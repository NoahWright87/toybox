# SHMUP Content — Authoring Guide

This directory is the intended single home for every player-facing string
in SHMUP. **Editing a line here is a one-file change — zero systems code.**
New code should always call into this layer instead of inlining a string.

(Note on current state: the existing scaffold scenes — `BootScene.ts`,
`PlayScene.ts` — still have a few placeholder inline UI strings left over
from the early prototype slice. Those haven't been migrated yet; this guide
describes where things are headed, not a claim that every string already
routes through here.)

## Content vs. logic

Files are split so content stays edit-only and logic stays in one place:

| File | What it holds | Kind |
|---|---|---|
| `copy.ts` | The flat string table — titles, flavor text, node text, weapon/item/chassis/enemy names+descriptions. | content |
| `ratings.ts` | The Ratings tier ladder (Nobody → … → Kevin Bacon), each with a `threshold` score. | content |
| `brands.ts` | Sponsor brand names, taglines, and personalities. | content |
| `tags.ts` | The flat, typed tag vocabulary used by the crowd-comment pool. | content (types) |
| `crowdComments.ts` | The crowd-comment pool — each line is just a list of tags + a string. | content |
| `accessors.ts` | Every lookup/picking function (`copy`, `ratingsTierName`, `brand`, `pickCrowdComment`, …). | logic |
| `interpolate.ts` | The `{token}` substitution helper shared by several accessors. | logic |
| `index.ts` | Public exports. Everything outside this directory imports from `../content` (or `./content`), never from an individual file. | barrel |

The content files are intentionally close to plain JSON — just exported
array/object literals, occasionally typed against a union from `tags.ts` so
typos are caught at compile time. **Never add a function to a content
file** — if you need new behavior, add it to `accessors.ts`.

## Safe fallbacks (each accessor degrades differently — none ever throw)

| Accessor | On a missing key/id |
|---|---|
| `copy(key)` | Returns the literal string `[missing: key]`. |
| `ratingsTierName(id)` | Returns the literal string `[missing tier: id]`. |
| `brand(id)` | Returns a stub `SponsorBrand` whose `name` is `[missing brand: id]` and `tagline`/`personality` are empty strings. |
| `pickCrowdComment(ctx)` | Returns `undefined` if no line in the pool matches the context — the caller decides the fallback (typically: say nothing). |

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

Each tier has an `id`, a display `name`, and a `threshold` — the cumulative
Ratings score needed to reach that tier. The `threshold` is what gives the
ladder its ordering (not array position), so you can reorder entries in the
file for readability without affecting rank or tier lookups. Rename a tier,
adjust a threshold, or insert a new tier directly; `ratingsTierName()`,
`ratingsTierRank()`, and `ratingsTierForScore()` (in `accessors.ts`) all
read from this array, so there's nothing else to keep in sync. Thresholds
here are placeholders — the real balance numbers are TBD per
`hype-and-ratings.spec.md`.

## Editing sponsor brands (`brands.ts`)

Add an entry to `BRANDS` keyed by a short id. `personality` should read as
a build archetype (what kind of build owning this brand's items signals),
since that's the text players actually see on item synergy hints.

## Adding a tag (`tags.ts`)

`CrowdTag` is one flat string-literal union — not separate named fields per
category. Add a new value to the union and it's immediately usable on any
line or context, with autocomplete and a compile error on typos. There's no
separate "dimension" concept to wire up: tags for *when* something happened,
*what* happened, *how big* the crowd is, etc. all live in the same union and
are matched the same way.

Numeric facts (like a graze streak count) aren't tags by themselves —
whoever builds the context decides which bucket tag(s) apply (e.g. a streak
of 12 includes both `grazeStreak5` and `grazeStreak10`) and includes them in
the `tags` array passed to `pickCrowdComment`.

## Adding a crowd-comment line (`crowdComments.ts`)

Append an object to `CROWD_COMMENTS`. Each line is just `{ tags, says }`:

```ts
{ tags: ["death", "earlyGame"], says: "That's it?! These seats cost me $5000!!" }
{ tags: ["death", "has-been", "falling"], says: "Oh, how the mighty have fallen." }
{ tags: ["graze", "grazeStreak5"], says: "DUUUUDE!!" }
{ tags: [], says: "We love you {playerName}!!" }   // no tags = generic filler, still eligible for everything
```

A line is eligible when **every** tag it lists is present in the current
context's tag list. An empty `tags` array is eligible for any context.

**Weighting:** among eligible lines, pick weight is `1 + (number of tags on
the line)`. So a line with three tags is far more likely to be picked than
a zero-tag filler line whenever both apply — specific zingers win when
they're relevant, but generic filler keeps the pool from going silent when
nothing specific fits. You don't manage weights by hand; just add tags to
make a line more specific.

Call `pickCrowdComment({ tags: [...active tags...], tokens })` to get a
string (already token-interpolated) or `undefined` if nothing in the pool
matches.
