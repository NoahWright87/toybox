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

NS Doors 97 is the flagship experience. It simulates a 1990s desktop OS (a Noahsoft parody of Windows 95/98):
- Draggable windows (`react-draggable`)
- Desktop icons driven by the real virtual filesystem (see below)
- Taskbar with Start menu, clock
- Screensaver system (activates after idle timeout)
- Built-in apps: file browser (My Doors), Recycle Bin, About dialog, simulated browser, Notebook, NS Art, Sound Recorder, MIDI Editor, NS-TOS terminal, all games
- All windows use Win95-style chrome: title bar (orange/brown gradient), close/min/max buttons, beveled borders

## Unified Virtual Filesystem — architecture and rules

**This is the single most important system in Doors 97.** Everything that persists data goes through it. No exceptions.

### Philosophy: NS Doors 97 is hackable

This is intentional design. Users can open files in the fake OS and make changes that have real effects:
- **Scores** — SCORES.DAT files are plaintext JSON in each game's folder. Open in Notebook, edit the number, save. Your score changes. This is a feature.
- **Config/INI files** — `win.ini` and `system.ini` in `C:\System\` are (progressively) wired to real OS behavior. Agents should wire up settings rather than leaving them decorative. Example: `[Desktop] Wallpaper=...` should change the desktop wallpaper.
- **Desktop** — users can add/remove shortcuts, files, and folders on the desktop. The system icons (My Doors, Dumpster) are protected (`system: true`) and cannot be deleted.
- **App assets (future)** — bundled assets (HELL sprites, wallpapers, sound effects) have FS counterparts. If a user draws a new sprite in NS Art and saves it at the right FS path, the game uses their version on next load. Detection is path-based: non-empty FS file content wins over the bundled file.

### Architecture

| Layer | What |
|---|---|
| `FileSystemStore` | Singleton. Flat `Map<string, FSNode>`. Persists to localStorage via `StorageAdapter`. |
| `StorageAdapter` | Interface: `getItem/setItem/removeItem`. `LocalStorageAdapter` is current impl. Swap for IndexedDB by changing the constructor arg — never bypass it with direct `localStorage` calls. |
| `FSProvider` + `useFS()` | React context. `FSProvider` subscribes to `fsStore` and re-renders on any change. Use `useFS()` inside the NS Doors 97 component tree. |
| Direct singleton access | Components outside `FSProvider` (standalone pages, game components) import `fsStore` directly and call it without reactivity. |
| `seed.ts` | Creates the full C:\ tree on first load (batch call, ~1 save). |
| `migrate()` | Runs after every load. Adds stable-ID nodes that may have been added after initial seeding. **When you add a new stable-ID node, add it to both `seed.ts` AND `migrate()`.** |

### The mandatory rule

**Every new app or experience that saves any data MUST use `fsStore`. No direct `localStorage` calls, no custom IndexedDB stores, no other mechanism.** If audio data is too large for the FS (Sound Recorder), store it in IDB but register a metadata FSFile in the FS so it appears in the file browser.

### Well-known folder IDs (from `filesystem/types.ts`)

```
ROOT_ID      = "fs:root"         C:\
DESKTOP_ID   = "fs:desktop"      drives desktop icon rendering
DUMPSTER_ID  = "fs:dumpster"     Recycle Bin
DOCUMENTS_ID = "fs:documents"
PROGRAMS_ID  = "fs:programs"
GAMES_ID     = "fs:games"
ACC_ID       = "fs:accessories"
SYSTEM_ID    = "fs:system"
DOWNLOADS_ID = "fs:downloads"
EGO_ID       = "fs:ego"          HELL game folder
```

### Stable file IDs (app-owned files that need direct access)

```
NS_ART_BACKUP_ID = "fs:nsart-backup"   NS Art auto-save
DH_SCORES_ID     = "fs:scores-dh"      Duck & Learn SCORES.DAT
TR_SCORES_ID     = "fs:scores-tr"      Typing Racer SCORES.DAT
```

Add new stable IDs here when an app needs to find a specific file without traversing the tree.

### How to integrate a new app

1. Decide what the FS node(s) look like: which folder they live in, what `fileType` they use, whether they need a stable ID.
2. Add any stable IDs to `types.ts` and create the file in both `seed.ts` (for new installs) and `migrate()` (for existing sessions).
3. In the component: use `fsStore.writeFile(id, content)` to save, `fsStore.getFile(id)?.content` to load. Check FS first, then any legacy storage key, then delete the legacy key (one-time migration).
4. If the file needs to open with a specific app when double-clicked from FilesApp, set `appId` on the FSFile.

### Mandatory: in-progress game state must survive reload/rotation

**The web is brittle.** Mobile browsers reload pages on screen rotation, tab
suspension reclaims memory, and users refresh by habit. Any game with an
in-progress session (a board, a score, a timer) MUST persist that session to
`fsStore` so it survives a reload — not just final high scores. Losing a
half-finished game is a bad user experience and is treated as a bug.

Pattern (see `MahjongSolitaire.tsx` for a full example using `MJ_STATE_ID` /
`SAVE.DAT`):

1. Add a stable `*_STATE_ID` constant (e.g. `MJ_STATE_ID = "fs:mj-state"`) and
   create a `SAVE.DAT` file for it in both `seed.ts` and `migrate()`, alongside
   any `SCORES.DAT`.
2. On mount, lazily read and `JSON.parse` the save file. Validate its shape
   (version number, expected slot/cell IDs) before trusting it — fall back to
   a fresh game if it doesn't match. Use the parsed result to lazily initialize
   `useState` for board/score/etc.
3. For elapsed time, store `elapsedSec` *and* a `savedAt` timestamp; on reload,
   add `(Date.now() - savedAt) / 1000` to the saved `elapsedSec` rather than
   running a continuous interval-driven write.
4. Write the save file (`fsStore.writeFile`) after each meaningful state
   change (a move, a match, a shuffle, a new game) and once on mount so a
   rotation immediately after opening the game doesn't lose the initial state.
   Avoid writing on every timer tick — `fsStore.save()` serializes the entire
   filesystem on every write, so per-second writes are wasteful.
5. On a win/game-over, clear the save (`fsStore.writeFile(id, "")`) — a
   finished game has nothing to resume.

This applies to all new games and toys with session state, not just Mahjong.

### Key API

```typescript
// Queries
fsStore.getNode(id)          // FSNode | undefined
fsStore.getFile(id)          // FSFile | undefined
fsStore.getChildren(folderId)  // sorted: folders first, then alpha
fsStore.getPath(id)          // "C:\\Documents\\todo.txt"
fsStore.getNodeByPath(path)  // resolves "C:\\..." path string to a node
fsStore.findChild(folderId, name)  // case-insensitive name lookup

// Mutations
fsStore.createFile(parentId, name, options?)   // options: fileType, appId, content, readonly, system, id
fsStore.createFolder(parentId, name, options?) // options: system, id
fsStore.createShortcut(parentId, name, options?) // options: targetAppId, targetFilePath, system, id
fsStore.ensureFile(parentId, name, options?)   // find-or-create
fsStore.writeFile(id, content)  // update content, triggers re-render
fsStore.deleteNode(id)          // moves to Dumpster (unless already there → permanentDelete)
fsStore.emptyDumpster()
fsStore.batch(fn)               // defer save/emit until after fn
```

### FSNode types

```typescript
type FSFileType = "text"|"exe"|"bat"|"sys"|"scr"|"drv"|"tmp"|"zip"|"bmp"|"png"|"ini"|"wav"|"dat"|"lnk"

interface FSFile     { kind:"file",     ..., fileType, content:string, readonly, appId? }
interface FSFolder   { kind:"folder",   ..., parentId: string|null, system }
interface FSShortcut { kind:"shortcut", ..., targetAppId?, targetFilePath?, system }
```

- Shortcuts with `system: true` cannot be deleted by users.
- `appId` on a file determines which app opens it when double-clicked in the file browser.
- A `.wav` file with `appId: "sound-recorder"` opens Sound Recorder pre-loaded with that recording.

### Current integrations at a glance

| App | FS path | Stable ID | Notes |
|---|---|---|---|
| NS Art backup | `C:\Programs\Accessories\NS Art\Untitled.nsart` | `NS_ART_BACKUP_ID` | Full JSON backup content stored in FS |
| Sound recordings | `C:\Programs\Accessories\Sound Recorder\*.wav` | — | Metadata node only; audio stays in IDB |
| Duck & Learn scores | `C:\Programs\Games\Duck & Learn\SCORES.DAT` | `DH_SCORES_ID` | JSON array, hackable in Notebook |
| Typing Racer score | `C:\Programs\Games\Typing Racer\SCORES.DAT` | `TR_SCORES_ID` | Single integer string |
| Notebook files | anywhere in `C:\` | — | Full text content in FS |
| Desktop shortcuts | `C:\Desktop\` | — | Created when Notebook/SoundRecorder saves |

### Future vision (preserve these for future agents)

1. **StorageAdapter swap** — Swap `LocalStorageAdapter` for an IndexedDB adapter when storage needs grow. Change the constructor; all app code stays the same.
2. **Asset override system** — Bundled repo files (sprites in `/public/`, wallpapers) have FS counterparts seeded as stubs. When the FS file has non-empty content, the game/app uses it instead of the bundled file. Path-based detection.
3. **Config file wiring** — `win.ini`/`system.ini` entries should progressively affect real OS behavior. Wire them up; don't leave them decorative.
4. **NS-TOS as a real shell** — Expand terminal commands (COPY, MOVE, more piping) to operate on the real FS.
5. **All new apps** — Any new app or feature that persists state must integrate with the FS. Do not add standalone localStorage keys.

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

## Dependency policy — supply chain safety

This project is intentionally minimal on npm dependencies to reduce supply-chain risk. Before adding any new package:

1. **Prefer writing it ourselves** — if a feature can be implemented in a few hundred lines using only Web/Node built-ins, do that rather than pulling in a library. See `src/experiences/MidiEditor/sf2.ts` as an example: a full SF2 soundfont parser written in-house instead of using an npm library.
2. **Vet every new package** — check weekly download counts (prefer 100 k+/week), number of contributors, transitive dependency count, last release date, and known CVEs before adding.
3. **Pin to exact versions** — use `"1.2.3"` not `"^1.2.3"` or `"~1.2.3"` in `package.json` so the lockfile is the only source of truth and a future patch release cannot be weaponized.
4. **Commit the lockfile** — `package-lock.json` must always be committed and up to date.
5. **Binary assets (fonts, images, SF2 soundfont files) are not executable code** — they carry no supply-chain risk in the npm sense, but document the download source and SHA-256 in a comment or adjacent README when adding them.

## Known conventions

- Commits reference the feature or PR (see git log for style)
- "Press Start 2P" is already loaded globally via `index.html` — no additional import needed
- `@noahwright/design` is a private npm package owned by Noah; don't re-implement its components
- Category values in `experiences.ts`: `"game"`, `"screensaver"`, `"toy"`, `"educational"`
- The `HelpOverlay` component renders a `?` button in the corner; pass `title` and children (a `<ul>` of tips)
