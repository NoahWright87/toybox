# Toybox — Current State

## Purpose

A place for fun little side projects.

## Related

- [`starfield.md`](starfield.md)
- [`fireworks.md`](fireworks.md)
- [`bouncing-shapes.md`](bouncing-shapes.md)
- [`typing-racer.md`](typing-racer.md)
- [`number-muncher.md`](number-muncher.md)

## Stack

- **React 18 + Vite + TypeScript** — static-site friendly, hosted as built output
- **`@noahwright/design`** (`npm i @noahwright/design`) — shared design system; provides `Layout`, `Card`, `CardGrid`, and CSS theme tokens
- **`react-router-dom`** — client-side routing between hub (`/`) and individual experiences (`/{name}`)

## Structure

```
src/
  main.tsx                        # app entry point; imports design system CSS
  index.css                       # base resets
  App.tsx                         # BrowserRouter + route table
  data/
    experiences.ts                # static registry of available experiences
  pages/
    HomePage.tsx / .css           # hub — card grid launcher with category filter
    StarfieldPage.tsx / .css      # full-viewport wrapper for Starfield
    FireworksPage.tsx / .css      # full-viewport wrapper for Fireworks
    BouncingShapesPage.tsx / .css # full-viewport wrapper for BouncingShapes
    TypingRacerPage.tsx / .css    # full-viewport wrapper for TypingRacer
    NumberMuncherPage.tsx / .css  # full-viewport wrapper for NumberMuncher
  experiences/
    Starfield/
      Starfield.tsx               # canvas screensaver component
    Fireworks/
      Fireworks.tsx               # canvas particle toy
    BouncingShapes/
      BouncingShapes.tsx          # canvas screensaver component
    TypingRacer/
      TypingRacer.tsx / .css      # typing speed game
    NumberMuncher/
      NumberMuncher.tsx / .css    # grid-based math game
```

## Homepage

- Renders a `Layout` (Header + Footer from `@noahwright/design`) wrapping a `CardGrid` of experience `Card`s.
- Card data is driven by `src/data/experiences.ts` — add a new entry to add a new toy to the grid.
- Cards are interactive and navigate to the experience route on click.
- Category filter bar above the grid: pill-style toggle buttons (`All` + one per category); filters the card grid by `experience.category`. Categories are derived dynamically from the registry.

## Experiences

Each experience lives in `src/experiences/{Name}/` and is routed at `/{name}` in `App.tsx`. Currently shipped:

- **Starfield** (`/starfield`) — see [`starfield.md`](starfield.md)
- **Fireworks** (`/fireworks`) — see [`fireworks.md`](fireworks.md)
- **Bouncing Shapes** (`/bouncing-shapes`) — see [`bouncing-shapes.md`](bouncing-shapes.md)
- **Typing Racer** (`/typing-racer`) — see [`typing-racer.md`](typing-racer.md)
- **Number Muncher** (`/number-muncher`) — see [`number-muncher.md`](number-muncher.md)
