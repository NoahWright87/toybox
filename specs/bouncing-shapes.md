# Bouncing Shapes — Current State

## Purpose

A retro screensaver: colorful shapes (circles, squares, triangles) bounce around the viewport with classic wall-collision physics. Tracks corner hits.

## Location

- Route: `/bouncing-shapes`
- Source: `src/experiences/BouncingShapes/BouncingShapes.tsx`
- Page wrapper: `src/pages/BouncingShapesPage.tsx`

## Behavior

- Renders 15 shapes on a full-screen `<canvas>` using a `requestAnimationFrame` loop.
- Each shape has a random kind (circle / square / equilateral triangle), size (30–70px), color (7-color palette), and velocity.
- Shapes bounce off all four walls with simple reflection (`vx` or `vy` sign flip).
- **Corner hit** — detected when a shape bounces off both a horizontal and vertical wall in the same frame. A running counter is displayed in the bottom-left.
- Background is `#111`; no trail effect (hard clear each frame).

## Related

- [`spec.md`](spec.md)
- [`experiences.todo.md`](experiences.todo.md)
