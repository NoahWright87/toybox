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

- [#32](https://github.com/NoahWright87/toybox/issues/32) Fake file structure — "My Machine" (or similar) folder browser
  - Opens in a Win95-style folder viewer from My Doors or a desktop icon
  - Navigate folder hierarchy; back-up control (no fancy breadcrumbs — 90s style)
  - Fixed locations: games in `/Games`, backgrounds in `/Backgrounds`, OS files in `/System`
  - Randomly placed Easter-egg files scattered throughout (see #31)
  - Rule: anything added to the desktop / Start menu must also appear somewhere in the file system

- [#31](https://github.com/NoahWright87/toybox/issues/31) Documents folder with Easter-egg files
  - Stored in a settings/config file in the repo so agents can add to it over time
  - Include: `passwords.txt` (ridiculous credentials), `cheat codes.txt`, walkthrough for "that hard stage", random phone numbers, multiple drafts of "Important - Don't Forget", etc.
  - Tone: humorous, 90s-appropriate; lean into nerd/gaming/computer references

## Backlog

- [#29](https://github.com/NoahWright87/toybox/issues/29) Custom Win95-style mouse cursors inside the OS desktop

## Reminders

- Move completed items to `ns-doors-97.md` — this file is for future plans, not current state
- Items flow: INTAKE → `spec.todo.md` → this file → `ns-doors-97.md` (when done)
- If you add content to the file structure (#32), update both the folder-data config and `ns-doors-97.md`
