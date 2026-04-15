# Word Whirlwind — Current State

## Related

- [`spec.md`](spec.md)

## Overview

An unscramble/word-finding game. A set of scrambled letters is shown; the player builds words by clicking letter tiles. Multiple word groups (2–7 letter words) are hidden and must be found. Built on a shared word dictionary utility.

## Route

`/word-whirlwind`

## Game modes

| Mode | Description |
|---|---|
| Freeplay | No timer; play at your own pace |
| Standard | Timed rounds; lose time for wrong guesses |
| Strict | Timed rounds; no second chances |

## Setup screen

- Title with gradient treatment
- Mode selector (Freeplay / Standard / Strict) with hint text
- Start button

## Game layout

Three zones stacked vertically:
1. **Game bar** — round counter, mode pill, timer (Standard/Strict), score, quit button
2. **Word groups panel** — scrollable list of collapsible groups, each showing hidden word slots. Found words reveal letter-by-letter with staggered animation. Neighbor-deducible letters show as hints.
3. **Input area** — flash message, letter board (selected tiles in order), controls row (Clear / Shuffle / Submit / Advance), letter pool

## Letter tiles

- Pool tiles are clickable; clicking moves a letter to the board.
- Board slots are clickable to remove a letter back to the pool.
- Shuffle randomizes the remaining pool.
- Submit checks the built word against the dictionary and word list.

## Scoring

- Points awarded per word found (longer words score more).
- Bonus points for finding all words in a group.
- Round summary overlay shows per-word breakdown, bonus, and running total.
- Game-over screen shows final score and rounds completed.

## Flash messages

- "Nice!" / word value on correct guess — green pill
- "Not a word" / "Already found" / "No letters" on wrong — red pill

## Animations

- Tile enter: scale + translateY bounce
- Found word: staggered letter reveal with pop
- Advance button: appears with scale-in animation after all words in a group are found

## Utilities

Word validation and dictionary lookups use `src/utils/wordDictionary.ts`, shared with other word-based experiences.
