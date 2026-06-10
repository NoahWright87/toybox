# Mahjong Solitaire — Current State

## Related

- [`spec.md`](spec.md)

## Overview

A Taipei/Shisen-Sho-style "turtle" Mahjong Solitaire. 144 tiles, drawn from a
traditional 36-design set, are stacked in a layered turtle-shaped layout.
Click two free tiles with matching faces to remove them. Clear all 144 tiles
to win. The board is always solvable from its initial deal — if no matching
free pairs remain, Shuffle reassigns the faces on the remaining tiles without
changing their positions.

## Routes

`/mahjong-solitaire` — standalone route wrapped in `StandaloneWindow`.
Also embedded as a window inside NS Doors 97 (Start → Games → Mahjong
Solitaire, or via `C:\Programs\Games\Mahjong Solitaire\Mahjong Solitaire.exe`).

## Source layout

- `src/experiences/MahjongSolitaire/tiles.ts` — `TileSuit`, `TileDesign`, the
  36-entry `TILE_DESIGNS` registry, `TILE_DESIGNS_BY_ID` lookup, and
  `buildTileDeck()` (144 unshuffled tile ids).
- `src/experiences/MahjongSolitaire/layout.ts` — half-cell coordinate system
  (`HALF_W`, `HALF_H`, `Z_OFFSET`), `generateTurtleLayout()` (144 `BoardSlot`s
  across 4 layers), `getBoardPixelSize()` and `getBoardOrigin()` for sizing
  and positioning the board container.
- `src/experiences/MahjongSolitaire/board.ts` — framework-free game logic:
  `isFree()`, `getFreeTiles()`, `getMatchablePairs()`,
  `generateSolvableBoard()`, `shuffleBoard()`, and the shared
  `assignSolvableIds()` helper.
- `src/experiences/MahjongSolitaire/mahjongAssets.ts` — `getTileAssetUrl()`,
  the FS asset-override resolver for tile faces.
- `src/experiences/MahjongSolitaire/MahjongSolitaire.tsx` + `.css` — the game
  component and Win95-styled HUD/board chrome.
- `public/mahjong-tiles/*.svg` — 36 bundled tile-face SVGs.
- `src/pages/MahjongSolitairePage.tsx` — `StandaloneWindow` wrapper for the
  `/mahjong-solitaire` route.

## Board & layout

The board uses a half-cell `(x, y, z)` coordinate system. Each tile occupies
a 2×2 half-unit footprint. The turtle layout is built from pre-computed
rectangles across 4 layers, totaling exactly 144 slots:

- **Layer 0** (z=0) — the main 12×8 body (96 slots) plus a 1×2 head
  protrusion on the left and a 1×2 tail protrusion on the right (2 slots
  each) = 100 slots.
- **Layer 1** (z=1) — an 8×4 block centered over the body = 32 slots.
- **Layer 2** (z=2) — a 4×2 block = 8 slots.
- **Layer 3** (z=3) — a 2×2 block at the peak = 4 slots.

Higher layers are rendered with a per-layer pixel offset (`Z_OFFSET`, applied
to both x and y) to create the visual stepped/layered look. `getBoardPixelSize()`
and `getBoardOrigin()` compute the bounding box of the whole layout so the
board container is sized and tiles are positioned relative to a common origin.

## Tile set

36 tile designs, each appearing 4 times in the 144-tile deck:

- **Dots 1–9** — pip-style circle layouts (blue ring, white fill, red center dot).
- **Bamboo 1–9** — green stalk-with-joint layouts; Bamboo 1 is a stylized bird
  glyph per tradition.
- **Characters 1–9** — a large black numeral with a small red abstract glyph
  beneath it.
- **Winds** — East, South, West, North: bold compass letters in a thin frame.
- **Dragons** — Red and Green dragons render as filled seal/stamp glyphs;
  White Dragon is a blank tile with a double-rectangle blue frame.
- **Flowers** — two filler designs (a purple 5-petal flower and an orange
  6-pointed star) used to round out the 36-design set.

## Free-tile rule

A tile is **free** (clickable) when:

1. **Nothing sits on top of it** — no non-removed tile occupies the layer
   directly above (`z + 1`) with an overlapping `(x, y)` footprint.
2. **At least one side is open** — its left side, its right side, or both,
   has no non-removed tile at the same layer or higher occupying the
   adjacent 2-half-unit-wide column.

Locked tiles (covered from above, or boxed in on both sides) are dimmed and
cannot be selected.

## Generation & solvability

A fresh board is built by **reverse construction**: starting from an empty
board, the algorithm repeatedly finds all currently-"placeable" slots (those
that would be free if filled in, given what's already placed), picks two at
random, and assigns them a shared design id from a shuffled 72-pair deck
(36 designs × 2 pairs = 144 tiles). Building backward this way guarantees at
least one full solve order exists — the exact reverse of the construction
order.

Random or greedy play, however, can reach states with no matching free
pairs even on a solvable board — this mirrors traditional Mahjong Solitaire
and is expected. **Shuffle** is the escape hatch: it collects the
currently-occupied slots and their design ids, then re-runs the same
reverse-construction assignment restricted to that subset, replacing face
assignments while leaving every tile's position and removed state unchanged.
There is no hard-loss state — the game is always completable via Shuffle.

## Controls

- **Click a free tile** — selects it (highlighted with an orange outline and
  a slight lift).
- **Click the same tile again** — deselects it.
- **Click a second free tile with the same face** — removes both tiles
  (+10 score) and clears the selection.
- **Click a free tile with a different face** — moves the selection to the
  new tile.
- **Hint** — highlights one currently-matchable free pair (pulsing yellow
  glow) for ~1.5 seconds. If no matchable pairs exist, shows a "No moves
  left — try Shuffle!" message instead.
- **Shuffle** — reassigns faces on the remaining tiles (see above) and
  clears any selection, hint, or message.
- **New Game** — deals a fresh, solvable 144-tile board and resets score,
  timer, and phase.

## Scoring & timer

- **+10 points** per matched pair removed.
- A timer (mm:ss) runs while `phase === "playing"` and stops on a win.
- On clearing all 144 tiles, a **time bonus** of `max(0, 1000 - elapsedSeconds * 2)`
  is added to the running score to produce the final score, shown in a win
  overlay.
- If the final score beats the stored high score, it's saved and the overlay
  shows "New High Score!".

## High score persistence

The high score is stored in `C:\Programs\Games\Mahjong Solitaire\SCORES.DAT`
(stable FS id `MJ_SCORES_ID`) as a plain integer string — the same pattern as
Typing Racer's `SCORES.DAT`. It's hackable: open the file in Notebook, edit
the number, and save to change the stored high score. The component reads
this file on mount via `fsStore.getFile(MJ_SCORES_ID)?.content` and writes a
new value via `fsStore.writeFile(MJ_SCORES_ID, String(score))` whenever a
win beats the previous high score.

## Asset overrides

Tile faces are resolved via `getTileAssetUrl(designId, defaultSvgPath)` in
`mahjongAssets.ts`, mirroring the Hellzone `assetOverride.ts` pattern:

- Checks `C:\Programs\Games\Mahjong Solitaire\TILES\{designId}.png` in the
  virtual filesystem.
- If that file exists with non-empty content (a data URL), it's used as the
  tile face — letting users repaint tiles in NS Art and see the change in
  game.
- Otherwise, falls back to the bundled `/mahjong-tiles/{designId}.svg`.

The `TILES\` folder is seeded with 36 empty `.png` stub files (one per
design id, `appId: "nsart"`) so each tile face appears in the file browser
and opens in NS Art for editing.

## Menus (Game)

| Item | Action |
|---|---|
| New Game | Deals a fresh, solvable board; resets score/timer |
| Hint | Highlights a matchable free pair, or shows a "try Shuffle" message |
| Shuffle | Reassigns faces on remaining tiles |
| Exit | Closes the window (only present when `onQuit` is provided) |
