# Number Muncher — Current State

## Purpose

A stealth-learning math game. Navigate a grid of numbers with arrow keys and eat those matching the current rule. Math fluency through speed and repetition, not drilling.

## Location

- Route: `/number-muncher`
- Source: `src/experiences/NumberMuncher/NumberMuncher.tsx` + `NumberMuncher.css`
- Page wrapper: `src/pages/NumberMuncherPage.tsx`

## Behavior

- 7×5 grid of random numbers (1–99). The current rule is shown in the HUD (e.g. "Eat: multiples of 3").
- **Arrow keys** — move the blue player cursor around the grid.
- **Space / Enter** — eat the number under the cursor.
  - Correct eat: +10 score, cell disappears, brief green flash.
  - Wrong eat: lose a life, brief red flash. 3 lives total; game over at 0.
- **Level advance** — when all matching numbers in the grid are eaten, the rule advances to the next in the cycle and a fresh grid is generated (600ms delay).
- **Rules cycle**: multiples of 3 → even numbers → prime numbers → multiples of 5 → multiples of 4 → odd numbers → repeat.
- Grid guarantees at least 4 matching numbers per level.
- Game over screen shows final score with a "Play Again" button.

## Related

- [`spec.md`](spec.md)
- [`experiences.todo.md`](experiences.todo.md)
