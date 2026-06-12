# Brick Breaker — Current State

## Related

- [`spec.md`](spec.md)
- [`ns-doors-97.md`](ns-doors-97.md)

## Overview

A roguelike-flavored paddle-and-ball brick breaker with endless procedurally-generated levels, ramping difficulty, a coin economy, a between-level shop offering permanent stacking upgrades, seven temporary power-ups, five brick traits (with combinations at higher levels), and persisted run stats stored in a hackable `SCORES.DAT` file in the NS Doors 97 virtual filesystem.

## Routes

`/brick-breaker` — standalone route wrapped in `StandaloneWindow`.
Also embedded as a window inside NS Doors 97 (Start menu / desktop → Programs → Games → Brick Breaker, or via `C:\Programs\Games\Brick Breaker\Brick Breaker.exe`).

## Coordinate space and scaling

All gameplay logic operates in a fixed logical resolution of **480 × 720**. The canvas backing buffer is sized to `480 * devicePixelRatio` × `720 * devicePixelRatio` once on mount. The displayed `<canvas>` element uses CSS `width: 100%; height: 100%; object-fit: contain`, so the browser letterboxes/scales the canvas to fit any container — desktop window, maximized window, or mobile portrait viewport — while preserving the 2:3 aspect ratio. Pointer input coordinates are converted from client space to logical 0–480/0–720 space by accounting for the letterbox offsets via `canvas.getBoundingClientRect()`.

## Controls

- **Mouse** — move the mouse to set the paddle's target X position; the paddle glides toward it (lerp factor 0.35, plus the Quick Hands upgrade bonus).
- **Touch** — tap or drag anywhere on the canvas to set the paddle's target X; the paddle glides toward it (lerp factor 0.18, slightly slower/smoother, plus the Quick Hands upgrade bonus). The paddle continues gliding toward the last touch point after the finger lifts.
- **Keyboard** — Arrow Left/Right move the paddle directly while held (only during `playing` phase), at 360 units/sec plus the Quick Hands upgrade bonus.
- **Launch** — tap/click the canvas or press Space while a ball is resting on the paddle (or stuck via Sticky Paddle) to launch it.
- **Pause** — Space or Escape toggles pause during play; also available from the Game menu.

## Game phases

- **Menu** — pre-game screen (see below). Pressing Space here also starts a new run.
- **Playing** — normal gameplay.
- **Paused** — overlay with a "Resume" button; Space/Escape or the Game menu resumes.
- **Shop** — between-level upgrade shop (see below).
- **Level transition** — brief overlay ("Level N — Get ready!") shown for ~1.2s after leaving the shop while the next level is generated.
- **Game over** — overlay showing final score, high score (and "New High Score!" if beaten), and a "Play Again" button.

## Pre-game menu

Shown on first load and after every game over. It is a wide, scrollable panel (mirroring the Cards game selector style) containing:

- **Run stats** — high score, best level reached, and total games played, loaded from the save file.
- **Instructions** — a short summary of controls, the coin/shop loop, and the goal of out-scaling the rising difficulty.
- **Paddle color picker** — six swatches (Orange, Purple, Green, Cyan, Red, Yellow). The selected color tints the paddle and persists across runs.
- **Difficulty selector** — Easy / Normal / Hard buttons. Selecting a difficulty persists it for future runs and affects the current run's scaling (see table below).
- **Start Run** button — begins a fresh run at level 1 with all permanent upgrades reset to zero.

### Difficulty effects

| Difficulty | Starting lives | Ball speed mult. | Ramp mult. (level scaling) | Coin mult. | Shop price mult. |
|---|---|---|---|---|---|
| Easy | 4 | 0.85× | 0.75× | 1.25× | 0.85× |
| Normal | 3 | 1.0× | 1.0× | 1.0× | 1.0× |
| Hard | 2 | 1.15× | 1.3× | 0.85× | 1.15× |

"Ramp mult." scales how quickly density, tough/unbreakable/ice/explosive/moving/regenerating-brick chances, and ball speed increase with level.

## HUD

A status bar above the canvas shows `SCORE`, `LEVEL`, `LIVES` (as heart icons), `COINS`, and `HI` (high score), styled as a sunken Win95 status bar with "Press Start 2P" font.

## Endless procedural levels

Each level is generated from a brick grid of 8 columns. As the level number increases (scaled by the difficulty's ramp multiplier):

- **Rows** grow from 3 up to a cap of 10.
- **Brick density** (chance a cell contains a brick) increases from ~55% toward ~95%; any row that would generate empty is forced to contain at least one brick.
- **Tough bricks** (2 hit points, shown with a crack overlay after the first hit) become more common as level increases.
- **Unbreakable bricks** (infinite hit points, gray) start appearing around level 9 and cap at a 12% chance per cell. They do not block level completion and never receive the explosive or regenerating traits.
- **Ice bricks** (light blue overlay) start appearing from level 2 and cap at ~12%. When a ball hits an ice brick, the ball is slowed to 50% speed for 1.5 seconds.
- **Explosive bricks** (marked with `*`) start appearing from level 3 and cap at ~12%. Destroying one damages its 4-directional neighbors, chaining through any neighboring explosive bricks; unbreakable neighbors are unaffected.
- **Moving bricks** start appearing from level 4 and cap at ~10%. They oscillate horizontally within the grid bounds using a sine wave.
- **Regenerating bricks** (marked with `+`) start appearing from level 5 and cap at ~10%. They restore 1 hit point every 4 seconds, up to their max hp.
- Any combination of traits can appear on the same brick at higher levels (e.g. a moving ice brick, or an explosive tough brick), except that explosive/regenerating never apply to unbreakable bricks.
- **Ball speed** increases with level, capped at 2.2× the base speed, then scaled by the difficulty's ball speed multiplier.
- Row colors cycle through a 10-color rainbow gradient through the Win95 accent palette.

A level is cleared when every breakable brick (hp ≠ ∞) is destroyed, which opens the shop (see below).

## Ball physics

- Multiple balls can be in play simultaneously (after Multi-ball power-ups or the Extra Ball upgrade), up to `MAX_BALLS = 6`.
- Balls bounce off the side walls and ceiling by reflecting their velocity.
- **Paddle bounce**: the bounce angle depends on where the ball hits the paddle — center hits go straight up, edge hits angle up to ±75°. Ball speed is renormalized to the current effective speed (level ball speed × the Greed upgrade's speed multiplier) after a paddle bounce, and any ice-slow effect on the ball is cleared.
- **Homing** (Homing Ball upgrade): each frame, every ball's velocity gently curves toward the nearest alive breakable brick, turning at a capped rate while preserving speed.
- **Brick collision**: resolved via axis-of-least-overlap (flips horizontal or vertical velocity), one brick hit per ball per frame — unless **Piercing Shot** is active, in which case the ball passes through breakable bricks without bouncing. Breakable bricks lose `1 + Heavy Ball bonus` hit points; at 0 hp the brick is destroyed, awarding score and rolling a chance to drop a pickup. Destroying an explosive brick chains damage to its neighbors via the explosion rules above.
- Hitting an ice brick sets the ball's slow timer; while slowed, the ball's target speed is halved until the timer expires or the ball bounces off the paddle.
- A ball that falls past the bottom of the play field is removed. When all balls are gone:
  - If a **Shield** charge is available, it is consumed and a new ball respawns on the paddle (awaiting launch) without losing a life.
  - Otherwise, a life is lost. If lives remain, a new ball respawns on the paddle (awaiting launch); otherwise the game ends.

## Pickups

Destroyed breakable bricks roll independently for a coin drop and a power-up drop. Coin drop chance is `30% × difficulty coin multiplier + Lucky upgrade bonus`; coin value is 2 for tough (2-hp) bricks, 1 otherwise. Power-up drop chance is `10% + Lucky upgrade bonus`, picked uniformly from the seven types below. All pickups fall straight down at a fixed speed and are caught by overlapping the paddle (expanded by the Coin Magnet upgrade's catch radius for coins), awarding bonus score for power-ups, or missed if they pass the bottom of the field.

| Pickup | Label | Color | Effect |
|---|---|---|---|
| Coin | `$` | gold | Adds 1 or 2 coins to the run's coin total, spendable in the shop. |
| Wide Paddle | `W` | orange | Widens the paddle from 80 to 120 logical units for 10 seconds. Re-catching resets the timer rather than stacking. |
| Multi-ball | `M` | purple | Splits every ball currently in play into three (original plus two copies rotated ±25°), capped at `MAX_BALLS = 6`. Permanent until balls are lost (no timer). |
| Laser Paddle | `L` | red | For 10 seconds, the paddle periodically fires lasers upward from its edges (every ~420ms), damaging the first brick each laser hits. |
| Piercing Shot | `P` | cyan | For 8 seconds, balls pass through breakable bricks instead of bouncing, damaging each one hit. |
| Sticky Paddle | `S` | green | For 12 seconds, balls that touch the paddle stick to it instead of bouncing; press Space or tap to relaunch. |
| Shield | `H` | yellow | Adds a shield charge. The next time all balls would be lost, the charge is consumed instead of a life. |
| Exploding Ball | `E` | red-orange | Adds an explosion charge. The next brick destroyed by a ball triggers the explosion-chain effect regardless of whether it was explosive. |

## Permanent upgrades (shop)

Between every level, the player enters the **Shop**: three random upgrade offers are rolled (excluding upgrades already at max stacks), each showing its icon, name, current/max stacks, description, and coin cost. Costs grow exponentially with owned stacks (`baseCost × costGrowth^owned`, scaled by the difficulty's price multiplier). Buying an upgrade deducts coins, increments its stack count, recomputes derived stats, and rerolls just that offer slot. "Reroll All" re-rolls all three offers for an increasing cost (`(4 + rerollsUsed × 3) × price multiplier`). "Continue" advances to the next level.

| Upgrade | Icon | Max stacks | Per-stack effect |
|---|---|---|---|
| Wide Paddle | ↔ | 5 | +10 paddle width |
| Quick Hands | ⚡ | 4 | Paddle moves faster (mouse/touch lerp +0.05, keyboard speed +60) |
| Vitality | ♥ | 3 | +1 max life, heals 1 life immediately when bought |
| Heavy Ball | ● | 3 | Ball deals +1 damage to bricks |
| Coin Magnet | 🧲 | 5 | +10 pickup catch radius |
| Greed | $ | 5 | +15% score multiplier, +5% ball speed |
| Homing Ball | ◎ | 1 | Balls curve toward the nearest breakable brick |
| Extra Ball | ○ | 2 | +1 starting ball each level |
| Lucky | 🍀 | 5 | +4% power-up and coin drop chance |

## Lives and scoring

The player starts with `startingLives` (set by difficulty, modified by the Vitality upgrade). Destroying a brick awards 10 points (scaled by the Greed upgrade's score multiplier); catching a power-up awards bonus score. The game ends when the last life is lost while no balls remain in play and no shield charge is available.

## Persistence

Run data is stored as JSON in `C:\Programs\Games\Brick Breaker\SCORES.DAT` (stable ID `BB_SCORES_ID`) via `fsStore`:

```json
{
  "highScore": 0,
  "bestLevel": 0,
  "gamesPlayed": 0,
  "paddleColor": "orange",
  "difficulty": "normal"
}
```

- `highScore` updates whenever the running score exceeds it (both in memory and on disk).
- `bestLevel` and `gamesPlayed` update on game over.
- `paddleColor` and `difficulty` update immediately when changed in the pre-game menu.
- Legacy save files containing a plain integer are migrated to `{ ...DEFAULT_SAVE, highScore: <that integer> }`. Invalid or missing data falls back to defaults (`highScore: 0, bestLevel: 0, gamesPlayed: 0, paddleColor: "orange", difficulty: "normal"`).
- As with other games' SCORES.DAT files, this file can be opened and edited in Notebook to directly change stored run stats.

## Window menu

A single "Game" menu (via `useWindowMenus`) provides:
- **New Game** — returns to the pre-game menu to start a fresh run.
- **Pause** — toggles pause; checked when paused, disabled outside `playing`/`paused`.
- **Exit** — closes the window (Doors 97) or returns to the Doors 97 desktop (standalone route).
