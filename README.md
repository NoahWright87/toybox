# Toy Box

A collection of browser-based games, toys, and screensavers wrapped in a fake 1990s desktop OS.

## The experience

The main entry point is **NS Doors 97**, a parody of Windows 95/98 built by Noahsoft™. You get a draggable-window desktop, a Start menu, a taskbar, a screensaver, and a growing library of retro-styled games and toys accessible as windows inside the OS.

Everything has a Win9X aesthetic: `#c0c0c0` chrome, beveled borders, pixel fonts, and orange-and-purple brand colors.

## Stack

- **React 18 + TypeScript + Vite**
- **react-router-dom** for client-side routing
- **@noahwright/design** for the shared design system (Layout, Card, etc.)
- **react-draggable** for OS windows
- **Playwright** for end-to-end tests

## Experiences

| Name | Route | Category |
|---|---|---|
| NS Doors 97 | `/` | toy |
| Tic-Tac-Toe | `/tic-tac-toe` | game |
| Word Whirlwind | `/word-whirlwind` | game |
| Typing Racer | `/typing-racer` | game |
| Number Muncher | `/number-muncher` | educational |
| Starfield | `/starfield` | screensaver |
| Fireworks | `/fireworks` | toy |
| Bouncing Shapes | `/bouncing-shapes` | screensaver |

## Development

```bash
npm install
npm run dev        # dev server
npm run build      # production build
npm run preview    # preview built output
npx playwright test  # e2e tests
```

## Docs

- [`CLAUDE.md`](CLAUDE.md) — session guide for AI-assisted development
- [`AGENTS.md`](AGENTS.md) — spec-driven development conventions
- [`specs/`](specs/) — current-state specs and roadmap
- [`CHANGELOG.md`](CHANGELOG.md) — release history
