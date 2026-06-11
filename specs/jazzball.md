# Jazzball — Current State

## Related

- [`spec.md`](spec.md)

## Overview

A Jezzball-style wall-building puzzle game. The play field is a flat 60x40 grid of 8px cells; bouncing balls roam the open cells, and the player builds walls that grow outward (cell by cell) from a click point until they reach the field's edges or another wall. Once a wall finishes growing, any connected group of open cells with no balls inside becomes permanently captured (filled). Capture 75% of the field to advance to the next level. High score and best level reached persist in a hackable `SCORES.DAT` file in the NS Doors 97 virtual filesystem.

## Routes

`/jazzball` — standalone route wrapped in `StandaloneWindow`.
Also embedded as a window inside NS Doors 97 (Start → Games → Jazzball, or via `C:\Programs\Games\Jazzball\Jazzball.exe`).

## Rules

- The play field starts fully open (bordered by a permanent wall edge) containing 2 balls (level 1); each subsequent level adds one more ball and increases ball speed slightly.
- **Building a wall** — click (or tap) any open cell to start a wall there. The clicked cell locks in immediately as a permanent wall segment. From it, two independent **arms** grow outward in opposite directions (one cell at a time) along the current orientation (horizontal or vertical), each stopping when it reaches the field's border or an existing wall/filled cell.
- **Growing cells don't block balls** — while an arm is growing, its cells are visually distinct (pulsing orange) but balls pass through them freely; they don't bounce.
- **Arm destroyed** — if any ball touches *any* cell belonging to a growing arm — including cells already grown ("the flat side"), not just the leading edge — that arm alone shatters back to open space and the player loses one life (shown as ♥/♡ icons). The board flashes red briefly. The other arm is unaffected and keeps growing independently; if it's later hit too, that's a second life lost.
- **Stub walls** — if one arm finishes (reaches the border or another wall) before the other arm is destroyed, the finished arm's cells become permanent wall immediately and remain even if the other arm is later shattered.
- **Wall completed** — once both arms are resolved (each either finished or destroyed), all surviving wall cells (including the origin cell and any stub) become permanent. A flood fill then finds every connected group of open cells; any group with no ball inside becomes permanently captured (filled, rendered as a solid purple block).
- **Level complete** — when captured area reaches ≥75% of the total play field, the level ends. Score increases by the rounded percent cleared, and the player advances to the next level (lives carry over, board resets to fully open with one additional ball).
- **Game over** — losing all 3 lives ends the game. A "New Game" button resets to level 1, 3 lives, and score 0.
- Lives are shared across the whole game (3 total, never replenished between levels).
- **Ball movement** — balls bounce off walls, filled cells, and the field's border. Two modes (Options menu): **Smooth** (default, balls move at arbitrary angles/speeds) or **Diagonal** (balls move only along 45° diagonals, closer to the original Jezzball).

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

## Menus

### Game

| Item | Action |
|---|---|
| New Game | Resets to level 1, 3 lives, score 0 |
| Quit | Closes the window (only in NS Doors 97) |

### Options

| Item | Action |
|---|---|
| Smooth Movement | Balls move at arbitrary angles/speeds (default) |
| Diagonal Movement | Balls move only along 45° diagonals; switching remaps balls currently in play |
