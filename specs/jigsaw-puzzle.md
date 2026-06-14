# Jigsaw Puzzle — Current State

## Overview

A freeform drag-and-snap jigsaw puzzle. Pieces are cut from a chosen image
using classic interlocking tab/socket edges, scattered across a scrollable
workspace, and dragged into a frame outline (with a faint ghost preview of
the full image) to reassemble the picture. Optional timer with per-image,
per-difficulty best times.

## Routes

`/jigsaw-puzzle` — standalone route wrapped in `StandaloneWindow`. Also
embedded as a window inside NS Doors 97 (Start → Games → Jigsaw Puzzle, or
via `C:\Programs\Games\Jigsaw Puzzle\Jigsaw Puzzle.exe`).

## Source layout

- `src/experiences/JigsawPuzzle/pieceShapes.ts` — seeded PRNG
  (`mulberry32`), `edgeSegment()` bezier tab/socket edge drawing, and
  `generatePieceLayout()` which produces a deterministic `PieceLayout`
  (per-piece SVG path data, uniform piece bounding box, `bumpAmp`) from
  `rows`, `cols`, `cellW`/`cellH`, and a `seed`.
- `src/experiences/JigsawPuzzle/puzzleImages.ts` — the wallpaper-derived
  puzzle image presets (Desert Arch, Sunset), reusing the full-resolution
  originals and degraded thumbnails from `NsDoors97/wallpapers/`.
- `src/experiences/JigsawPuzzle/types.ts` — `Difficulty`, piece-count
  targets, cell sizes, `JigsawConfig`, `bestTimeKey()`, `formatTime()`.
- `src/experiences/JigsawPuzzle/JigsawSettings.tsx` — the "New Puzzle"
  settings screen (image picker, difficulty, Timed toggle, best time).
- `src/experiences/JigsawPuzzle/JigsawPuzzle.tsx` + `.css` — the main game
  component, workspace, piece rendering, drag/snap logic, HUD, win overlay.
- `src/utils/imageResize.ts` — shared canvas-based image resize utility
  (`resizeImageToDataUrl`, `getImageDimensions`), used for custom photo
  uploads. Deliberately does **not** apply the wallpaper "1997 dithering"
  from `NsDoors97/imageDegrade.ts` — that's a wallpaper-specific aesthetic.
- `src/pages/JigsawPuzzlePage.tsx` — `StandaloneWindow` wrapper for the
  `/jigsaw-puzzle` route.

## Settings screen ("New Puzzle")

Shown whenever the window/page is opened, and whenever **Game → New
Puzzle...** is chosen mid-game. Lets the player pick:

- **Image** — Desert Arch or Sunset wallpaper presets, or **Upload...** a
  photo (resized client-side via `resizeImageToDataUrl`, max dimension
  1024px, JPEG). The uploaded image is stored at the stable FS id
  `JP_IMAGE_ID` (`C:\Programs\Games\Jigsaw Puzzle\IMAGE.DAT`) so it persists
  and is reused if the player returns to "Your Photo" later.
- **Difficulty** — Easy (~12 pieces), Medium (~48 pieces), Hard (~108
  pieces). Each difficulty has a fixed piece cell size (72px / 58px / 46px);
  the actual grid (`rows` × `cols`) is computed from the target piece count
  and the image's aspect ratio.
- **Timed** — checkbox. When enabled, a running mm:ss timer is shown and
  completion times are tracked per image/difficulty combination. The best
  time for the currently-selected image+difficulty (if any) is shown next to
  the checkbox.

## Piece shapes

`generatePieceLayout(rows, cols, cellW, cellH, seed)` builds one SVG path per
piece:

- A shared `bumpAmp = round(min(cellW, cellH) * 0.22)` tab/socket bulge size.
- Internal horizontal and vertical edges are assigned a random sign
  (tab/socket) once; each piece's four edges read the sign from its shared
  border with the neighboring piece (inverted on the piece "below"/"right"
  side vs "above"/"left" side) so adjacent pieces always interlock exactly.
- Edges on the outer border of the grid are straight (no bump).
- Every piece shares the same bounding box (`pieceBoxW`/`pieceBoxH` =
  `cell + 2*bumpAmp`), simplifying absolute positioning.

Each piece is rendered as an `<svg>` with a `<clipPath>` containing its path,
clipping a single full-image `<image>` positioned by a per-piece offset so
the correct region of the puzzle image shows through — i.e. every piece SVG
contains the whole image but only its own clipped region is visible.

## Workspace & interaction

- The workspace is a scrollable, fixed-size pane (sunken Win95 bevel, dark
  green background) sized larger than the assembled puzzle so pieces can be
  scattered around the frame.
- A dashed **frame** outline marks where the assembled puzzle belongs,
  containing a faint (`opacity: 0.18`) full-image ghost preview.
- On a new puzzle, pieces are scattered to random positions within the
  workspace with ascending z-indices.
- **Drag** — pointer events (`setPointerCapture`) update a piece's `x`/`y`,
  clamped to the workspace bounds, and bring the dragged piece to the front.
- **Drop / snap** — on release, if the piece's position is within
  `SNAP_THRESHOLD` (18px) of its correct position (`frameX/Y + col/row * cell
  - bumpAmp`), it snaps exactly into place, becomes `locked` (no longer
  draggable, drop shadow removed), and is sent to the back (`z = 0`).
- When every piece is locked, the puzzle is won.

## HUD

- **Pieces** — `locked / total` count.
- **Time** — mm:ss, shown only when Timed is enabled; increments once per
  second while playing.
- **New Puzzle** button — returns to the settings screen (same as the Game
  menu item).

## Win overlay

On completion: shows total time (if timed), "New Best Time!" if the
completion beat the stored best for this image+difficulty, and a "New
Puzzle" button to return to settings.

## Menus (Game)

| Item | Action |
|---|---|
| New Puzzle... | Clears the in-progress save and returns to the settings screen |
| Exit | Closes the window (only present when `onQuit` is provided) |

## Persistence

All state lives in the virtual filesystem under
`C:\Programs\Games\Jigsaw Puzzle\`:

- **`SCORES.DAT`** (`JP_SCORES_ID`) — JSON map of `bestTimeKey(imageSource,
  difficulty) -> seconds`, e.g. `{"arch:medium": 184, "custom:hard": 502}`.
  Hackable in Notebook like other SCORES.DAT files.
- **`SAVE.DAT`** (`JP_STATE_ID`) — in-progress session: `version`, `config`,
  grid size, `seed`, workspace/frame geometry, every piece's position and
  lock state, `elapsedSec`, and `savedAt`. Loaded on mount; if it validates
  (matching version and piece count), the game resumes directly into
  `phase: "playing"` instead of showing the settings screen, with idle time
  since `savedAt` added to `elapsedSec`. Cleared on win or when returning to
  settings.
- **`IMAGE.DAT`** (`JP_IMAGE_ID`) — the most recently uploaded custom photo,
  as a data URL, reused across sessions for the "Your Photo" option.

Per the project's filesystem conventions, these are seeded in `seed.ts` for
new installs and created via `migrate()` for existing sessions.
