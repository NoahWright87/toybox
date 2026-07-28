# Design System

The in-repo design system for Toy Box / NS Doors 97. Replaces the former
external `@noahwright/design` package. Documented and live-editable in the
**Design** app at `/design` (intended public home: `design.doors97.com`).

## Tokens — `src/theme.css`

A single `:root` block is the source of truth for the retro palette, fonts, and
spacing. Imported once in `src/main.tsx` (before `index.css`). New and refactored
CSS must reference these vars — **never hardcode the palette hex literals**, or
live re-theming breaks.

### Palette (all eight are user-themeable)

| Token | Default | Use |
|---|---|---|
| `--orange-primary` | `#cc4400` | X player, active/hover, buttons, title bar |
| `--orange-bright` | `#ff6b00` | title-bar gradient mid, highlights |
| `--purple` | `#5b2d8e` | O player, accents |
| `--purple-bright` | `#7b3dbe` | accents |
| `--green-win` | `#228833` | success / win states |
| `--win95-gray` | `#c0c0c0` | primary panel background |
| `--win95-warm-gray` | `#d4d0c8` | inset / recessed areas |
| `--win95-dark` | `#808080` | shadows, borders |

Non-themeable helpers also defined: `--white`, `--orange-bevel-light/dark`,
`--page-bg`, `--background`, `--foreground`, `--font-ui`, `--font-body`,
`--spacing-md`.

### Bevel utility classes

The Win95 raised/sunken border recipe, derived from the palette tokens:
`.bevel-raised`, `.bevel-sunken`, `.bevel-orange-raised`, `.bevel-orange-sunken`.
Apply alongside a `background` instead of re-declaring the four-color border.

## Reusable chrome — `src/components/`

`Window` (`TitleBar`, `ResizeHandles`, `useWindowMenus`), `MenuBar`,
`StandaloneWindow`, `Tabs`; plus NS Doors 97 chrome (`OsDialog`, `Taskbar`).
Apps register window menus via the `useWindowMenus` hook (see root CLAUDE.md).

## Hackable theme — `C:\System\theme.ini`

The eight palette tokens are driven by the `[Theme]` section of a plaintext,
Notebook-editable file in the virtual filesystem.

- **Definitions:** `src/experiences/NsDoors97/themeTokens.ts` (pure data — token
  list, defaults, `THEME_INI` default content). No FS imports, so `seed.ts` and
  `FileSystemStore.migrate()` can import it.
- **Load/save/apply:** `src/experiences/NsDoors97/themeSettings.ts` —
  `loadThemeSettings()`, `saveThemeSettings()`, `applyTheme()` (mirrors the
  existing `desktopSettings.ts` pattern).
- **Live application:** a `useEffect` in `NsDoors97.tsx`, keyed on the theme
  file's content (via `useFS()`), pushes each value onto
  `document.documentElement` with `style.setProperty('--<token>', value)`.
- **Two doors, one room:** editing a color in the Design app and hand-editing
  `theme.ini` in Notebook both flow through the same FS subscription and re-skin
  the OS instantly. Deleting a line falls back to the `theme.css` default.
- Stable ID: `THEME_INI_ID = "fs:theme-ini"` (`filesystem/types.ts`); seeded in
  `seed.ts` and `migrate()`.

## Design app — `src/experiences/Design/DesignApp.tsx`

Two-pane Win95 Control-Panel layout (Storybook's shape, no Storybook):

- **Left:** nav tree — Tokens (Colors, Typography, Bevels), Window chrome
  (Title Bar, Menu Bar, Resize Handles, Dialog, Buttons), Motion (Animations).
- **Right:** live **Preview** of the selection, a **Knobs** strip, and a
  **Notes** block (written rationale — doubles as portfolio documentation).
- **Two knob tiers:**
  - *Component args* (ephemeral local state) — e.g. toggle the Title Bar's
    Shrink/Embiggen buttons or maximized state. Reset on reload; pure showcase.
  - *Theme tokens* (persistent) — color pickers that call `saveThemeSettings()`
    and `applyTheme()`, re-skinning the OS live.
- Runs both as an NS Doors 97 window (Start → Programs → Design; Taskbar
  `TOOLS_ITEMS`) and standalone via `DesignPage` (`StandaloneWindow`) at `/design`.

## Migration status

`theme.css` is the source of truth. The shared chrome CSS (`TitleBar`, `MenuBar`,
`StandaloneWindow`, `Tabs`, NS Doors 97 `Taskbar`/`OsDialog`) references the eight
themeable tokens via `var(--…)`. Remaining per-game CSS still uses hex literals in
places and migrates opportunistically — values are identical, so there is no
visual change; only the migrated surfaces re-skin live.

## Hosting note

`design.doors97.com` is mapped to the `/design` route at the DNS/host layer
(outside this repo). `/component-test` remains as a legacy alias of `/design`.
