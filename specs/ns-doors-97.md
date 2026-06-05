# NS Doors 97 — Current State

## Related

- [`spec.md`](spec.md)
- [`filesystem.spec.md`](filesystem.spec.md)
- [`tic-tac-toe.md`](tic-tac-toe.md)

## Overview

NS Doors 97 is the flagship Toy Box experience: a simulated 1990s desktop OS (a parody of Windows 95/98) made by "Noahsoft". It is the default route (`/`) — the first thing users see. All other experiences are accessible as windows within it.

The OS is built around a real virtual filesystem (`FileSystemStore`) backed by `localStorage`. All data — desktop icons, app files, score files, saved drawings, recordings — lives in this FS. See [`filesystem.spec.md`](filesystem.spec.md) for architecture details.

## Routes

- `/` — primary entry point
- `/doors97` — alias

## Provider tree

```
NsDoors97Page
  FSProvider          ← singleton FileSystemStore; any FS change re-renders children
    OsDialogProvider  ← modal OS dialog system
      NsDoors97       ← desktop, windows, taskbar
```

## Boot screen

On first visit (or after 30 minutes of absence), a BIOS-style boot sequence plays before the desktop appears:

- Randomised CPU name, RAM count, drive detection, IRQ table, and POST messages.
- Noahsoft splash screen with progress bar.
- Returning from NS-TOS shows only the splash (skips BIOS).
- Returning from a standalone app page skips boot entirely.
- Restart (via Start menu) plays a shutdown sound, blanks the screen, then replays the full boot.

After boot, desktop icons animate in one-by-one in randomised order, with occasional cursor-wait flashes to simulate a slow system initialising.

## Desktop

- Configurable background (solid color, Noahsoft dark gradient, or wallpaper image). Default: `#cc4400` orange.
- Desktop icons in two columns: system icons on the left, user files/shortcuts on the right.
- All desktop icons are driven by `store.getChildren(DESKTOP_ID)` — the filesystem is the source of truth.
- Double-clicking (or single-tap on touch) an icon calls `openFSNode(nodeId)`.

### System desktop icons (left column, `system: true`)

| Node | Shortcut target | Opens |
|---|---|---|
| My Doors | `targetAppId: "files"` | FilesApp window (folder browser) |
| Dumpster | `targetAppId: "dumpster"` | FilesApp window (Recycle Bin mode) |

These nodes are `system: true` and cannot be deleted or renamed.

### User desktop icons (right column, `system: false`)

- `README.txt` — pre-seeded text file; opens in Notebook
- User-created Notebook files (added as desktop shortcuts when a new file is saved in Notebook)
- User-created Sound Recorder recordings (added as desktop shortcuts when a recording is saved)
- Any other shortcuts or files created at runtime

## Window system

Windows use `react-draggable`. Each window has:
- **Title bar** — orange/brown gradient, emoji icon, title text, minimize / maximize / close buttons (min is functional; max is decorative)
- **Menu bar** — Win95-style File / Edit / Help menus populated per-app via `useWindowMenus()`
- **Beveled chrome** — Win95 raised outer border, sunken inner frame
- **Content area** — white or gray depending on app

Multiple windows can be open simultaneously. Clicking a window brings it to the front (z-index management). Windows can be dragged anywhere on the desktop. Minimising collapses the window to the taskbar only.

### Window types

| Content type | App | Notes |
|---|---|---|
| `app-launcher` | External experience launcher | "Play" button navigates to the standalone route |
| `tictactoe` | Tic-Tac-Toe | Window width changes with board size (3→380px, 5→480px, 7→580px) |
| `nomnom` | Nom Nom Numerals (Number Muncher) | |
| `word-whirlwind` | Word Whirlwind | |
| `words` | WORDS | |
| `pool` | 8-Ball Pool | Width: 800px |
| `bombfinder` | Bomb Finder | Width changes with difficulty |
| `duckhunt` | Duck & Learn | Width: 740px |
| `cards-launcher` | Cards launcher | Picker for War, Blackjack, Pyramid |
| `cards-game` | War / Blackjack / Pyramid | Replaces launcher window |
| `chain-reaction` | Chain Reaction | |
| `peg-solitaire` | Peg Solitaire | |
| `screensaver-settings` | Screensaver settings | |
| `desktop-display` | Display properties | Background type, color, wallpaper |
| `about` | About NS Doors 97 | Noahsoft logo, version, OK button |
| `internet` | Simulated browser | Fake address bar + hardcoded fake websites |
| `files` | My Doors (folder browser) | Navigates real FS via FilesApp |
| `dumpster` | Recycle Bin | FilesApp in dumpster mode |
| `notebook` | Notebook text editor | Reads/writes FS files |
| `nsart` | NS Art (pixel drawing) | Auto-saves to FS |
| `nsart-backup` | NS Art (loaded from backup) | Alias for nsart |
| `sound-recorder` | Sound Recorder | Saves WAV metadata to FS |
| `midi-editor` | MIDI Editor | |

## App: My Doors (FilesApp)

A Win95-style folder browser driven entirely by the virtual filesystem.

- Navigation is a folder-ID stack. "Up" pops the stack.
- Address bar shows the `C:\`-style path from `store.getPath(currentFolderId)`.
- Contents are sorted: folders first, then files/shortcuts alphabetically.
- Clicking a folder navigates into it; clicking a file dispatches by type:
  - Text-like files (`text`, `bat`, `sys`, `ini`, `dat` with content) → open in Notebook
  - `.exe` with `appId` → open that app window
  - `.exe` with `appId: "tos-only"` → dialog explaining NS-TOS launch requirement
  - `.wav` with `appId: "sound-recorder"` → open Sound Recorder with that recording
  - `.tmp` → "file damaged" error dialog
  - `.zip`, `.bmp`, `.png`, `.wav` (no app) → "need additional program" error dialog
  - Anything else without appId → "not a valid NS Doors application" error (with fake error code)
- Status bar shows object count and folder count.
- File menu exposes "Empty Dumpster" in Dumpster mode.
- Deleting a file moves it to the Dumpster (or permanently deletes if already there). System nodes are protected.

## App: Notebook

A simple text editor that reads and writes FS files.

- File path shown in a path bar at the top.
- `File > Save` writes `fsStore.writeFile(fileId, content)`.
- After saving, fires a callback to `NsDoors97.tsx` which creates a desktop shortcut for the file (if one does not already exist).
- `Edit > Word Wrap` toggles line wrapping.
- Status bar shows line count, character count, read-only indicator, and unsaved/saved state.
- Files with `readonly: true` show in read-only mode (no save).
- Opening from Start > Tools > Notebook creates a new `Untitled.txt` in `C:\Documents\`.

## App: NS Art

Pixel drawing tool.

- Auto-saves to `NS_ART_BACKUP_ID` (`C:\Programs\Accessories\NS Art\Untitled.nsart`).
- On load, reads from the FS backup; if the file is empty, checks old localStorage key for legacy migration.
- Close button triggers a "save?" prompt before closing if there are unsaved changes.
- Can be opened standalone at its own route (uses the singleton directly without the FSProvider).

## App: Sound Recorder

Records audio via the browser microphone API.

- Saved recordings appear as `.wav` files in `C:\Programs\Accessories\Sound Recorder\`.
- Audio data is stored in IndexedDB (efficient for binary); the FS node is metadata only.
- After saving, a desktop shortcut is created.
- Clicking a `.wav` file (from desktop or FilesApp) opens Sound Recorder preloaded with that recording.

## App: Dumpster (Recycle Bin)

Reuses `FilesApp` with `startFolderId={DUMPSTER_ID}` and `isDumpster={true}`.

- Clicking a file in Dumpster mode prompts to permanently delete it.
- "Empty" button (toolbar) and "Empty Dumpster" (File menu) call `store.emptyDumpster()`.
- Pre-seeded with three files to look lived-in: an unsent complaint letter, an old budget, and a NS Doors 95 uninstaller.

## App: Internet (simulated browser)

A fake browser window with an address bar and navigation buttons. Loads hardcoded fake "websites". Not a real browser — purely decorative.

## App: Screensaver settings

Lets the user choose the active screensaver (Starfield, Fireworks, Bouncing Shapes), set idle timeout, and preview the screensaver immediately.

## App: Display properties

Lets the user configure the desktop background:
- **Noahsoft gradient** — the dark radial gradient (signature look)
- **Solid color** — any hex color (default: `#cc4400` orange)
- **Wallpaper** — preset images (Sunset, Arch) or a custom uploaded image, with cover/contain fit

Settings persist to `localStorage` (separate from the FS).

## Taskbar

Fixed to the bottom of the screen.

- **Open button** (left, door emoji): opens the Start menu.
- **Window buttons** (middle): one pill per open window; clicking focuses/restores the window; active window is highlighted; minimized windows are dimmed.
- **System tray** (right): fullscreen toggle button, retro clock (real time; date displayed 30 years in the past to show a 1990s date).

## Start menu

Opens when the Open button is clicked. Flyout submenus on hover:

| Item | Submenu / action |
|---|---|
| Games | Cards, Tic-Tac-Toe, 8-Ball Pool, Word Whirlwind, WORDS, Bomb Finder, Duck & Learn, Nom Nom Numerals, Type 'Em Up, Chain Reaction, Peg Solitaire |
| Tools | Notebook, NS Art, Sound Recorder, MIDI Editor |
| Internet | Opens internet browser window |
| Settings | Display..., Screensavers... |
| About NS Doors 97 | Opens about dialog |
| Exit to NS-TOS... | Navigates to `/ns-tos` |
| Restart... | Plays shutdown sound, blanks screen, replays boot |

Clicking outside the menu closes it.

## Screensaver system

- Activates after configurable idle timeout (no mouse movement, click, key, or touch).
- Available screensavers: Starfield, Fireworks, Bouncing Shapes.
- Moving the mouse or clicking dismisses the screensaver.
- Settings persisted via `screensaverSettings.ts` (not in the FS — separate localStorage key).

## Virtual filesystem integration

The desktop, My Doors, Notebook, NS Art, Sound Recorder, Duck & Learn, and Typing Racer all use the FS. Score files are plain text/JSON stored in each game's sub-folder under `C:\Programs\Games\`. Opening a `SCORES.DAT` file in Notebook shows the raw scores; editing and saving changes the score — this is intentional (the hackable OS philosophy).

See [`filesystem.spec.md`](filesystem.spec.md) for the complete architecture.

## Styling

All OS chrome uses the Noahsoft Win95 palette:
- Desktop background: configurable (default orange `#cc4400`)
- Title bar: brown-orange gradient
- Window chrome: `#c0c0c0` with beveled borders (raised: `#ffffff #808080 #808080 #ffffff`; sunken: `#808080 #ffffff #ffffff #808080`)
- Font: "Press Start 2P" for all OS UI text
- Taskbar: dark gray with raised border
