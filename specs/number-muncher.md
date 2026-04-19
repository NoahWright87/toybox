# Nom Nom Numerals — Current State

## Purpose

A stealth-learning math game where players guide a critter through a number grid and eat values that match a chosen math rule.

## Location

- Route: `/number-muncher`
- Source: `src/experiences/NumberMuncher/NumberMuncher.tsx` + `NumberMuncher.css`
- Page wrapper: `src/pages/NumberMuncherPage.tsx`

## Behavior

- The game appears inside a windowed page shell with the title **Nom Nom Numerals**.
- A launcher screen appears before gameplay and controls the run configuration.
- Launcher settings:
  - **Math Type** selector (examples: prime numbers, odd/even, multiples, factors)
  - **Board Size** picker (5×5, 6×6, 7×7)
  - **Monsters** checkbox shown as disabled/non-functional
  - **Help** button that explains controls
- During gameplay, the top header shows only the active goal label (for example, `Multiples of 3`) centered above the grid.
- The critter is a circular placeholder that slides smoothly between cells.
- All visible numbers use the same visual treatment. Matching numbers are not pre-highlighted.
- Touch and pointer behavior:
  - tapping a different square moves exactly one square toward that square
  - tap movement is axis-aligned (no diagonal movement)
  - tapping the current square eats the value in-place
  - on touch devices, directional controls and an **Eat** button are shown
- Keyboard behavior:
  - arrow keys move one square
  - space/enter eat the current square only
- Scoring and lives:
  - correct eat: +10 score, cell disappears, brief green flash
  - wrong eat: lose a life, brief red flash
  - 3 lives total, game over at 0
- HUD placement:
  - score is shown bottom-left
  - lives are shown bottom-right with larger hearts
- Hint behavior:
  - when exactly 3 valid targets remain on the board, `3 left!` appears
- When all valid targets are eaten, a fresh board is generated using the current launcher settings.

## Related

- [`spec.md`](spec.md)
- [`experiences.todo.md`](experiences.todo.md)
