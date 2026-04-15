# Tic-Tac-Toe — Current State

## Related

- [`spec.md`](spec.md)

## Overview

A configurable Tic-Tac-Toe game with variable board sizes, two play variants, and an optional AI opponent. Styled in the Noahsoft Win95 retro aesthetic — the first experience to be fully converted.

## Route

`/tic-tac-toe` — also embedded as a window inside NS Doors 97.

## Board sizes

| Size | Win condition |
|---|---|
| 3×3 | 3 in a row |
| 5×5 | 4 in a row |
| 7×7 | 5 in a row |

## Play variants

**Classic** — click any empty cell to place a piece.

**Drop In** — pieces fall to the lowest empty row in the chosen column (gravity-based, like Connect 4). Column hover highlights indicate the landing cell.

## Opponents

**vs Human** — two players share the keyboard/mouse. X always goes first.

**vs Computer** — single player vs an AI at three difficulty levels:
- Easy — picks a random valid move
- Normal — blocks opponent wins and takes wins when available; otherwise random
- Hard — always picks the highest-scored move (minimax-style weighting)

## Setup screen

Shown on first load and after "Change Settings". Options:
- Board size (3×3 / 5×5 / 7×7)
- Variant (Classic / Drop In)
- Opponent (vs Human / vs Computer)
- Difficulty (Easy / Normal / Hard) — only shown when vs Computer is selected
- Hint text updates to describe the selected combination

## Game board

- Status bar shows whose turn it is, or the winner/draw result.
- Win cells animate with a pop (scale 1.12 → 1) and get colored bevel borders.
- X = orange (`#cc4400`), O = purple (`#5b2d8e`).

## Action buttons

- **New Game** — resets the board keeping current settings.
- **Change Settings** — returns to the setup screen.

## Debug overlay

Shows the AI move weight for each valid cell. Toggled by:
- Triple-tap the status text bar (mobile)
- `Ctrl + .` (keyboard)

## Styling

Win95 raised/sunken beveled borders throughout. Background: dark radial gradient (`#2a1000 → #0c0400`). Game panel: `#c0c0c0`. Font: "Press Start 2P".
