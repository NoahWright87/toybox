# NS Doors 97 — Current State

## Related

- [`spec.md`](spec.md)
- [`tic-tac-toe.md`](tic-tac-toe.md)

## Overview

NS Doors 97 is the flagship Toy Box experience: a simulated 1990s desktop OS (a parody of Windows 95/98) made by "Noahsoft". It is the default route (`/`) — the first thing users see. All other experiences are accessible as windows within it.

## Routes

- `/` — primary entry point
- `/doors97` — alias

## Desktop

- Dark teal/green desktop wallpaper (`#008080`, the classic Win95 default).
- Desktop icons arranged in a column on the left: static icons + one icon per registered experience.
- Double-clicking (or single-clicking on touch) an icon opens a window.
- Clicking the desktop (outside any window) deselects icons.

### Static desktop icons

| Icon | Title | Opens |
|---|---|---|
| 🖥️ | My Doors | Folder browser window |
| 🗑️ | Recycle Bin | Placeholder / not implemented |
| ℹ️ | About NS Doors 97 | About dialog |
| 🌐 | Internet | Simulated browser window |
| 💤 | Screensavers | Screensaver settings window |

### Experience icons

One icon per experience registered in `src/data/experiences.ts` (excluding NS Doors 97 itself). Opening launches either an app-launcher window or an embedded app window, depending on the experience.

## Windows

Windows use `react-draggable`. Each window has:
- **Title bar** — orange/brown gradient, icon, title text, minimize/maximize/close buttons (close is functional; min/max are decorative)
- **Beveled chrome** — Win95 raised outer border, sunken inner frame
- **Content area** — white or gray depending on app

Multiple windows can be open simultaneously. Clicking a window brings it to the front (z-index management). Windows can be dragged anywhere on the desktop.

### Window types

| Type | Content |
|---|---|
| `app-launcher` | "Open in new tab" button for external experiences |
| `tictactoe` | Embedded `<TicTacToe />` component |
| `nomnom` | Embedded `<NumberMuncher />` (Nom Nom Numerals) |
| `screensaver-settings` | Screensaver picker and preview |
| `about` | About Noahsoft dialog |
| `my-doors` | Folder / file browser |
| `internet` | Simulated internet browser |

## Taskbar

- Fixed to the bottom of the screen.
- **Start button** (left): opens the Start menu.
- **Window buttons** (middle): one pill per open window; clicking focuses the window.
- **Clock** (right): live digital clock showing current time.

## Start menu

Opens when the Start button is clicked. Contains shortcuts to launch apps (About, My Doors, Internet, Screensavers, Toy Box launcher). Clicking outside closes it.

## Screensaver system

- Activates after an idle timeout (no mouse movement or click).
- Screensaver overlay renders over the entire desktop.
- Available screensavers: Starfield, Fireworks, Bouncing Shapes.
- Moving the mouse or clicking dismisses the screensaver.
- Settings window lets the user choose the active screensaver and preview it.

## App: My Doors (folder browser)

Simulates a Windows Explorer folder view. Shows a fake file tree of "drives" and folders. Clicking folders navigates in. Double-clicking files shows a placeholder message.

## App: Internet (simulated browser)

A fake browser window with an address bar and navigation buttons. Loads a set of hardcoded fake "websites". Not a real browser — purely decorative.

## App: About NS Doors 97

A Win95-style About dialog: Noahsoft logo area, version text, copyright, and an OK button.

## Styling

All OS chrome uses the Noahsoft Win95 palette:
- Desktop background: `#008080`
- Title bar: brown-orange gradient
- Window chrome: `#c0c0c0` with beveled borders
- Font: "Press Start 2P" for all OS UI text
- Taskbar: dark gray with raised border
