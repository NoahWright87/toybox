# NS Doors 97 — TODOs

## Sooner

## Later

- [#26](https://github.com/NoahWright87/toybox/issues/26) "Working" internet browser window — simulate a 1990s web experience
  - Modem connection screen with characteristic dial-up noises in semi-random sequence
  - Pages and images load jerkily and slowly
  - Broken layout / crazy resolution — pages do not render correctly
  - Generally: anything that makes it feel like a janky 90s connection
  - Sub-item: [#53](https://github.com/NoahWright87/toybox/issues/53) Create a fake "flash games" website accessible through the browser
    - Recreate old-school games: eat-smaller-fish, helicopter dodge, bubble pop, Snood-like, etc.
    - Accessed by navigating to a fake URL inside the browser

- Wire up `win.ini` / `system.ini` to real OS behavior
  - `[Desktop] Wallpaper=` → set desktop wallpaper from FS path
  - `[Desktop]` solid color entries → change desktop background color
  - `[windows] Beep=` → toggle system beep sounds
  - `[sounds]` entries → wire to actual audio playback on OS events
  - Rule: every new INI entry wired up should be reflected in Display/Screensaver settings and vice versa

- Asset override system (FS-backed sprite replacement)
  - If a FS file at a path matching a `/public/` bundled asset has non-empty content, the game/app uses that content instead
  - Enables: draw a HELL sprite in NS Art → save to `C:\EGO\SPRITES\ENEMY0.BMP` → HELL game loads it on next run
  - Detection is path-based; empty FS content means "use bundled default"

- Folder navigation from desktop
  - Double-clicking a folder node on the desktop should open My Doors navigated to that specific folder (not just the root)
  - Requires passing `startFolderId` through `openFSNode` when `node.kind === "folder"`

- StorageAdapter swap to IndexedDB
  - Implement `IndexedDBAdapter` implementing the `StorageAdapter` interface
  - Swap into `FileSystemStore` constructor; no other code changes required
  - Benefit: larger storage quota, avoids localStorage 5 MB limit for large NS Art files

- NS-TOS as a more complete shell
  - `COPY src dst` — copy a file to a new location in the FS
  - `MOVE src dst` — move (rename + reparent)
  - `TYPE file | more` — paginate long text files
  - Wildcard expansion for `DIR *.exe`, `DEL *.tmp`, etc.
  - `CLS` — clear terminal output
  - `VER` — print OS version string

## Backlog

- [#29](https://github.com/NoahWright87/toybox/issues/29) Custom Win95-style mouse cursors inside the OS desktop

## Reminders

- Move completed items to `ns-doors-97.md` — this file is for future plans, not current state
- Items flow: INTAKE → `spec.todo.md` → this file → `ns-doors-97.md` (when done)
- New apps that save data must use `fsStore` — see `filesystem.spec.md` for the rules
