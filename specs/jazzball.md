# Jazzball — Current State

## Related

- [`spec.md`](spec.md)

## Overview

A Jezzball-style wall-building puzzle game. Bouncing balls roam a rectangular play field; the player draws walls that grow outward from a click point until they hit the field's edges, splitting the open area. Any region the walls seal off with no balls inside becomes permanently captured. Capture 75% of the field to advance to the next level. High score and best level reached persist in a hackable `SCORES.DAT` file in the NS Doors 97 virtual filesystem.

## Routes

`/jazzball` — standalone route wrapped in `StandaloneWindow`.
Also embedded as a window inside NS Doors 97 (Start → Games → Jazzball, or via `C:\Programs\Games\Jazzball\Jazzball.exe`).

## Rules

- The play field starts as one open region containing 2 balls (level 1); each subsequent level adds one more ball and increases ball speed slightly.
- **Building a wall** — click (or tap) anywhere inside an open region to start a wall at that point. The wall grows in both directions along the current orientation (horizontal or vertical) until both ends reach the region's boundary.
- **Wall destroyed** — if a ball touches the wall before it finishes growing, the wall shatters and the player loses one life (shown as ♥/♡ icons). The board flashes red briefly.
- **Wall completed** — once both ends reach the region's bounds, the region splits into two. Any sub-region containing zero balls becomes permanently captured (filled, rendered as a solid purple block); sub-regions with balls remain in play.
- **Level complete** — when captured area reaches ≥75% of the total play field, the level ends. Score increases by the rounded percent cleared, and the player advances to the next level (lives carry over, board resets to a single open region with one additional ball).
- **Game over** — losing all 3 lives ends the game. A "New Game" button resets to level 1, 3 lives, and score 0.
- Lives are shared across the whole game (3 total, never replenished between levels).

## Controls

- **Click / tap the board** — start building a wall at that point (only when no wall is currently being built).
- **Right-click the board** — toggle wall orientation between horizontal (↔️) and vertical (↕️). Desktop shortcut for the toggle button.
- **↔️/↕️ button below the board** — toggles wall orientation; works on both desktop and mobile (tap).

## HUD

Above the board: current level, lives (♥/♡), score, percent cleared / 75% target, and high score.

## Score tracking

- **Score** — increases by the rounded percent cleared each time a level completes.
- **High score** and **best level reached** are tracked across games.

Scores are saved to `C:\Programs\Games\Jazzball\SCORES.DAT` as JSON (`{"highScore": n, "bestLevel": n}`) and can be edited in Notebook. The game reads the file on load.

## Menus (Game)

| Item | Action |
|---|---|
| New Game | Resets to level 1, 3 lives, score 0 |
| Quit | Closes the window (only in NS Doors 97) |
