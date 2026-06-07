# NS Doors 97 — TODOs

## Sooner

- [#70](https://github.com/NoahWright87/toybox/issues/70) Bug: NS-TOS `dir` command can only navigate one directory level at a time
  - `cd` should accept multi-level paths like `cd Programs\Games`
  - Related: see the "NS-TOS as a more complete shell" item below for broader shell improvements

- [#88](https://github.com/NoahWright87/toybox/issues/88) Many apps don't fill the window when maximized/embiggened
  - Audit all apps/games opened inside Doors 97 windows
  - Each should fill its window pane when the window is resized or maximized

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

- [#31](https://github.com/NoahWright87/toybox/issues/31) Documents folder with humorous realistic-feeling contents
  - `password.txt` with an obvious/guessable password and ridiculous username
  - `CHEAT CODES.txt` with fake cheat codes and what they (pretend to) do
  - A long walkthrough for "that hard stage" in some classic game
  - Random people's phone numbers in contacts documents
  - Multiple drafts of `IMPORTANT.txt` / `DON'T FORGET.txt` with absurd to-do lists
  - 90s nerd/gamer references throughout; keep it humorous and era-appropriate

- [#72](https://github.com/NoahWright87/toybox/issues/72) Task Manager — "Peephole"
  - Win95-style task manager showing running Doors 97 apps/windows
  - Noahsoft-branded name: "Peephole"
  - Should show process list, memory usage (fake), and ability to force-close windows

- [#102](https://github.com/NoahWright87/toybox/issues/102) Calculator app with segmented LCD display
  - Classic Win95 Calculator look with a retro 7-segment LCD readout
  - Standard arithmetic operations at minimum

- [#103](https://github.com/NoahWright87/toybox/issues/103) Media player with fun visualizations
  - Needs a way to get music in (file picker? mic input?)
  - Retro-style spectrum/waveform visualizations
  - Note: audio input method TBD

- [#105](https://github.com/NoahWright87/toybox/issues/105) Clock app
  - Analog and/or digital clock in a small Doors 97 window

- [#106](https://github.com/NoahWright87/toybox/issues/106) Calendar app
  - Monthly calendar view in a Doors 97 window

- [#107](https://github.com/NoahWright87/toybox/issues/107) Disk defragmenter utility
  - Purely aesthetic — the classic colorful block-grid animation
  - Decide whether to wire it up to any real FS behavior or keep it purely nostalgic

- [#108](https://github.com/NoahWright87/toybox/issues/108) Fake instant messenger — "NIM" (Noahsoft Instant Messenger)
  - Clearly not AOL AIM but visually inspired by it; rename appropriately
  - No real connection to other people; probably a SmarterChild-style chatbot as the only "contact"

- [#110](https://github.com/NoahWright87/toybox/issues/110) Standard Help app — F1 opens it
  - A Win95-style Help viewer accessible via F1 from the desktop or any app
  - Content can be fake/humorous OS documentation

## Backlog

- [#29](https://github.com/NoahWright87/toybox/issues/29) Custom Win95-style mouse cursors inside the OS desktop

- [#73](https://github.com/NoahWright87/toybox/issues/73) Upgrade storage layer to OPFS + File System Access API
  - Replace localStorage-backed `FileSystemStore` with an Origin Private File System backend
  - Internal drive (`C:/`) backed by OPFS; persistent across sessions without localStorage size limit
  - Optional second drive (`D:/`) via `window.showDirectoryPicker()` (File System Access API)
  - Single shared `FileSystemService` API hides whether a path is OPFS or a mounted local folder
  - Graceful fallback message when File System Access API is unsupported
  - All existing app code routes through the shared API unchanged

- [#109](https://github.com/NoahWright87/toybox/issues/109) Fake peer-to-peer file sharing app
  - Nostalgic nod to Napster/Kazaa/LimeWire era
  - No real network connection; simulate fake search results and "downloading" with progress bars

## Reminders

- Move completed items to `ns-doors-97.md` — this file is for future plans, not current state
- Items flow: INTAKE → `spec.todo.md` → this file → `ns-doors-97.md` (when done)
- New apps that save data must use `fsStore` — see `filesystem.spec.md` for the rules
