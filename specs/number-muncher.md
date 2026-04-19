# Nom Nom Numerals — Current State

## Purpose

A stealth-learning math game where players guide a critter through a number grid and eat values that match a chosen math rule.

## Location

- Route: `/number-muncher`
- Source: `src/experiences/NumberMuncher/NumberMuncher.tsx` + `NumberMuncher.css`
- Page wrapper: `src/pages/NumberMuncherPage.tsx`

## Behavior

- The game appears in a draggable, windowed shell with an orange title bar.
- A launcher screen appears before gameplay and controls the run configuration.
- Launcher settings:
  - **Math Type** selector with: Multiples, Primes, Even/odd, Factors
  - **Board Size** picker (5×5, 6×6, 7×7)
  - **Monsters** checkbox shown as disabled/non-functional
  - **Help** button that explains controls
- Math Type round behavior:
  - **Multiples** picks a single-digit target each level
  - **Primes** uses prime-number matching each level
  - **Even/odd** alternates between even and odd each level
  - **Factors** picks a new target number from 10–999 each level
- During gameplay, the top header shows only the active goal label centered above the grid in orange.
- The critter is a circular outline with a transparent center and slides smoothly between cells.
- All visible numbers use the same visual treatment. Matching numbers are not pre-highlighted.
- Touch and pointer behavior:
  - tapping a different square moves exactly one square toward that square
  - tap movement is axis-aligned (no diagonal movement)
  - tapping the current square eats the value in-place
  - on touch devices, directional controls and an **Eat** button are shown
- Keyboard behavior:
  - arrow keys move one square
  - space/enter eat the current square only
  - escape returns to launcher/options
- Gameplay flow:
  - level completion opens a modal dialog with current score and **Next Level**
  - pressing Enter on the completion dialog advances to the next level
- Scoring and lives:
  - correct eat: +10 score, cell disappears, brief green flash
  - wrong eat: lose a life, brief red flash
  - 3 lives total, game over at 0
- HUD placement:
  - score is shown bottom-left
  - remaining-count hint is centered inline with HUD (`Only 3 left!`, `Only 2 left!`, `Only 1 left!`)
  - lives are shown bottom-right with larger hearts
- A top-right 🚪 button exits the current run back to launcher/options.
- Game over appears as the topmost modal layer.

## Related

- [`spec.md`](spec.md)
- [`experiences.todo.md`](experiences.todo.md)
