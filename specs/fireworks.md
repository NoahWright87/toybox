# Fireworks — Current State

## Purpose

A click-driven fireworks toy. Click anywhere to launch a burst of colorful particles.

## Location

- Route: `/fireworks`
- Source: `src/experiences/Fireworks/Fireworks.tsx`
- Page wrapper: `src/pages/FireworksPage.tsx`

## Behavior

- Renders a full-screen `<canvas>` with a black background.
- **Click / tap** — spawns a firework burst at the cursor position.
- Each burst fires 60 particles outward at random angles and speeds.
- Particles have gravity (`vy += 0.08` per frame), air friction (`vx/vy *= 0.99`), and fade out as `life` decreases toward 0.
- Multiple simultaneous bursts are supported; dead particles are filtered out each frame.
- Color is randomized per burst (HSL with random hue ± 20°).
- Trail effect from `rgba(0,0,0,0.15)` fill each frame.

## Related

- [`spec.md`](spec.md)
- [`experiences.todo.md`](experiences.todo.md)
