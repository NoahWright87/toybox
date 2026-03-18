# Change Log

This file tracks changes to this repository by version.

# Versions

## WIP

- Add Fireworks experience (`/fireworks`) — canvas particle toy, click/tap to burst
- Add Bouncing Shapes experience (`/bouncing-shapes`) — retro canvas screensaver with corner hit counter
- Add Typing Racer experience (`/typing-racer`) — phrase typing game with live WPM and accuracy
- Add Number Muncher experience (`/number-muncher`) — grid math game, arrow keys + eat matching numbers
- Add category filter bar to homepage — toggle buttons filter card grid by experience category

## v0.2.0

- Add Toy Box MVP: homepage with design system card grid, Starfield screensaver experience, React Router navigation
- Add Playwright screenshot + functional tests
- Add reusable `HelpOverlay` component (floating ❓ button, inactivity fade, `?` key toggle)
- Refactor homepage to use design system `Heading`, `Text`, `Pill`, `Container` components — no raw HTML or custom CSS
- Update footer with left/right/bottom slots, rotating AI credit, copyright
- Fix Starfield canvas loop: use `requestAnimationFrame(frame)` for initial tick; clamp green channel to 255

## v0.1.0

- Install spec-template scaffold via `/respec`
