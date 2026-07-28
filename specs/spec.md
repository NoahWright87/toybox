# Toybox — Current State

## Purpose

A collection of browser-based games, toys, and screensavers wrapped in a fake 1990s desktop OS called **NS Doors 97**.
The default UX is in-OS app windows: experiences are expected to launch inside NS Doors 97 windows unless a spec explicitly defines another mode.

## Related

- [`ns-doors-97.md`](ns-doors-97.md)
- [`tic-tac-toe.md`](tic-tac-toe.md)
- [`word-whirlwind.md`](word-whirlwind.md)
- [`typing-racer.md`](typing-racer.md)
- [`number-muncher.md`](number-muncher.md)
- [`starfield.md`](starfield.md)
- [`fireworks.md`](fireworks.md)
- [`bouncing-shapes.md`](bouncing-shapes.md)

## Stack

- **React 18 + Vite + TypeScript** — static-site friendly, hosted as built output
- **In-repo design system** — CSS tokens in `src/theme.css` and reusable chrome in `src/components/`; documented and live-editable in the Design app (`/design`). See `specs/design-system.md`.
- **`react-router-dom`** — client-side routing between the OS (`/`) and individual experiences (`/{name}`)
- **`react-draggable`** — powers draggable windows in NS Doors 97

## Retro aesthetic

The entire project uses a **Windows 9X era** visual identity ("Noahsoft").

**Palette:**
- Win95 gray `#c0c0c0` — primary panel background
- Win95 warm gray `#d4d0c8` — inset / recessed areas
- Win95 dark `#808080` — shadows and borders
- Orange `#cc4400` / `#ff6b00` — primary brand color (X player, active states, buttons)
- Purple `#5b2d8e` / `#7b3dbe` — secondary brand color (O player, accents)
- Page background: `radial-gradient(ellipse at center, #2a1000 0%, #180800 55%, #0c0400 100%)`

**Typography:**
- "Press Start 2P" (pixel monospace) for all UI chrome, labels, and headings
- "Courier New" for body / content text (e.g. typing phrases, debug overlays)

**Border style:**
- Raised: `border-color: #ffffff #808080 #808080 #ffffff`
- Sunken: `border-color: #808080 #ffffff #ffffff #808080`

## Structure

```
src/
  main.tsx                        # app entry point; imports design system CSS
  index.css                       # base resets
  App.tsx                         # BrowserRouter + route table
  data/
    experiences.ts                # static registry of available experiences
  pages/
    NsDoors97Page.tsx             # wraps NS Doors 97 (mounted at /)
    DesignPage.tsx                # design-system gallery at /design
    TicTacToePage.tsx / .css      # standalone wrapper
    WordWhirlwindPage.tsx / .css  # standalone wrapper
    TypingRacerPage.tsx / .css    # standalone wrapper
    NumberMuncherPage.tsx / .css  # standalone wrapper
    StarfieldPage.tsx / .css      # full-viewport wrapper for Starfield
    FireworksPage.tsx / .css      # full-viewport wrapper for Fireworks
    BouncingShapesPage.tsx / .css # full-viewport wrapper for BouncingShapes
  experiences/
    NsDoors97/                    # fake OS desktop
    TicTacToe/                    # board game with AI
    WordWhirlwind/                # unscramble word game
    TypingRacer/                  # typing speed game
    NumberMuncher/                # grid math game
    Starfield/                    # canvas screensaver
    Fireworks/                    # canvas particle toy
    BouncingShapes/               # canvas screensaver
  components/
    HelpOverlay/                  # ? button overlay with keyboard hints
  utils/
    wordDictionary.ts             # shared word lookup used by WordWhirlwind
```

## Routing

| Path | Experience | Notes |
|---|---|---|
| `/` | NS Doors 97 | Main entry — the fake OS desktop |
| `/doors97` | NS Doors 97 | Alias |
| `/design` | Design | Design-system gallery + live theme editor (→ design.doors97.com) |
| `/tic-tac-toe` | Tic-Tac-Toe | |
| `/word-whirlwind` | Word Whirlwind | |
| `/typing-racer` | Typing Racer | |
| `/number-muncher` | Nom Nom Numerals | |
| `/starfield` | Starfield | |
| `/fireworks` | Fireworks | |
| `/bouncing-shapes` | Bouncing Shapes | |

## Design app (`/design`)

- Two-pane Win95 Control-Panel layout: a left nav tree of token groups and components, a right panel showing a live preview + controls + notes for the selection. See `specs/design-system.md`.
- Also opens as a window inside NS Doors 97 (Start → Programs → Design).
- Color edits persist to `C:\System\theme.ini` and re-skin the whole OS live.

## Experiences

Each experience lives in `src/experiences/{Name}/` and is routed at `/{name}` in `App.tsx`.

- **NS Doors 97** (`/`) — see [`ns-doors-97.md`](ns-doors-97.md)
- **Tic-Tac-Toe** (`/tic-tac-toe`) — see [`tic-tac-toe.md`](tic-tac-toe.md)
- **Word Whirlwind** (`/word-whirlwind`) — see [`word-whirlwind.md`](word-whirlwind.md)
- **Typing Racer** (`/typing-racer`) — see [`typing-racer.md`](typing-racer.md)
- **Nom Nom Numerals** (`/number-muncher`) — see [`number-muncher.md`](number-muncher.md)
- **Starfield** (`/starfield`) — see [`starfield.md`](starfield.md)
- **Fireworks** (`/fireworks`) — see [`fireworks.md`](fireworks.md)
- **Bouncing Shapes** (`/bouncing-shapes`) — see [`bouncing-shapes.md`](bouncing-shapes.md)
