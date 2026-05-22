# Toy Box — Claude Session Guide

This file gives Claude the context needed to work effectively in this repo without a lengthy orientation every session.

## What this project is

**Toy Box** is a collection of browser-based games, toys, and screensavers built by Noah Wright. The central conceit is a **fake 1990s desktop OS** called **NS Doors 97** (a Noahsoft parody of Windows 95/98). That OS is the main entry point at `/`. Individual experiences are also accessible at their own routes.

The aesthetic is retro **Windows 9X era**: beveled chrome, `#c0c0c0` gray panels, pixel font ("Press Start 2P"), orange-and-purple brand colors, and CRT-era sensibility throughout. Every new experience should fit this look.

## Tech stack

| Layer | What |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Routing | `react-router-dom` v6 |
| Design system | `@noahwright/design` — provides `Layout`, `Header`, `Footer`, `Card`, `CardGrid`, `Container`, `Heading`, `Text`, `Pill`, `Link`, `Button` |
| Font | "Press Start 2P" (Google Fonts, loaded in `index.html`) |
| Testing | Playwright |
| Build output | Static; deployed as built files |

## Routing

| Path | Component | Notes |
|---|---|---|
| `/` | `NsDoors97Page` | The OS desktop — main entry point |
| `/doors97` | `NsDoors97Page` | Alias |
| `/toybox` | `HomePage` | Retro card grid launcher (secondary) |
| `/tic-tac-toe` | `TicTacToePage` | |
| `/word-whirlwind` | `WordWhirlwindPage` | |
| `/typing-racer` | `TypingRacerPage` | |
| `/number-muncher` | `NumberMuncherPage` | |
| `/starfield` | `StarfieldPage` | Canvas screensaver |
| `/fireworks` | `FireworksPage` | Canvas particle toy |
| `/bouncing-shapes` | `BouncingShapesPage` | Canvas screensaver |

## Source layout

```
src/
  App.tsx                   # BrowserRouter + route table
  main.tsx                  # Entry; imports design system CSS
  index.css                 # Base resets
  data/
    experiences.ts          # Registry: id, title, path, category, description
  pages/
    HomePage.tsx / .css     # Retro card grid launcher
    NsDoors97Page.tsx       # Wraps NsDoors97 experience
    TicTacToePage.tsx / .css
    WordWhirlwindPage.tsx / .css
    TypingRacerPage.tsx / .css
    NumberMuncherPage.tsx / .css
    StarfieldPage.tsx / .css
    FireworksPage.tsx / .css
    BouncingShapesPage.tsx / .css
  experiences/
    NsDoors97/              # The fake OS (flagship)
    TicTacToe/              # 3×3–7×7 board, AI opponent, Drop In gravity variant
    WordWhirlwind/          # Unscramble letters, freeplay / standard / strict
    TypingRacer/            # Type phrases against the clock, WPM + accuracy
    NumberMuncher/          # Grid math game, arrow keys + eat
    Starfield/              # Canvas screensaver
    Fireworks/              # Canvas particle toy
    BouncingShapes/         # Canvas screensaver
  components/
    HelpOverlay/            # ? button that shows keyboard shortcuts
  utils/
    wordDictionary.ts       # Shared word/dictionary logic (used by WordWhirlwind)
```

## Adding a new experience

1. Create `src/experiences/{Name}/{Name}.tsx` (and `.css` if needed).
2. Create `src/pages/{Name}Page.tsx` (and `.css`) — wraps the component with the retro page background and `HelpOverlay`.
3. Add a route in `src/App.tsx`.
4. Add an entry to `src/data/experiences.ts`.
5. Embed the experience as a window inside NS Doors 97 if appropriate.
6. Create `specs/{name}.md` documenting current behavior.

## Retro aesthetic — the rules

All new experiences (and refactored old ones) use this palette and style system:

### Colors

| Token | Hex | Used for |
|---|---|---|
| Win95 gray | `#c0c0c0` | Primary panel background |
| Win95 warm gray | `#d4d0c8` | Inset / recessed areas |
| Win95 dark | `#808080` | Shadows, borders |
| White | `#ffffff` | Highlights |
| Orange primary | `#cc4400` / `#ff6b00` | X player, active/hover states, buttons |
| Purple secondary | `#5b2d8e` / `#7b3dbe` | O player, accents |
| Green win | `#228833` | Draws / success states |
| Page background | `radial-gradient(ellipse at center, #2a1000 0%, #180800 55%, #0c0400 100%)` | Page backdrop for standalone experiences |

### Win95 border patterns (CSS)

```css
/* Raised element (button up, panel) */
border: 2px solid;
border-color: #ffffff #808080 #808080 #ffffff;

/* Sunken / active element (pressed button, input, inset panel) */
border-color: #808080 #ffffff #ffffff #808080;

/* Orange raised button */
border-color: #ffcc88 #664400 #664400 #ffcc88;

/* Orange sunken / active */
border-color: #664400 #ffcc88 #ffcc88 #664400;
```

### Typography

- **Labels, headings, UI chrome:** `"Press Start 2P", monospace` — keep sizes small (6–12 px) since this font is very dense
- **Body / content text (e.g. the phrase in Typing Racer):** `"Courier New", Courier, monospace`

### Page wrapper pattern

Every standalone experience page follows this pattern:

```css
.{name}-page {
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at center, #2a1000 0%, #180800 55%, #0c0400 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 48px 16px 16px; /* room for back button */
}
```

### Screensavers

Starfield, Fireworks, and Bouncing Shapes intentionally keep their dark canvas backgrounds — they simulate old-school screensavers and look correct against black.

## Reusable interaction patterns

### Ramped lerp (tap-nudges, hold-travels)

Many controls benefit from a lerp factor that starts near zero and accelerates toward a max over ~25 frames. A quick tap produces a small nudge; holding makes the value travel smoothly to the target. Use this for any "follow pointer" mechanic (aim rotation, spin dot, directional movement).

```typescript
// Call each frame while pointer is held; reset lerpRef.current = 0 on pointer-down.
function rampedLerp(current: number, ramp: number, max: number): number {
  return Math.min(max, current + ramp);
}
// Example constants: AIM_LERP_MAX = 0.18, AIM_LERP_RAMP = 0.008
// value += (target - value) * rampedLerp(lerpRef.current, RAMP, MAX);
```

This pattern was first extracted while building the Pool game aim and English controls.

## Spec-driven development

- Specs live in `specs/` and mirror the source tree.
- `spec.md` = current, shippable behavior.
- `spec.todo.md` = roadmap / future work.
- `specs/AGENTS.md` = writing conventions for specs.
- Add a `specs/{name}.md` for every new experience.
- See `AGENTS.md` (root) for the full workflow.

### Window menus (useWindowMenus)

Games and experiences embedded in NS Doors 97 windows (or opened as standalone pages via `StandaloneWindow`) should register their menus using the `useWindowMenus` hook — **not** by rendering a custom menu bar element. This integrates with the standard Win95 window chrome provided by `Window.tsx` and `StandaloneWindow.tsx`.

```typescript
import { useWindowMenus } from '../../components/Window/useWindowMenus';
import type { MenuBarMenu } from '../../components/MenuBar/MenuBar';

// Inside your component:
const menus = useMemo<MenuBarMenu[]>(() => [
  {
    label: 'Game',
    items: [
      { label: 'New Game...', onClick: () => { /* ... */ } },
      { separator: true },
      { label: 'Exit', onClick: onQuit },
    ],
  },
  {
    label: 'Options',
    items: [
      { label: 'Sound', checked: soundOn, onClick: () => setSoundOn(v => !v) },
    ],
  },
], [soundOn, onQuit]);
useWindowMenus(menus);
```

Key points:
- Pass a `useMemo`-ized array — reference equality prevents unnecessary re-renders.
- `separator: true` items render a horizontal divider line.
- `checked: true` renders a ✓ checkmark (use for toggleable options).
- The hook is a no-op outside a window context, so the component is safe to render standalone.

## NS Doors 97 — key details

NS Doors 97 is the flagship experience. It simulates a 1990s desktop:
- Draggable windows (`react-draggable`)
- Desktop icons, taskbar with Start menu
- Screensaver system (activates after idle timeout)
- Built-in apps: file browser, About Noahsoft dialog, simulated internet browser, Tic-Tac-Toe window
- All windows use Win95-style chrome: title bar (orange/brown gradient), close/min/max buttons, beveled borders

### Adding a new app/game to NS Doors 97

There are **three separate places** that must all be updated — missing any one of them is a recurring mistake:

1. **`NsDoors97.tsx`** — four changes:
   - Add to `AppAction` union type
   - Add to `APP_REGISTRY` (id → title/icon/action)
   - Add to `WindowContent` union type
   - Add `case` in the `openWindow()` switch statement
   - Add the render conditional inside the window map (`win.content.type === "..."`)
   - Add the import for the component at the top

2. **`Taskbar.tsx`** — add an entry to `GAMES_ITEMS` (or `TOOLS_ITEMS`). **This is the Start menu list.** Without this the app will open when double-clicked from the desktop but will NOT appear in Start → Games. This step is easy to forget — don't skip it.

3. **`src/data/experiences.ts`** and **`src/App.tsx`** — add the experience entry and the `/route` if the game also has a standalone page.

## Before finishing any task

**CRITICAL: Always run TypeScript check and fix ALL errors before pushing.**

**DO NOT use `npx tsc --noEmit`** — `tsconfig.json` has `"files": []` so it checks nothing and always exits 0. It is a false pass.

**Use this instead:**
```
npm run build 2>&1 | grep "error TS" | grep -v "TS2307\|TS2875\|TS7026\|TS7006\|TS7053\|TS2503\|TS2882" | grep -v "TS2322.*key: "
```
This filters out two classes of local-environment noise:
1. `TS2307` / `TS2875` / `TS7026` / `TS7006` / `TS7053` / `TS2503` / `TS2882` — "Cannot find module 'react'" and its downstream implicit-any cascade (packages are installed on Netlify).
2. `TS2322` where the source type starts with `{ key:` — JSX `key` appearing as an excess property because `@types/react`'s `JSX.IntrinsicAttributes` (which marks `key` as a framework-managed attribute) is absent locally. React correctly strips `key` from JSX prop checks when its types are present.

The output must be empty for all files you changed.

1. Run the command above — verify no errors in any file you touched
2. If errors appear, fix them and run again until passing
3. Commit the fixes
4. Only then push to the branch

The project enables `noUnusedLocals` and `noUnusedParameters`, so unused imports and variables are **build errors** that will fail the Netlify deploy. Every TypeScript error must be fixed before pushing—no exceptions.

**Important:** Netlify's TypeScript targets an older lib than the local `tsc` sometimes allows. Avoid these patterns or they will fail the Netlify build even if they pass locally:
- `Array.prototype.at()` — use `arr[arr.length - 1]` instead
- Other ES2022+ array/string methods not in ES2020 lib (`findLast`, `toSorted`, `toReversed`, etc.)
- When spreading an object and overriding a union-typed field (e.g. `phase: GamePhase`), annotate the local variable explicitly: `const phase: GamePhase = ...` to prevent TypeScript widening it to `string`.
- Generic collections like `new Set(prev)` or `new Map(prev)` — always specify the type parameter explicitly: `new Set<string>(prev)`, `new Map<string, number>(prev)`.
- Test files (`*.test.ts`) that use Node.js built-ins must be excluded from `tsconfig.app.json` via the `exclude` list, not just left in `src/`.

## Chain Reaction — adding word pairs

The game data lives in `src/experiences/ChainReaction/pairs.ts` as a flat list of directed pairs:

```typescript
{ a: "FIRE", b: "WORKS", explanation: "FIREWORKS — an explosive pyrotechnic display" }
```

`a + b` must form a real compound word or common two-word phrase (FIREWORKS, FAST FOOD, KING COBRA). Both `a` and `b` must be full words — no syllable fragments like `NING` or `ET`.

### The graph health rule

Every word that appears as `a` (a "source" word) should have **3 or more** different `b` targets. More importantly, the graph needs **bridge words** — words that appear as *both* `a` and `b` — so chains can keep growing past two hops. Dead ends (words that only appear as `b`) are acceptable as chain terminals, but a word that appears as `b` frequently should also appear as `a` with several outgoing edges.

### How to add pairs

1. **Prefer bridging over appending.** Before adding a new hub word, look for dead-end words that are already reachable from many places and give them outgoing edges pointing to existing hubs. A pair like `FALL → BACK` (FALLBACK) is worth ten `CAMP → FIRE` pairs because it extends chains that were previously stuck.

2. **Target words with high incoming count but zero outgoing.** Run the analysis script (see below) and look at the "Dead ends" section. Words with `in=3+` that have `out=0` are the best candidates — they're already reachable, they just can't continue a chain.

3. **Loop back to existing hubs.** The most valuable pairs are ones where `b` is already a word with many outgoing edges (BACK, GROUND, WATER, HAND, FIRE, BOOK, MARK, OVER, TIME, SHOP, DOWN, PLAY, DOOR, HOUSE, LAND, STONE, etc.). This creates new chain paths without requiring yet another dead-end word.

4. **Avoid duplicate pairs.** The same `{ a, b }` combination must not appear twice. The analyzer will flag these under "ORPHAN STARTS" as repeated arrows.

5. **Write a real explanation.** Format: `"COMPOUND — plain English description"`. Lead with the compound or phrase name, then a short definition. Keep it under ~100 characters.

### Running the analysis script

```bash
node scripts/analyze-pairs.mjs
```

This reports:
- **Dead ends** — words that only appear as `b` (chain stops here)
- **Orphan starts** — words that only appear as `a` (nothing leads here; also reveals duplicates)
- **Low outgoing (<3)** — sources that are hard to grow chains forward from
- **Low incoming (<3)** — targets that are hard to reach via backward growth
- **Generator simulation** — 200 random trials per chain length showing actual success rate and example chains

**The generator simulation is the ground truth.** After adding pairs, the simulation must show 0% failure rate for Quick (4), Normal (6), and Long (8) chains. A non-zero failure rate means some seed words create dead ends the backward pass cannot escape.

### Checklist before committing new pairs

1. Run `node scripts/analyze-pairs.mjs` — check simulation shows 0 failures for all three lengths
2. Scan the "ORPHAN STARTS" section for any word listed with duplicate arrows (indicates a duplicate pair)
3. Verify every new `b` word either already exists as a hub OR you are also adding outgoing edges for it
4. Run the TypeScript build check — `pairs.ts` is plain data but the build will catch syntax errors

## Known conventions

- Commits reference the feature or PR (see git log for style)
- "Press Start 2P" is already loaded globally via `index.html` — no additional import needed
- `@noahwright/design` is a private npm package owned by Noah; don't re-implement its components
- Category values in `experiences.ts`: `"game"`, `"screensaver"`, `"toy"`, `"educational"`
- The `HelpOverlay` component renders a `?` button in the corner; pass `title` and children (a `<ul>` of tips)
