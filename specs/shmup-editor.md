# Shmup Level & Enemy Editor

> Epic: **[Shmup Editor] Epic 6 #182**. This spec covers what's actually
> shipped; see `shmup-editor.todo.md` for what's still ahead (E2-E5 and
> the rest of E1).

## What it is

A standalone browser tool at **`/shmup-editor`** (a normal main-app React
route, wrapped in `StandaloneWindow` like MIDI Editor — not embedded in
an NS Doors 97 window yet) for authoring **tiles** for the shmup game's
data-driven level system. It is intentionally decoupled from
`games/shmup/`:

- **No shared code.** The editor's tile types and rotation/matching logic
  (`src/experiences/ShmupEditor/types.ts`, `orientation.ts`) are a fresh,
  self-contained implementation, not an import from
  `games/shmup/src/systems/levels/`. The editor's "tile" is a full-screen
  authoring unit; the game engine's internal tile rendering is a
  different, smaller-grained concept — only the exported JSON *shape*
  stays compatible with `levels-and-tiles.spec.todo.md`'s L1 data model,
  not the code.
- **No live connection.** The editor reads/writes its own tile library;
  nothing here talks to the `games/shmup` Phaser bundle. A later preview
  mode that launches the real engine is deferred (see todo).

## Data model

A tile (`TileDef`) has:
- `footprint`: 1, 2, or 3 (width in columns; height is always 1 row).
- `north`/`south`: one `EdgeSlot` (`{ tag, hardwall }`) per column of the
  footprint — a multi-column edge can mix hard-wall and open slots.
- `east`/`west`: a single `EdgeSlot` each (footprint height is always 1).
- `isConnector`: marks a start/end connector tile — toggling it forces
  every south slot's tag to the wildcard (`*`), matching any incoming edge.
- `weight`, `imageId`, `customImage`, `biome`, `name`: authoring metadata
  (weight is exported; the rest are editor-only, not part of the gameplay
  shape). `imageId` picks from a small built-in set (`tileImages.ts`:
  none/water/grass/shore) **or** the reserved `CUSTOM_IMAGE_ID`, which
  renders `customImage` instead — a per-tile uploaded image (see Custom
  art below). `biome` is a free string (or `null` for biome-agnostic,
  e.g. connector tiles) declaring which biome tile-set (L7 #189: water,
  dirt, woods, city, desert, ...) the tile belongs to; `biomeRegistry.ts`
  seeds a starting suggestion list, extendable via "+ New biome..."
  (`BiomeSelect.tsx`), same pattern as edge tags. `resolveTileImageUrl()`
  (`types.ts`) is the one place that knows how to turn `imageId`/
  `customImage` into an actual URL — `TileArt`/`TilePreview` both call it
  rather than reading `imageId` directly. Each image is one
  whole 1x1 tile's art, scaled to fill its square; a footprint > 1 tile
  renders one full copy per column (`TilePreview`'s `__cell` divs), not
  one image stretched or tiled as a small repeating pattern across the
  whole width.

Rotation: footprint-1 tiles get all 4 rotations x flip (8 orientations);
footprint 2/3 tiles only get 0°/180° x flip (4) — rotating a
wider-than-tall tile 90° would make it taller-than-wide, which this grid
can't represent. This mirrors the same resolution the game's L1 generator
uses for the same ambiguity in the source design doc. A tile is always
*authored* at identity orientation — rotation is a read-only verification
concept (see Connection tester below), not an editing mode, since editing
a rotated view would have to be mapped back onto the tile's stored
unrotated slots.

## Surfaces

Navigation between views (Tile List / New Tile / Connection Tester) is
via the **Tiles menu** in the window's menu bar (`useWindowMenus`) — no
duplicate on-screen nav buttons; the body just shows a plain heading for
whichever view is active.

- **Tile list** — every saved tile as a schematic card (edit/duplicate/delete).
- **Tile editor form** — the schematic diagram itself *is* the edge editor:
  each edge cell is a dropdown (`EdgeSelect`) offering Hard Wall, every tag
  already used anywhere in the library, and "+ New tag..." (reveals an
  inline text field). No separate fieldset of text inputs — the diagram is
  the only place edges are set, addressing an early usability pass where
  freeform text tags were a typo trap (`"dirt"` vs `"dirrt"` would silently
  never match) and the form duplicated the same information twice. Name,
  footprint picker, and connector toggle sit in a compact toolbar above
  the diagram; a background image picker (thumbnail buttons showing the
  actual texture), a biome picker, and weight below it. The diagram is
  always shown at identity orientation while editing (rotation is a
  read-only concept, see below). Save is disabled until every edge has a
  tag or Hard Wall.
  - **Custom art upload** (`imageUpload.ts`) — "Upload Custom Art..."
    opens a file picker; the chosen image is decoded, cover-fit cropped
    onto a 256x256 canvas, then **quantized to a limited palette and
    stored as a genuine indexed-color PNG** — not truecolor PNG or JPEG.
    A "Colors" dropdown next to the upload button (256/128/64/32/16/8,
    default 32) picks the palette size before uploading; fewer colors
    means a smaller saved file, which matters for flat tile/sprite art the
    same way it did in Photoshop's old "Indexed Color" mode.
    `utils/paletteQuantize.ts` runs median-cut quantization down to that
    many colors, then Floyd-Steinberg dithers *against the resulting fixed
    palette* (not per-channel posterization like `NsDoors97/imageDegrade.ts`'s
    wallpaper effect — diffusing error toward arbitrary RGB values can
    produce more distinct colors than fit in a palette; dithering against
    a fixed palette is also how real 256-color VGA/GIF art faked extra
    colors). `utils/indexedPng.ts` then hand-writes the actual PNG bytes
    (`IHDR`/`PLTE`/optional `tRNS`/`IDAT`/`IEND`, each with a CRC32) since
    Canvas's own `toDataURL`/`toBlob` can only emit truecolor PNGs — no
    browser API produces an indexed/paletted one. `IDAT`'s DEFLATE
    compression uses the browser's built-in `CompressionStream("deflate")`
    rather than a hand-rolled DEFLATE implementation. Both `paletteQuantize.ts`
    and `indexedPng.ts` live in `src/utils/` (not `ShmupEditor/`) so NS Art's
    planned palette-size feature (`specs/ns-art.todo.md` issue #82) and the
    wallpaper degrade pipeline can adopt the same primitives later without
    rework. The downscale-before-encode step still matters independent of
    the format: the tile library round-trips through `fsStore`'s
    `LocalStorageAdapter`, which caps out around 5-10MB total.
    Uploading sets `imageId` to the reserved `CUSTOM_IMAGE_ID` and adds a
    live thumbnail of the upload to the picker row (selectable like any
    built-in, so switching back to a built-in and back to the custom
    upload doesn't require re-uploading); "Remove Custom Art" clears it
    and falls back to `none` if it was the active selection. Real
    in-editor sketching (vs. upload of existing art) is still deferred.
  - **Biome picker** (`BiomeSelect.tsx` + `biomeRegistry.ts`) — same "+
    New..." registry pattern as edge tags (`KNOWN_BIOMES` seeds water/
    dirt/woods/city/desert per L7 #189's examples, extended by whatever's
    already used across the library or registered this session). Biome
    is not required — leaving it "— Agnostic —" (`null`) is the correct
    choice for start/end connector tiles, which the L7 spec says are
    biome-agnostic or carry biome-flavored art variants but never gate on
    biome logically. A tile's biome shows as a badge on both the edit
    diagram and the read-only tile-list schematic.
  - **"+ New tag..." commits on blur, not just Enter.** Mobile virtual
    keyboards (Android Chrome/Gboard in particular) don't reliably fire a
    clean `keydown` "Enter", so relying on `onKeyDown` alone silently
    discarded whatever was typed the instant the field lost focus. Both
    Enter and blur now run the same commit path; Escape explicitly clears
    the draft first so a blur it triggers can't accidentally commit.
  - **East/west edges render sideways** (`writing-mode: vertical-rl`, not
    `transform: rotate` — rotating a select wide enough to read once
    rotated overflowed its flex-centered cell and rotated around a
    badly-offset center) so the full tag text is legible in a narrow
    column instead of being clipped to a sliver showing only the dropdown
    arrow. Applies to both the editable dropdown and the read-only label
    (tile list / connection tester).
- **Mobile-first sizing** — the edit-form diagram's column width is
  `min(78vw, 420px)` (a dedicated `size="edit"` `TilePreview` variant,
  distinct from the compact `"small"` variant used by the tile list), so a
  1x1 tile fills most of a phone screen's width and a 2x1/3x1 tile is
  genuinely wider — not the same box subdivided into thinner slices — and
  overflows into horizontal scroll *contained to the diagram itself* on
  small screens. Getting that containment right required `min-width: 0`/
  `align-self: stretch` along the flex chain up to `StandaloneWindow`'s
  content area (which centers its child via `align-items: center`, sizing
  it to content by default) — without that, the wide diagram pulled the
  whole window wider instead of scrolling internally.
- **Tag registry** (`tagRegistry.ts`) — the dropdown's tag list is every
  distinct tag already used across the saved library, plus any tags
  registered via "+ New tag..." this session but not yet attached to a
  saved tile (kept in `ShmupEditor`'s `extraTags` state so they're
  immediately available to every other edge dropdown without a save
  round-trip first).
- **Connection tester** — a vertical **stack builder**, not a two-tile
  comparison form. Starts empty with a single "+ Add Tile" button; picking
  a tile from the popup grid prepends it to the top of the stack (index 0
  = top = most recently added; last index = bottom = oldest). Each stacked
  tile shows only its **art** (`TileArt.tsx` — no edge-tag labels, "just
  show the whole tile" per design feedback) with three controls to its
  left: 🔁/🔄 cycle through that tile's valid rotations, 🔀 toggles flip,
  ✕ removes it from the stack. Between every adjacent pair a ✅/❌ marker
  shows whether they'd actually attach.
  - **Adjacency direction, fixed from an earlier version**: the tile drawn
    lower on screen is "older" (attached-to) and the one above it is
    "newer" (attaching via its south edge to the lower tile's north edge)
    — generation grows north/upward, so a newly-placed tile's south is
    what touches the frontier below it. `connects(lower, upper)` checks
    `lower`'s north against `upper`'s south at offset 0. The original
    two-picker design compared each tile's own north against the *other*
    tile's south — i.e. the two tiles' outer, never-touching edges — which
    read as backwards because it was: the edges that are actually drawn
    touching on screen were never the ones being tested.
  - Rotating/flipping in this view is **visual, not just data**: `TileArt`
    applies `transform: scaleX(±1) rotate(...)` to the whole row of
    columns (not per-cell), which both mirrors each column's art and
    reverses column order in one transform — matching `orientation.ts`'s
    data-level column-reversal exactly, so what you see is what actually
    gets tested.

## Persistence

Per root `CLAUDE.md`'s mandatory rule, the tile library is **fsStore-backed**,
not localStorage: `C:\Programs\Accessories\Shmup Editor\TILES.DAT` holds
the whole library as a versioned JSON array (`{ version, tiles }`), loaded/
saved via `src/experiences/ShmupEditor/tileStore.ts`. A corrupt or
stale-shape save falls back to an empty library rather than crashing
(same defensive-load pattern as `MahjongSolitaire`'s save state).
Purely-additive optional fields (`customImage`, `biome`) don't bump
`SAVE_VERSION` — a pre-existing save missing them is still valid and gets
backfilled to their default (`null`) on load, rather than the whole
library being discarded for a one-field gap. The
folder + file are seeded for new installs (`filesystem/seed.ts`) and
backfilled for existing sessions (`FileSystemStore.ts`'s `migrate()`).

There is currently no `.exe`/Doors-97-window entry for this tool — it's
reachable only via the `/shmup-editor` route. The FS folder exists purely
so `TILES.DAT` is hackable/discoverable in the file browser.

## Related

- [`shmup-editor.todo.md`](shmup-editor.todo.md) — remaining work (E1's
  art import, E2-E5)
- [`games/shmup/levels-and-tiles.spec.todo.md`](games/shmup/levels-and-tiles.spec.todo.md) — the data model this editor's export shape matches
- [`ns-doors-97.md`](ns-doors-97.md) — the filesystem this tool persists through
