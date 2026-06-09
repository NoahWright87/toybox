# Checkers — Current State

## Related

- [`spec.md`](spec.md)

## Overview

Standard American checkers on an 8×8 board with animated piece movement. Either player (Red or Black) can independently be Human or Computer. Win/Loss/Draw scores persist in a hackable `SCORES.DAT` file in the NS Doors 97 virtual filesystem.

## Routes

`/checkers` — standalone route wrapped in `StandaloneWindow`.  
Also embedded as a window inside NS Doors 97 (Start → Games → Checkers, or via `C:\Programs\Games\Checkers\Checkers.exe`).

## Rules

Standard American rules:
- 8×8 board; pieces start on dark squares.
- Red moves first; pieces advance toward row 0.
- **Mandatory captures** — if any capture move is available, the player must take it.
- **Multi-jump** — after a capture, if the same piece can jump again, it must continue.
- **King promotion** — a piece reaching the opponent's back rank becomes a King (★) and may move/capture in any diagonal direction.
- Win by capturing all opponent pieces or leaving them with no legal moves.
- Draw if neither side has legal moves simultaneously.

## New Game dialog

Shown on first launch and when "New Game…" is chosen from the Game menu. Two columns — Red and Black — each with:
- **Human / Computer** radio buttons.
- **Easy / Hard** difficulty selector (shown only when Computer is selected).

"Start Game" commits the configuration and begins a new game.

## Animation

Every move is fully animated:

1. **Rise** — the moving piece scales up slightly and floats upward.
2. **Slide** — the piece travels to its destination (or to the intermediate square for each hop in a multi-jump).
3. **Land** — the piece scales back down and settles.

Multi-jump moves animate hop-by-hop. Captured pieces simultaneously slide off the board to a capture pile below.

**Capture piles** — two piles sit below the board:
- Left pile: pieces captured by Red.
- Right pile: pieces captured by Black.

Captured pieces slide into the pile with gentle overlap.

**Animation speed** is configurable from the Game menu:
- Snappy (~200 ms slide)
- Moderate (~350 ms slide, default)
- Cinematic (~500 ms slide)

Input is locked during animation; the AI also waits until animation completes.

## AI

Minimax with alpha-beta pruning:
- **Easy** (depth 2): picks randomly among the top 3 scored moves.
- **Hard** (depth 4): always picks the best-scored move.

The AI fires automatically after a short thinking delay (400–700 ms).

## Score tracking

Scores are displayed in the status bar as `W:n L:n D:n` and updated after each game.

| Outcome | Counted as |
|---|---|
| Human-controlled side wins | Win |
| AI wins against a solo human | Loss |
| Draw, or AI vs AI result | Draw |

Scores are saved to `C:\Programs\Games\Checkers\SCORES.DAT` as JSON and can be edited in Notebook. The game reads the file on load.

## Menus (Game)

| Item | Action |
|---|---|
| New Game… | Opens the New Game dialog mid-game |
| Snappy / Moderate / Cinematic | Sets animation speed (radio group) |
| Quit | Closes the window (only in NS Doors 97) |
