# Duck & Learn — Spec

A skeet-shooting game where clay pigeons display numbers, and players shoot the correct answers.

## Game flow

1. **Title screen** — shows the game name, a high-score list (up to 3 entries), and a Start button.
2. **Category select** — player picks one of four math categories.
3. **Difficulty select** — player picks a shooting difficulty (also shown: the selected category).
4. **Countdown** — 3 → 2 → 1 → GO! overlay on the sky canvas, ~2.7 s total.
5. **Playing** — active round (see below).
6. **Round result** — brief result panel overlay; player clicks Continue to trigger the next countdown.
7. **Game over** — when lives reach 0; shows final score and the full top-5 high-score list.

## Math categories

| Category | Prompt format | Correct pigeon(s) |
|---|---|---|
| Addition | `a + b = ?` | One pigeon with the sum; others are nearby wrong values |
| Multiplication | `a × b = ?` | One pigeon with the product; others are nearby wrong values |
| Prime numbers | `Shoot prime numbers!` | 1–2 out of N pigeons are primes; others are composites |
| Perfect squares | `Shoot perfect squares!` | 1–2 out of N pigeons are squares; others are non-squares |

## Difficulty settings

| Difficulty | Pigeons | Shots | Launch speed | Gravity |
|---|---|---|---|---|
| Easy | 3 | 4 | slow | slow |
| Medium (default) | 5 | 3 | moderate | moderate |
| Hard | 7 | 3 | fast | fast |

## Pigeon flight

- All pigeons launch from the center-bottom of the canvas simultaneously.
- They fan out in arcs from ~22° to ~158° (measured from the positive x-axis), with slight random jitter per pigeon.
- Gravity pulls them downward; they exit the screen if not shot.
- Status values: `flying`, `hit-correct`, `hit-wrong`, `escaped`.

## Shooting

- Click (or tap) anywhere in the game canvas to fire.
- A shot is consumed whether or not a pigeon is hit.
- The closest flying pigeon within the hit radius (~34 px) is registered as the target.
- Clicking open sky plays a miss sound and shows a smoke-puff effect.

## Hit feedback

| Event | Visual | Sound |
|---|---|---|
| Correct hit | Green glow + spin/shrink animation; green ring + sparkle effect | Descending "break" tone |
| Wrong hit | Red glow + spin/shrink; red × effect | Descending sawtooth tone |
| Miss (open sky) | Smoke-puff effect | Soft thud (noise burst) |
| Combo | (on round result) | Ascending 4-note arpeggio |
| Life lost | (on round result) | Descending 3-note tone |

## Scoring

- **Correct hit**: +100 pts × combo multiplier, plus a speed bonus up to +50 (decays at ~12 pts/s from round start).
- **Wrong hit**: −25 pts (minimum total score: 0).
- **Perfect round bonus**: +50 pts if all correct pigeons are hit.
- **Combo multiplier**: starts at ×1; increases by ×0.5 each consecutive round where all correct pigeons are hit; resets to ×1 on any non-perfect round.
- Score delta is shown on the round-result panel (green if positive, red if negative/zero).

## Lives and round end

- Player starts with 3 lives.
- A life is lost when the round ends with zero correct pigeons hit.
- The round ends when **all pigeons are gone** (hit or escaped) **or** shots are exhausted.
- At 0 lives, the game transitions to game over and the score is saved.

## High scores

- Top 5 scores are persisted in `localStorage` under the key `dh-high-scores-v1`.
- Each entry records: score, category, difficulty, date (locale string).
- The title screen shows the top 3; the game-over screen shows all 5.

## Accessibility / mobile

- Canvas uses CSS `width: 100%; height: auto` for responsive scaling; hit detection accounts for the CSS scale factor via `getBoundingClientRect`.
- The canvas has a CSS `cursor: crosshair` during active gameplay.

## Embedding

- Standalone route: `/duck-hunt` (via `DuckHuntPage` + `StandaloneWindow`).
- Also openable as an inline window in NS Doors 97 (window width 740 px, action `duckhunt`).
- Desktop icon: 🎯
