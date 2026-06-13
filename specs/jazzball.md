# Jazzball — Current State

## Related

- [`spec.md`](spec.md)

## Overview

A Jezzball-style wall-building puzzle game. The play field is a flat 60x40 grid of 8px cells; bouncing balls roam the open cells, and the player builds walls that grow outward (cell by cell) from a click point until they reach the field's edges or another wall. Once a wall finishes growing, any connected group of open cells with no balls inside becomes permanently captured (filled). Capture 75% of the field to advance to the next level. Each difficulty tracks its own high score and best level reached, persisted in a hackable `SCORES.DAT` file in the NS Doors 97 virtual filesystem.

## Routes

`/jazzball` — standalone route wrapped in `StandaloneWindow`.
Also embedded as a window inside NS Doors 97 (Start → Games → Jazzball, or via `C:\Programs\Games\Jazzball\Jazzball.exe`).

## Difficulty / settings screen

Before play starts (and whenever returning via "Change Difficulty..."), a settings screen lists **Easy**, **Normal**, and **Hard**, each showing its own high score and best level plus the values it controls:

| Setting | Easy | Normal | Hard |
|---|---|---|---|
| Ball size (diameter) | 4px | 8px | 12px |
| Wall growth speed | 60 cells/s per arm | 40 cells/s per arm | 25 cells/s per arm |
| Lives | balls × 2 | balls + 1 | 3 (fixed) |
| Bounce behavior | random angle change on every bounce | any angle (free reflection) | pure 45° diagonal |
| Ball speed (level 1) | 70px/s | 95px/s | 130px/s |

A "Play {Difficulty}" button starts a new game at level 1 with that difficulty's settings.

## Rules

- The play field starts fully open (bordered by a permanent wall edge) containing 2 balls (level 1); each subsequent level adds one more ball and increases ball speed (by the difficulty's speed step).
- **Building a wall** — click (or tap) any open cell to start a wall there. The clicked cell locks in immediately as a permanent wall segment. From it, two independent **arms** grow outward in opposite directions (one cell at a time, at the difficulty's growth rate) along the current orientation (horizontal or vertical), each stopping when it reaches the field's border or an existing wall/filled cell.
- **Growing cells don't block balls** — while an arm is growing, its cells are visually distinct (pulsing orange) but balls pass through them freely; they don't bounce.
- **Arm destroyed** — if any ball touches *any* cell belonging to a growing arm — including cells already grown ("the flat side"), not just the leading edge — that arm alone shatters back to open space and the player loses one life. The board flashes red briefly. The other arm is unaffected and keeps growing independently; if it's later hit too, that's a second life lost.
- **Stub walls** — if one arm finishes (reaches the border or another wall) before the other arm is destroyed, the finished arm's cells become permanent wall immediately and remain even if the other arm is later shattered.
- **Wall completed** — once both arms are resolved (each either finished or destroyed), all surviving wall cells (including the origin cell and any stub) become permanent. A flood fill then finds every connected group of open cells; any group with no ball inside becomes permanently captured (filled, rendered as a solid purple block).
- **Level complete** — when captured area reaches ≥75% of the total play field, the level ends. Score increases by the rounded percent cleared, and the player advances to the next level (board resets to fully open with one additional ball).
- **Lives per level** — on **Hard**, lives are a shared pool of 3 for the whole game, never replenished. On **Normal** and **Easy**, lives are recalculated at the start of each level from that level's ball count (`balls + 1` or `balls × 2`).
- **Game over** — running out of lives ends the game, offering "New Game" (replay the same difficulty) or "Change Difficulty...".
- **Ball movement** — balls bounce off walls, filled cells, and the field's border, using the active difficulty's bounce behavior (smooth/diagonal/random).

## Controls

- **Click / tap the board** — start building a wall at that point (only when no wall is currently being built).
- **Right-click the board** — toggle wall orientation between horizontal (↔️) and vertical (↕️). Desktop shortcut for the toggle button.
- **↔️/↕️ button below the board, centered in the controls bar** — toggles wall orientation; works on both desktop and mobile (tap).

## HUD

- **Top bar**: current level (`LVL n`, left), lives (center, larger text — shown as repeated ♥/♡ icons up to 6 lives, or `❤️x N` above that), percent cleared / 75% target (right).
- **Bottom bar**: current score (left), high score for the active difficulty (right).

## Score tracking

- **Score** — increases by the rounded percent cleared each time a level completes.
- **High score** and **best level reached** are tracked per difficulty.

Scores are saved to `C:\Programs\Games\Jazzball\SCORES.DAT` as JSON: `{"easy": {"highScore": n, "bestLevel": n}, "normal": {...}, "hard": {...}, "lastDifficulty": "normal"}`. The file can be edited in Notebook; the game reads it on load and remembers the last difficulty played. Older single-difficulty save files (`{"highScore": n, "bestLevel": n}`) are migrated into the "normal" slot on load.

## Menus

### Game

| Item | Action |
|---|---|
| New Game | Restarts at level 1 with the current difficulty, 3 lives/score reset |
| Change Difficulty... | Returns to the difficulty/settings screen |
| Quit | Closes the window (only in NS Doors 97) |
