# Starfield — Current State

## Purpose

A full-viewport starfield screensaver. Stars fly toward the viewer in perspective projection, creating a sense of warp-speed travel through space. Serves as the first Toy Box experience.

## Location

- Route: `/starfield`
- Source: `src/experiences/Starfield/Starfield.tsx`
- Page wrapper: `src/pages/StarfieldPage.tsx`

## Behavior

- Renders 500 star particles on a full-screen `<canvas>` using a `requestAnimationFrame` loop.
- Each star has `{ x, y, z }` — `z` decrements each frame to simulate depth. Stars closer to zero appear faster and brighter; stars that pass the viewer or exit the screen are reset to a random far depth.
- Trail lines are drawn from the star's previous projected position to its current one, giving a streaking effect.
- **Click / tap** — triggers a speed boost (temporarily increases `dz`), which decays back to base speed over ~60 frames.
- **Scroll wheel** — adjusts base speed (clamped 1–30).
- Back button (top-left) returns to the homepage.

## Related

- [`spec.md`](spec.md)
- [`experiences.todo.md`](experiences.todo.md)
