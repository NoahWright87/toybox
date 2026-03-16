# Toybox — Current State

## Purpose

A place for fun little side projects.

## Related

- [`starfield.md`](starfield.md)

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
    HomePage.tsx / .css           # hub — card grid launcher
    StarfieldPage.tsx / .css      # full-viewport wrapper for Starfield
  experiences/
    Starfield/
      Starfield.tsx               # canvas screensaver component
```

## Homepage

- Renders a `Layout` (Header + Footer from `@noahwright/design`) wrapping a `CardGrid` of experience `Card`s.
- Card data is driven by `src/data/experiences.ts` — add a new entry to add a new toy to the grid.
- Cards are interactive and navigate to the experience route on click.

## Experiences

Each experience lives in `src/experiences/{Name}/` and is routed at `/{name}` in `App.tsx`. Currently shipped:

- **Starfield** (`/starfield`) — see [`starfield.md`](starfield.md)
