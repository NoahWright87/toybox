# Change Log

This file tracks changes to this repository by version.

# Versions

## v0.2.0

- Add Toy Box MVP: homepage with design system card grid, Starfield screensaver experience, React Router navigation
- Add Playwright screenshot + functional tests
- Add reusable `HelpOverlay` component (floating ❓ button, inactivity fade, `?` key toggle)
- Refactor homepage to use design system `Heading`, `Text`, `Pill`, `Container` components — no raw HTML or custom CSS
- Update footer with left/right/bottom slots, rotating AI credit, copyright
- Fix Starfield canvas loop: use `requestAnimationFrame(frame)` for initial tick; clamp green channel to 255

## v0.1.0

- Install spec-template scaffold via `/respec`
