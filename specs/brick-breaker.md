# Brick Breaker — Current State

## Related

- [`spec.md`](spec.md)
- [`ns-doors-97.md`](ns-doors-97.md)

## Overview

A classic paddle-and-ball brick breaker with endless procedurally-generated levels, ramping difficulty, two power-ups, and a persisted high score stored in a hackable `SCORES.DAT` file in the NS Doors 97 virtual filesystem.

## Routes

`/brick-breaker` — standalone route wrapped in `StandaloneWindow`.
Also embedded as a window inside NS Doors 97 (Start menu / desktop → Programs → Games → Brick Breaker, or via `C:\Programs\Games\Brick Breaker\Brick Breaker.exe`).

## Coordinate space and scaling

All gameplay logic operates in a fixed logical resolution of **480 × 720**. The canvas backing buffer is sized to `480 * devicePixelRatio` × `720 * devicePixelRatio` once on mount. The displayed `<canvas>` element uses CSS `width: 100%; height: 100%; object-fit: contain`, so the browser letterboxes/scales the canvas to fit any container — desktop window, maximized window, or mobile portrait viewport — while preserving the 2:3 aspect ratio. Pointer input coordinates are converted from client space to logical 0–480/0–720 space by accounting for the letterbox offsets via `canvas.getBoundingClientRect()`.

## Controls

- **Mouse** — move the mouse to set the paddle's target X position; the paddle glides toward it (lerp factor 0.35).
- **Touch** — tap or drag anywhere on the canvas to set the paddle's target X; the paddle glides toward it (lerp factor 0.18, slightly slower/smoother). The paddle continues gliding toward the last touch point after the finger lifts.
- **Keyboard** — Arrow Left/Right move the paddle directly while held (only during `playing` phase).
- **Launch** — tap/click the canvas or press Space while a ball is resting on the paddle to launch it.
- **Pause** — Space or Escape toggles pause during play; also available from the Game menu.

## Game phases

- **Start** — title panel with instructions and a "Tap to Start" button.
- **Playing** — normal gameplay.
- **Paused** — overlay with a "Resume" button; Space/Escape or the Game menu resumes.
- **Level transition** — brief overlay ("Level N — Get ready!") shown for ~1.2s between levels while the next level is generated.
- **Game over** — overlay showing final score, high score (and "New High Score!" if beaten), and a "Play Again" button.

## HUD

A status bar above the canvas shows `SCORE`, `LEVEL`, `LIVES` (as heart icons), and `HI` (high score), styled as a sunken Win95 status bar with "Press Start 2P" font.

## Endless procedural levels

Each level is generated from a brick grid of 8 columns. As the level number increases:

- **Rows** grow from 3 up to a cap of 10.
- **Brick density** (chance a cell contains a brick) increases from ~55% toward ~95%; any row that would generate empty is forced to contain at least one brick.
- **Tough bricks** (2 hit points, shown with a crack overlay after the first hit) become more common as level increases.
- **Unbreakable bricks** (infinite hit points, gray) start appearing around level 9 and cap at a 12% chance per cell. They do not block level completion.
- **Ball speed** increases with level, capped at 2.2× the base speed.
- Row colors cycle through the orange/purple/red Win95 accent palette.

A level is cleared when every breakable brick (hp ≠ ∞) is destroyed, after which the next level is generated and play resumes.

## Ball physics

- Multiple balls can be in play simultaneously (after Multi-ball power-ups).
- Balls bounce off the side walls and ceiling by reflecting their velocity.
- **Paddle bounce**: the bounce angle depends on where the ball hits the paddle — center hits go straight up, edge hits angle up to ±75°. Ball speed is renormalized to the level's ball speed after a paddle bounce.
- **Brick collision**: resolved via axis-of-least-overlap (flips horizontal or vertical velocity), one brick hit per ball per frame. Breakable bricks lose one hit point; at 0 hp the brick is destroyed, awarding score and rolling a chance to drop a power-up.
- A ball that falls past the bottom of the play field is removed. When all balls are gone, a life is lost — if lives remain, a new ball respawns on the paddle (awaiting launch); otherwise the game ends.

## Power-ups

Destroyed breakable bricks have a 12% chance to drop a power-up (50/50 split), which falls straight down and is caught by overlapping the paddle (awarding bonus score) or missed if it passes the bottom of the field:

- **Wide Paddle ("W", orange)** — widens the paddle from 80 to 120 logical units for 10 seconds. Catching another Wide Paddle power-up while active resets the timer rather than stacking.
- **Multi-ball ("M", purple)** — splits every ball currently in play into three (the original plus two copies rotated ±25°), capped at 6 total balls. This effect is permanent until balls are lost (no timer).

## Lives and scoring

The player starts with 3 lives. Destroying a brick awards 10 points; catching a power-up awards a bonus. The game ends when the last life is lost while no balls remain in play.

## High score persistence

The high score is a single integer stored in `C:\Programs\Games\Brick Breaker\SCORES.DAT` (stable ID `BB_SCORES_ID`) via `fsStore`. It loads on mount and updates (in memory and on disk) whenever the running score exceeds it. As with other games' SCORES.DAT files, this file can be opened and edited in Notebook to directly change the stored high score.

## Window menu

A single "Game" menu (via `useWindowMenus`) provides:
- **New Game** — resets score, lives, and level back to 1 with a freshly seeded level.
- **Pause** — toggles pause; checked when paused, disabled outside `playing`/`paused`.
- **Exit** — closes the window (Doors 97) or returns to the Doors 97 desktop (standalone route).
