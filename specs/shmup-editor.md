# Shmup Level & Enemy Editor

> Epic: **[Shmup Editor] Epic 6 #182**. This spec covers what's actually
> shipped; see `shmup-editor.todo.md` for what's still ahead (E4-E5, the
> rest of E1, and E2/E3's deferred per-param scaling-curve retrofit).

## What it is

A browser tool for authoring **tiles** for the shmup game's data-driven
level system, reachable two ways: the standalone `/shmup-editor` route (a
normal main-app React route, wrapped in `StandaloneWindow` like MIDI
Editor) and, as of 2026-07-25, an NS Doors 97 window (Start Menu > **Game
Dev** > Shmup Editor, or `C:\Programs\Accessories\Shmup Editor\Shmup
Editor.exe` from the file browser — `NsDoors97.tsx`'s `"shmup-editor"`
window type). Both paths render the same `ShmupEditor.tsx`, which already
registered its own Help menu via `useWindowMenus` in anticipation of
Doors 97 hosting before that hosting existed. It is intentionally
decoupled from `games/shmup/`:

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
- `weight`, `imageId`, `customImage`, `name`: authoring metadata
  (weight is exported; the rest are editor-only, not part of the gameplay
  shape). `imageId` picks from a built-in set (`tileImages.ts` — plain
  biomes water/grass/sand/swamp/lava/rocky/concrete/forest, a set of
  biome-transition and road tiles, and a diagonal corner piece) **or**
  the reserved `CUSTOM_IMAGE_ID`, which renders `customImage` instead —
  a per-tile uploaded image (see Custom art below). `resolveTileImageUrl()`
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
concept (see Connection Viewer below), not an editing mode, since editing
a rotated view would have to be mapped back onto the tile's stored
unrotated slots.

## Surfaces

Navigation between the three browse-level views is a **tab strip inside the
window** (`LibraryBrowser.tsx`): **Tiles**, **Units**, and **Preview** (which
holds the Connection Viewer and Tag Graph). The menu bar keeps the same entries
— plus Help and Reset — but is no longer the only route. It used to be: switching
between the tile and unit libraries meant opening a Win95 menu and picking an
item, two taps with the first on a 35x17px target, for something you do
constantly. Per Noah: "units and tiles are like two major tabs, and maybe
preview would be a third tab?"

**The tabs, the active tab's filter, and Create are pinned above a scrolling
grid** — the same height-lock the encounter editor uses (`.shmup-enc-fill`;
both share the `:has()` chain), so they stay reachable however far down a long
library you scroll. Each tab carries:

- a **filter dropdown**, defaulting to "Show All" — **tags** for Tiles (an edge
  tag is per-slot free text, so a tile "has" a tag if any of its four edges
  carries it, which makes the filter read as "show me everything that borders
  water"), and **layer** (Ground/Air/Doodad) for Units;
- a chunky **Create** button, replacing the menu bar's "New Tile..."/"New
  Unit..." as the obvious way in.

The standalone window is shrink-to-fit by default, which left the browse grid
about two columns wide on a desktop viewport; it gets a real width
(`min(1000px, 100%)`) when a library is showing.

- **Tile list — a visual checker, not a metadata card grid.** Tiles
  render as pure art (`TileArt`, no schematic/edge-tag labels — that's
  `TilePreview`'s job, and it's only used by the edit form now), tiled
  **edge-to-edge with no gap** in a CSS grid, each tile spanning its real
  footprint width so a 2x1 tile is visibly twice as wide as a neighboring
  1x1 — the point is judging how tiles' art reads *next to each other*,
  which matters a lot when the art comes from an AI image generator that
  has no idea what tile sits next to it.

  **The whole cell is the open-this button, and cells are 88px** (up from 56px).
  Opening a tile used to mean hitting an 18x14px "⋮" in its corner and then
  picking "Edit" from the menu that opened — two taps, the first on a target
  well under half the size guidance, for the thing you almost always want.
  **Duplicate and Delete moved into the tile/Unit editor**, which is where you
  already are when you decide you want them and which has room for them at a
  sane size; Delete arms with a Confirm/Keep step there, as it did in the old
  menu. Both invoke from *inside* the editor now, so Delete also closes it
  (otherwise you'd be left editing something that no longer exists) and
  Duplicate opens the copy — silently appending to a library you can't
  currently see is no feedback at all. A name caption sits along the bottom of
  each cell, since the old grid put the name in a `title` tooltip, which does
  not exist on touch.
- **Tile editor form** — the schematic diagram itself *is* the edge editor:
  each edge cell is a dropdown (`EdgeSelect`) offering Hard Wall, every tag
  already used anywhere in the library, and "+ New tag..." (reveals an
  inline text field). No separate fieldset of text inputs — the diagram is
  the only place edges are set, addressing an early usability pass where
  freeform text tags were a typo trap (`"dirt"` vs `"dirrt"` would silently
  never match) and the form duplicated the same information twice. Name,
  footprint picker, and connector toggle sit in a compact toolbar above
  the diagram; a background image picker (thumbnail buttons showing the
  actual texture) and weight below it. The diagram is
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
    and falls back to `none` if it was the active selection. In-editor
    sketching from scratch is out of scope, on purpose — that was never an
    actual requirement (it crept into an earlier revision of the TODOs
    without a real ask behind it), and NS Art already covers freehand image
    creation; upload is this tool's only intended art-input path.
  - **No biome field, on purpose.** An earlier revision of this tool had
    a per-tile `biome` field (`BiomeSelect.tsx`/`biomeRegistry.ts`,
    removed) that let a tile declare which biome tile-set it belonged to.
    It was dropped: biome turned out to be entirely emergent from ordinary
    edge tags (see `specs/games/shmup/levels-and-tiles.spec.todo.md` §5)
    — a tile with `grass-road` on one edge and `desert-road` on another
    *is* a grass/desert bridge, with nothing else needed to express that,
    and a dedicated field couldn't represent that tile any better than
    "which one biome is it" would suggest. Rarity and which biomes border
    which fall out of the tag graph's shape (how many tiles bridge two
    tags) rather than being configured anywhere.
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
    arrow. Applies to both the editable dropdown and `TilePreview`'s
    read-only label (currently unused outside the edit form, but kept
    correct since nothing rules out a future schematic view needing it).
- **Mobile-first sizing** — the edit-form diagram's column width is
  `min(78vw, 420px)`. `TilePreview` only ever renders this one way now (its
  earlier compact `"small"` variant, once used by the tile list, was
  removed as dead code once the tile list became the pure-art visual
  checker grid described above), so a 1x1 tile fills most of a phone
  screen's width and a 2x1/3x1 tile is
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
- **Connection Viewer** (`ConnectionViewer.tsx` + `connectionGrid.ts`) — a
  **2D grid builder**, and deliberately a *visual flow-checker rather than
  a pass/fail test*: tiles render at large size, literally adjacent
  (**~1px** between them — enough to see two tiles are two tiles, not
  enough to hide a seam that doesn't actually line up), because with
  AI-generated tile art the open question isn't whether tags match (the
  tag-dropdown system already guarantees that) but whether two
  tag-compatible tiles' *art* actually reads well pressed together. No
  heading, no explanatory hint text, no tile names — the window's title
  bar carries "Connection Viewer" instead (`useWindowTitle`, see below),
  and every other pixel goes to the art itself.
  - **Placement model** (`connectionGrid.ts`): each placed tile is a
    `GridEntry` with a real `(row, col)` — row grows south/down, col grows
    east/right, `col` is the leftmost occupied column. Tile height is
    always exactly 1 row (per the data model), so footprint only ever
    spans columns. Occupancy is tracked in a `Map<"row,col", GridEntry>`
    for O(1) collision checks. Growth can start from **any open
    (non-hardwall, unoccupied) edge of any placed tile** — not just the
    top/bottom of a single vertical line — so the grid can extend in all
    four directions from wherever it currently has open edges. Branch
    merging (two independently-grown arms reaching for the same cell) is
    explicitly deferred — a placement is simply never offered onto an
    already-occupied cell, with no "snap the two arms together" behavior.
  - **Empty state**: a single "+ Add" button, nothing else. Picking any
    tile places it at identity orientation with no constraint (nothing to
    attach to yet).
  - **Add points are per open *column*, not per whole side**
    (`computeAddPoints`): north/south each get one add point per open
    (non-hardwall, unoccupied) column — even several open columns sitting
    side by side with no hard-wall between them still each get their own
    button, since each column of a multi-column edge can carry a
    completely different tag and independently needs its own matched
    candidate list (a merged "one button per contiguous run" design was
    tried first, but it meant a 2-wide tile's north edge showed only one
    button even though its two columns could want two unrelated
    neighbors — see below for why that also required closing a matching
    gap between the two now-independent placements). East/west each get
    at most one add point (footprint is width-only, so there's never more
    than one column to grow from on those sides). Each button shows a
    directional arrow (↑↓→←, `ADD_ARROW`) rather than a flat "+", since
    several buttons can appear around one tile at once and the direction
    needs to be legible at a glance.
  - **A candidate must connect to every entry it would touch, not just
    the add-point's own anchor** (`candidatesForAddPoint`): once add
    points are per-column, placing a tile at one column's point can land
    it directly beside a tile already placed at a neighboring column's
    point — that pair needs to match too. Every candidate placement is
    re-checked against every other currently-placed entry it would
    physically touch (`isAdjacent` + `coordsConnect`, the same pairwise
    check `orientationValidAt` uses for rotate/flip), not just the anchor
    the button is attached to — closing a gap where two tiles could each
    individually match a wide anchor's south edge while silently
    mismatching each other's shared east/west edge.
  - **Candidates only offer the first connecting orientation per tile**
    (`candidatesForAddPoint`), not every permutation — rotate/flip after
    placing covers the rest, so the picker doesn't show the same
    near-symmetric tile 4-8 times over. North/south candidates reuse
    `orientation.ts`'s `findAlignments(above, below)`, which returns every
    valid column *offset*, not just offset-0: a narrower or wider tile is
    positioned at its true matching column (shifted left/right as needed)
    rather than naively centered on the anchor. East/west have no offset
    ambiguity — footprint is width-only, so a horizontal neighbor is a
    simple single-edge tag match placed immediately adjacent.
  - **Tap a tile to reveal its controls, overlaid directly on the tile**
    (not a side column, so tiles can render much larger): ✕ delete at top,
    🔄/🔁 rotate at left/right, 🔀 flip at bottom. Only one tile's controls
    show at a time; tapping a different tile switches directly, tapping
    anywhere outside the grid (or outside the open add picker) closes it —
    checked via `Element.closest()` against the relevant class names
    rather than a single container ref, so empty grid space also counts as
    "outside." **Invalid options render disabled/greyed** rather than
    being hidden — `orientationValidAt()` checks a hypothetical
    rotation/flip against *every* entry currently touching that tile on
    any of its 4 sides (`touchingEntries`) before allowing it, so a
    control that would break an existing connection is simply inert.
    **Delete only enables on a leaf** — `canDeleteEntry()` allows removal
    only when the tile has 0 or 1 current neighbors; a tile with 2+
    neighbors stays non-deletable, since removing it could split the grid
    into disconnected pieces with no established way to display that
    split (the direct 2D generalization of the earlier 1D "only the two
    ends of the strip" rule).
  - **No connection checkmark.** An earlier version kept a ✅/❌ marker
    between every pair as a safety net for rotating a placed tile into an
    invalid state; that's no longer reachable now that invalid rotate/flip
    options are disabled outright, so the marker was dropped — it cost
    vertical space for a state that can't occur.
  - Rotating/flipping is **visual, not just data**: `TileArt` applies
    `transform: scaleX(±1) rotate(...)` to the whole row of columns (not
    per-cell), which both mirrors each column's art and reverses column
    order in one transform — matching `orientation.ts`'s data-level
    column-reversal exactly, so what you see is what actually gets tested.
  - **Layout**: a CSS Grid (`.shmup-connection-viewer__grid`) with entries
    and add-point buttons positioned via inline `gridRow`/
    `gridColumn: 'start / span N'`, normalized against the current
    min row/col so entries with negative coordinates (growth north/west of
    the first tile) still map to valid (positive) CSS grid lines. A shared
    `--shmup-connection-grid-unit` custom property sizes both the grid
    cells and `TileArt`'s own cells from one source of truth.
    **Per-track sizing, not a blanket `grid-auto-rows`/`-columns`**:
    `ConnectionViewer.tsx` computes explicit `gridTemplateRows`/
    `gridTemplateColumns` arrays — only a row/column that actually holds a
    placed entry gets the full tile-unit size; a row/column that only
    holds an add-point button or the open picker sizes to its own content
    instead. Applying the unit size uniformly to every implicit track
    (including add-only ones) made every "+ Add" button and the picker
    itself render inside a giant tile-sized empty cell on a phone-width
    viewport. **The grid is wrapped in a `.shmup-connection-viewer__scroll`
    container and centered via `width: max-content; margin: 0 auto` on the
    grid itself**, not `justify-content: center` on the scrollable
    container directly — the latter centers overflowing content
    symmetrically, but a scrollable ancestor can only reach the *right*
    side of that overflow (`scrollLeft` can't go negative), permanently
    stranding part of a wide tile off-screen to the left with no way to
    scroll to it (including, in practice, the delete button of a wide leaf
    tile sitting at the tile's horizontal center). `margin: auto` on a
    `width: max-content` child collapses to 0 once the child is wider than
    its parent, so overflowing content sits flush left and is fully
    reachable by scrolling right instead.
- **Tag Graph** (`TagGraph.tsx` + `tagGraph.ts`) — answers "what does my
  whole library's connectivity look like," a different question than the
  Connection Viewer's "does this one strip I built work." Since biome is
  purely emergent from edge tags (Data model note above), this is also
  the tool for seeing biome clusters, rare bridge tiles, and accidental
  dead ends, rather than anything biome-specific existing in the data
  model to inspect.
  - **Nodes are tags, not tiles** — literally "the edges of a tile become
    the edges of the graph": for every tile, every distinct pair of real
    tags it carries anywhere (north/south/east/west, hardwall and
    wildcard excluded) forms one graph edge, so a tile with `grass-road`
    on one side and `desert-road` on another shows up as a single edge
    directly connecting the `grass-road` and `desert-road` nodes.
  - **Node size = tile count carrying that tag; edge thickness = tile
    count carrying both tags** — common tags/pairs read as visually
    bigger/thicker, rare ones as small outliers, with no separate rarity
    system to configure; it falls out of `tagGraph.ts`'s `buildTagGraph()`
    directly from the library's actual content.
  - **Hand-rolled force-directed layout** (`tagGraph.ts`'s
    `stepSimulation()` — plain repel-every-pair-of-nodes + spring-along-
    edges + damping + a mild centering pull, no graph library), styled
    like Obsidian's graph view. Positions persist across library edits
    (`preservePositions()` carries over any tag that still exists rather
    than re-seeding the whole layout), so the view doesn't jump around
    every time a tile is saved.
  - **Click a node or edge to see its tiles**, rendered as the same small
    `TileArt` thumbnail grid the Connection Viewer's picker uses; clicking
    a tile there opens it directly in the tile editor (`onEditTile`,
    threaded down from `ShmupEditor`'s `handleEditTile` — the same
    function the tile list's "Edit" already used). Dragging a node pins
    it to the pointer (excluded from physics that tick) and lets it go on
    release rather than requiring a separate "lock" mode.

## Unit + Encounter editor (E2)

**Revised six times.** The first pass put a full movement/dwell/attack
node-graph directly on the enemy definition, matching
[`enemies-and-bullets.spec.todo.md`](games/shmup/enemies-and-bullets.spec.todo.md)'s
literal wording ("an enemy is a node graph"). That didn't match the
intended content-authoring model, so it was corrected to enemy-is-stats-
only with the graph moved onto the encounter (`EnemyDef` + `EncounterEnemy`
owning a node/edge graph). A second design pass (informed by an external
design-handoff doc, 2026-07) went further: **enemies were renamed Units**,
each owning a reusable **buffet of named Actions** authored once, and
encounters stopped being a node/edge graph entirely — an encounter now
places units along a **flat ordered list of steps**, each step just
referencing one of the unit's Actions by id. A third pass added the
**timeline scrubber** and, with a real timeline to preview against, cut the
step-level `Trigger` system entirely in favor of a plain numeric `time` —
see "Timing" below. A fourth pass replaced per-Action movement kinds
(straightLine/wave/spiral) with a single **bezier curve** per segment,
driven by two plain Unit stats instead of an Action-level choice — see
"Movement" below. A fifth pass cut Actions entirely (`EncounterStep`
carried a plain `visible: boolean`, no Action buffet anywhere). **A sixth
pass reversed that cut — Actions are back**, following a fresh reconciliation
against an updated design-handoff doc (v3, 2026-07-18) and real usage of
the shipped Action-less editor: Noah's call, after building with it for a
while, was that a plain step/attack model was missing too much (reusable
named behaviors, facing/rotation, a reason for a bullet to be more than a
straight line) to be worth avoiding the indirection. See git history for
all six earlier shapes if useful; this section describes the current
(sixth-pass) shape only.

**The Action that came back is not the one that got cut.** The original
`ActionDef` only ever bundled an inert `animationState` and a `visible`
flag — genuinely not worth a buffet. The current `ActionDef`
(`unitTypes.ts`) is a fused, reusable bundle of **movement speed% +
facing + an invincibility toggle + an optional attack**, authored once per
Unit/Part and referenced by an encounter's steps (the base Unit) or
Part-action placements (a Part). It replaces both the old plain
`EncounterStep.visible`/`speedMultiplier` fields *and* the standalone
`WeaponDef` class in one indirection — see "Attacks" below for why folding
Weapon into Action costs nothing (Weapons were never actually shared
across Units or even across a Unit's own Parts).

The mental model: **a Unit has a layer, two movement stats (speed/
minSpeed/turnRateDegPerSec), and its own reusable Action buffet — used directly when it has
no Parts, and always governing its own movement/facing/state regardless
of how many Parts it has — plus a set of Parts, each owning its own
independent Action buffet; an encounter places Units and walks each one
along a curved path through an ordered list of steps (each referencing one
of the Unit's own Actions) while independently placing Action events on
each Part's own timeline track.**

- A **Unit** (`UnitDef`, `unitTypes.ts`) is a sprite + stats (HP, contact
  damage, score value, `speed`, `minSpeed`, `turnRateDegPerSec`, hitbox
  size) + a **`layer`**
  (`"ground" | "air" | "doodad"`, see "Layers" below) + a
  **`defaultActionId`** (see below) + its own reusable **`actions:
  ActionDef[]`** buffet + `parts: UnitPart[]`, authored once and
  referenced (not re-authored) from any encounter placement. A small
  **Units** menu (alongside **Tiles**) manages the library via
  `UnitStatsForm.tsx` (a Stats page, a Visuals page, an Actions section,
  then a Parts section — list + New/Edit/Delete, mirroring the tile
  editor's Encounters section); `UnitList.tsx` is the same visual-checker
  sprite grid as the tile list.
- A **`UnitPart`** (`unitTypes.ts`) is `{id, name, offset, spriteId,
  customSprite, hasHitbox, hasHealth, hp, damageMultiplier, actions:
  ActionDef[]}` — see "Attacks" below for the Action model and "Per-Part
  hitboxes" below for the hitbox fields. Every Unit is seeded with one
  default "Main" part, so the common single-Action-system case needs no
  extra authoring.
- An **`ActionDef`** (`unitTypes.ts`) is `{id, name, movementPercent,
  facing, fixedFacingDeg, setsInvincible, requiresInvincible, attack}`.
  `movementPercent` (0-100) is a percent of the *owning Unit's* fixed
  `speed` — 0 is a dwell; `speed` itself is never touched by difficulty
  scaling, only how much of it an Action uses (see "Movement" below).
  `facing` (`"fixed" | "faceMovement" | "facePlayer"`) subsumes what used
  to be a separate weapon aim mode — see "Attacks" below. `setsInvincible`
  (`boolean | null`) and `requiresInvincible` are the state-toggle half —
  see "Invincibility" below. `attack` (`ActionAttack | null`) is the
  optional fire-something half — see "Attacks" below. The same Action can
  be referenced by any number of steps/placements; cloning (authoring UI,
  not a data concept) is how you'd author a byte-similar variant rather
  than a second, disconnected class.
- An **encounter** (`EncounterDef`, `encounterTypes.ts`) still belongs to
  one specific tile (`TileDef.encounters`) and is still authored **inside
  the tile editor** (Encounters section on `TileEditorForm.tsx`,
  New/Edit/Delete, switching to a dedicated `EncounterEditor.tsx` view and
  back). Each **`EncounterUnit`** instance references a `UnitDef` by id and
  owns both a `steps: EncounterStep[]` movement track and a
  `partActions: PartActionPlacement[]` set of Part-track placements —
  plain arrays, not a graph. Each `EncounterStep` is `{ id, pos, actionId,
  time, handleIn?, handleOut? }`: a position on the canvas, which of the
  Unit's own Actions governs the segment leaving it (`null` = no Action
  chosen yet — inert, holds position), a `time` (see "Timing" below)
  saying when, and bezier handles shaping the curve on either side (see
  "Movement" below). The same "Skull Buggy" Unit can be walked through a
  sharply-curving step sequence in one tile's encounter and a single
  stationary step in another's — path shape (and which Actions are
  referenced) belongs to the placement, not the Unit's identity; only
  *speed*/*minSpeed*/*turnRateDegPerSec* and the Action buffet itself
  travel with the Unit.

**Layers** (`UnitLayer`, `unitTypes.ts`) — `"ground" | "air" | "doodad"` —
are a fixed property of the Unit definition itself, chosen once when
authoring the Unit, not of any one encounter placement: "Layer is a Unit
definition. In the editor, when adding a Unit you choose which layer
you're adding to and it shows you the available Units for that layer"
(Noah). Layer also decides which **reference frame** an instance is
authored and previewed in — see "Authoring frames: Ground vs Air" below.
What the game does with layers when picking which Encounters combine on a
tile spawn (10 ground x 10 air = 100 possible combinations, some spawning
together, some filled independently) is still entirely a runtime concern
this editor doesn't need to know about.

**`defaultActionId`** (`UnitDef`) is the Action used when a Unit is
spawned *dynamically* — via another Action's `attack.spawnUnitId` — rather
than hand-placed on a tile, since a dynamic spawn has no placement-time
"choose a starting Action" step to draw from. Set via a picker on
`UnitStatsForm.tsx`'s **Actions** tab, listing that Unit's own `actions`.

**Three dedicated concepts dissolved into ordinary steps** rather
than surviving as their own types, once behavior stopped living on a
graph:
- **Dwell** — a step at the *same position* as its predecessor *is*
  dwell-in-place; there's no separate `DwellBehavior` type or
  dwell-specific form (a zero-length bezier segment has nothing to travel
  along).
- **Entrance/Exit** — the first and last step in an instance's step list
  are just ordinary steps; there's no dedicated `EntranceAppearance`/
  `ExitConfig` type, and no enable/disable logic for "can this step have
  an exit" — the "+ Add next step" button is always available on the last
  step, full stop.
- **Teleport** — no dedicated `TeleportMovement` primitive. A step
  referencing an Action with `setsInvincible: true` (until real animations
  exist, rendered the same way the old "Disappear" did — see
  "Invincibility" below) followed by a later step referencing one with
  `setsInvincible: false` composes to the same visible effect without a
  special case in the movement vocabulary.

**Branch conditions remain cut entirely** — no conditional jump exists
anywhere in the step list; steps play in the fixed order they're authored
in. `requiresInvincible` (above) is a narrow, orthogonal precondition, not
a branch — it's a gate on whether *this* Action is eligible to run next,
not a jump to a different one.

### Invincibility (`unitTypes.ts`, `actionState.ts`)

**Derived, not stored per-placement — the semantic successor to the old
`EncounterStep.visible`.** No `invincible` field lives on a step or
Part-action placement; `actionState.ts`'s `resolveInvincibleAt` computes
it by walking the sequence of Actions a track references, in order,
applying each one's `setsInvincible` (`null` = no change, carries the
previous value forward; `true`/`false` = sets it explicitly), starting
from `false`. `movementPreview.ts`'s `computeInstancePreview` exposes the
result as `invincible` on its return value for the base Unit's own track;
the same function serves a Part's own `partActionsForPart`-sorted
placements.

**"Invincible" replaced "visible" because the two aren't the same
thing** — Noah's correction: "The existing 'visible' flag should become
the invincible flag... a Unit that can't be hit isn't necessarily
invisible" (a submarine's shadow, a turret behind a closed blast door).
Until a real animation system exists to swap in an alternate sprite for
that state, rendering code treats `invincible` the same way it used to
treat `visible === false` — hides the sprite as a temporary stand-in
(`.shmup-enemy-node--hidden`, a 🛡️ badge instead of the old 👻 one) —
that's a documented, acknowledged simplification, not the intended final
behavior.

**Hittability cascades top-down only, via AND-logic** (a per-Part
concept, not yet consumed by anything in the editor itself since there's
no real hit detection here — documented for the eventual game runtime):
"Something is only hittable if all its parents are hittable. So a top
level invincible Unit makes all its parts invincible, but those parts can
be invincible while the main unit is vulnerable" (Noah) —
`hittable = !unit.invincible && !part.invincible`.

### Movement (`bezier.ts`, `unitTypes.ts`)

**Movement stopped being an Action-level choice (straightLine/wave/
spiral) and became a single cubic bezier curve per segment.** The original
per-Action movement vocabulary was dropped in favor of: every segment
between two of a Unit instance's steps is one cubic bezier curve, shaped
by each step's own `handleIn`/`handleOut` offsets and paced by the owning
Unit's fixed `speed` (px/sec, a ceiling never touched by difficulty
scaling — "never touch speed!" per Noah, since it's what keeps a level's
pacing predictable) times whatever `movementPercent` the step's own
referenced Action carries (0-100%, unitTypes.ts — 0 is a dwell, 100 is the
Unit's full authored `speed`). **What shape those curves are allowed to
take is decided by the Unit's own handling stats** — see "Turning:
`minSpeed` + degrees/sec" below, which replaced an earlier `turnRate`
that capped handle length as a multiple of the segment's straight-line
length.

**A null handle defaults to the straight-line-equivalent position** — a
fresh step (or one whose handle was never dragged) behaves exactly like a
straight line (P1/P2 placed at 1/3 and 2/3 along the straight path), so
authoring a sequence without touching handles at all matches the old
straight-line default with zero extra effort. Only once a handle is
actually dragged does the segment curve.

**Editing handles is a canvas interaction, not a form field.** Selecting
a step (same tap-to-select as everything else on the canvas) reveals up
to two small draggable teal (⬦) handle dots, connected to the step by a
dashed stalk: one shaping the curve *leaving* it (skipped on the last
step of a sequence — no outgoing segment), one shaping the curve
*arriving* at it (skipped on the first step — no incoming segment).
Dragging either bends the connector, which renders as an SVG `<path>`
cubic-bezier command instead of a straight `<line>`. The drag itself
computes a raw offset from the pointer position, re-solves the path with
that offset applied (`pathSolver.ts`), and stores the offset the solve
*actually used* — so the dot visually "sticks" the moment you drag past
what the Unit could fly, and the stored data always reflects exactly what
the curve uses rather than an unenforced excess. **The handle drag targets are real HTML `<button>`
elements** (`.shmup-handle-btn`), not SVG shapes — see "Canvas" below for
why (mobile hit-testing).

**Segment duration is the curve's arc length ÷ effective speed.**
`bezier.ts`'s `cubicBezierLength` numerically integrates the curve (no
closed-form solution exists for a general cubic bezier) by sampling it as
a 32-segment polyline and summing distances — plenty of precision for a
game-authoring tool, not a CAD-grade tolerance. Since a *moving* segment's
duration is now *always* exactly consistent with its curve's real length
by construction (manually-authored time only survives for *dwelling*
segments, which have no travel to overshoot), `movementPreview.ts`'s old
distance-based overshoot clamp collapsed into a plain `u =
elapsed/duration` clamped to `[0, 1]`, evaluated via `cubicBezierPoint` —
meaningfully simpler than the old per-movement-kind dispatch (straightLine
needed a quadratic solve for `accel`; wave/spiral needed their own
oscillation formulas). See "Timing" below for how `time` derivation
itself works.

**Degrees/sec came back as the real meaning of turn rate** — see
"Turning" below. The note that used to sit here (that the old homing
sense of `turnRate` was gone along with the movement-kind system) is
superseded: the stat is angular again, it just governs the *shape of the
authored path* rather than live homing.

**Bullets are no longer a separate type — see "Attacks" below.** An
earlier pass kept a dedicated `BulletDef`/`MovementBehavior`
(straightLine/wave/spiral) system for fired projectiles, reasoning that a
bullet "has no waypoints to curve between." The Parts/Weapon-track pass
replaced that entirely: an Action's `attack.spawnUnitId` spawns an actual
`UnitDef` by id, and `MovementBehavior`/`BulletDef`/`MovementForm.tsx` were
deleted outright, not kept around for a use case that no longer exists. A
spawned Unit's own movement, if it has one, comes from its own
`defaultActionId` (above) — the seeded default Bullet Unit's one Action
("Fly") is a plain 100%-movement, `facing: "faceMovement"` Action with no
attack of its own.

**Wave/spiral/wobble for Units aren't gone, they're deferred** — see
`shmup-editor.todo.md`'s Remaining list for the planned per-Unit
"constant motion" property (a secondary offset the sprite/hitbox orbits
or oscillates around its primary bezier-path position, independent of
`speed`/turning stats) that will eventually cover what those movement kinds
used to.

### Turning: `minSpeed` + degrees/sec (`turning.ts`, `pathSolver.ts`)

**A Unit's handling stats decide what routes an encounter author can draw
with it.** Noah: "I want the stats to dictate the sorts of routes a
designer could make on a level... we design Units thoughtfully so creating
encounters is easy. And players would learn what to expect from certain
enemies after a while."

#### What the old `turnRate` was, and why it went

`UnitDef.turnRate` used to cap how far a bezier handle could extend, as a
multiple of its segment's straight-line length. It read as a
ship-handling stat and behaved like nothing of the sort:

- **It couldn't limit cornering at all.** A corner is the *junction
  between* two segments, where the tangent jumps instantly; no clamp on
  either segment's handles touches it. `turnRate: 0` forced every segment
  straight, which made corners maximally sharp — the exact opposite of
  what the name promised.
- **On an un-dragged path it did nothing whatsoever.** A null handle
  defaults to the straight-line-equivalent position, i.e. colinear with
  the segment; clamping a colinear handle shorter still leaves a straight
  line of identical arc length. Only the *pacing* within the segment
  changed (below 1/3 it quietly added an ease-in/ease-out).
- **Its effect wasn't monotonic.** A *short* perpendicular handle is the
  tightest curve of all (the whole turn crammed into a few pixels), so
  "drag less" made turns sharper; past the circle-approximation point
  (~0.39 of the chord) more handle meant a wider bulge, then a cusp, then
  a loop. One knob spanned straight → circle → square → loops.

#### What replaced it

Two stats on `UnitDef`, both physical:

- **`turnRateDegPerSec`** — how fast it can change heading. Floored at
  `MIN_TURN_RATE_DEG_PER_SEC` (1) rather than 0: a Unit that can never
  change heading can't be routed anywhere.
- **`minSpeed`** — the slowest speed it can sustain. **This is the stat
  that makes the model work** (Noah's insight): it decides whether a
  corner is a geometry problem at all.

They combine into the one quantity every path decision is made against:

```
minTurnRadius = minSpeed / radians(turnRateDegPerSec)
```

- **`minSpeed === 0` — it can stop, so it can pivot.** Radius 0: no
  corner is off-limits. A corner costs *time* instead — `pivotSeconds`
  spent standing still while it rotates. Tanks, helicopters, turrets.
- **`minSpeed > 0` — it can't stop, so it must arc.** It has a real
  turning circle and its path is bent to respect it. Jets, ships,
  anything on wheels. A jet's high speed limits its manoeuvres for free:
  radius is speed ÷ rate, so 130 px/sec at 90°/sec can't corner tighter
  than 83 units.

The split is deliberately visible in play: a tank drives straight lines
and rotates on the spot, a jet sweeps. That's the "players learn what to
expect from certain enemies" goal, expressed as geometry rather than as a
scripted behavior.

#### The solver (`pathSolver.ts`)

**Waypoints are hard constraints; the shape between them is derived.**
The editor never rejects a placement and never marks anything invalid —
it solves for the closest flyable path and draws *that*, both on the
encounter canvas and in the timeline's motion preview.

For an arc Unit:

1. **Tangent direction per waypoint** — chordal Catmull-Rom
   (`normalize(next - prev)`). This alone handles the motivating case: a
   jet given (0,0) → (300,0) → (300,300) arrives at the corner already
   heading 45°, so it dips wide *before* the waypoint and bulges wide
   *after* it rather than turning in place. An author-dragged handle
   overrides the direction for its waypoint.

   **A waypoint whose two neighbours are the same place** (a route that
   doubles back on itself) degenerates Catmull-Rom, and its natural
   fallback — heading back the way it came — is the one direction nothing
   can fly at any radius, which forces the entire reversal to happen
   *before* the apex as one enormous loop. The perpendicular is used
   instead, splitting the reversal into two ordinary quarter-turns either
   side of it: a teardrop, which is how a real thing turns around. It
   matters in practice: on the Stats circuit it halved a truck's detour
   and took the battleship from best-effort to genuinely flyable.
2. **Handle length** — defaults to a third of the chord (which reproduces
   an exactly straight line when the tangents are chord-aligned, so an
   ordinary path looks exactly as it always did), then searched over a
   range, taking the value **closest to the default** that keeps the whole
   segment at or above `minTurnRadius`. Nearest-to-default, not
   largest-or-smallest, precisely because curvature isn't monotonic in
   handle length.
3. **Tangent relaxation, only if that fails** — rotate the offending
   waypoints' tangents by the *smallest* deviation that makes their
   segments flyable. This is what rescues a hairpin (a jet given a
   direction reversal goes from a 38-unit tightest radius to 94, i.e.
   flyable). Deliberately off the happy path: it's the expensive step, and
   a step-2 solution is the one an author finds least surprising.
4. **Best effort** — genuinely impossible geometry (waypoints 60 units
   apart with a right-angle turn and an 89-unit minimum radius) keeps
   whatever came closest and reports `feasible: false`. The path still
   exists, still passes through every waypoint, and is still drawn.

For a pivot Unit the legs stay straight and each corner yields
`pivotSeconds(turn angle)` of standing still — no curvature constraint
exists for something that can stop.

A **closed** variant (`PathOptions.closed`) exists solely for the Stats
tab's demo circuit, which has to lap forever without a seam. Encounter
paths are always open.

Solves are memoized (`solvePathCached`, a 64-entry insertion-ordered map)
because the editor re-solves on every render and the runtime asks per
frame.

#### What it changes downstream

- **Timing** (`encounterTiming.ts`) — a derived step time is now pivot +
  solved arc length ÷ the speed that segment's tightest bend allows
  (`speedThroughRadius`). A jet's swing-wide detour is genuinely longer
  than the straight line and is timed as such; a tight arc forces a
  slow-down; a tank's corner costs seconds of standing still.
- **Heading** (`movementPreview.ts`, and the game's `movement.ts`) —
  differentiated from the curve while travelling, but *interpolated across
  the pivot* from the solved arrival tangent to the departure one. Without
  that a tank would sit motionless through its corner and then snap.
- **Handle drags** (`EncounterEditor.tsx`) — clamped live rather than on
  release, by re-solving with the proposed handle and keeping what the
  solve used (`effectiveHandleOut`/`effectiveHandleIn`). The dot, the
  drawn curve and the stored value can never disagree.
- **The game** mirrors `turning.ts` and `pathSolver.ts` verbatim
  (`games/shmup/src/systems/encounters/`), the same re-declared-not-shared
  stance `authoredTypes.ts` takes. It has to: the editor draws and *times*
  the solved path, so any divergence is the game playing something other
  than what was authored.

#### Migration

**No `SAVE_VERSION` bump** — same reasoning as `repairSeededSimpleEnemies`:
a bump resets the whole library, discarding user-authored Units, and the
stored shape otherwise didn't change. `unitStore.ts`'s `migrateMotionStats`
fills the new fields in on load instead. There is no meaningful conversion
from the old handle-multiplier `turnRate`, so seeded Units are re-stamped
from the current specs by id and anything user-authored gets `minSpeed: 0`
plus a neutral 90°/sec — making it a pivoter, which leaves every route it
was already authored on flyable exactly as before.

### Authoring frames: Ground / Air / Doodads (`airFrame.ts`, `EncounterEditor.tsx`, `EncounterTimeline.tsx`)

**A Unit's layer decides which reference frame it lives in, and the
canvas can be drawn in either one.** This is the editor half of a split
the *runtime* already shipped (`EncounterRunner.ts`'s `isScrollLocked` /
`pinnedOriginY`, documented in `games/shmup/authored-encounters.spec.md`).
Before this, the canvas drew every instance against one tile-local frame
regardless of layer, so a helicopter and a turret looked identical while
authoring and behaved completely differently once played — exactly the
editor-shows-X-game-does-Y drift `scrollModel.ts` exists to prevent, one
level up. `airFrame.ts` therefore **mirrors the runtime's rule rather than
inventing an editor-side one**:

- **Ground and doodad are scroll-locked.** Their authored position
  resolves against the live tile frame forever.
- **Air is time-locked from spawn.** An aircraft is never attached to the
  terrain, so its authored route is a route *through the screen*: it
  renders in exactly one place at every scrub time, and nothing but its own
  path ever moves it.

  **This replaced a pin-on-first-visibility rule.** Air used to ride the
  scrolling frame until it first became genuinely on screen and pin there,
  so that a unit authored high in its tile got carried into view by the
  scroll rather than being stranded above it. What that produced in
  practice was a route that slid for the first few seconds and then
  stopped — so the drawn path was not the flown path, and scrubbing showed
  the whole thing drifting (Noah: "the routes shifted... I want to design
  where the air units will be on-screen as they fly around"). The case it
  existed to serve is now simply *authored*: put the first waypoint outside
  the camera box and a later one inside it, which is both more predictable
  and more expressive than having the scroll do it for you. Changed on both
  sides at once (`airFrame.ts` and `EncounterRunner.ts`'s `pinnedOriginY`),
  since the editor drawing and the game flying have to agree.

A **Ground/Air/Doodads toggle** sits in the timeline toolbar (a view-wide
mode, not a property of any selection). It switches several things at once:

| | Ground mode | Air mode | Doodads mode |
|---|---|---|---|
| Tile + ground units | fixed | slide down past a fixed camera | fixed |
| Air unit | drifts *up* the tile as terrain passes beneath | **holds still** | drifts up, dimmed |
| Camera box | climbs the tile | fixed, drawn as a solid teal frame | climbs the tile |
| "+ Add" roster | ground Units | air Units | doodad Units |

**A frame is two things at once — a reference frame and a roster — and
doodad only ever matched ground on the first.** `AuthorLayer` used to be
deliberately two-valued, folding doodad in with ground on the reasoning
that both are scroll-locked so a third mode would have nothing to draw
differently. The geometry half of that is still true and Doodads mode
renders identically to Ground (`referenceShiftY` returns the same 0 for
both, pinned by a test). The authoring half was wrong: it left every
doodad in the ground roster, so dressing a tile meant hunting for the tank
among the trees, and a tile's scenery couldn't be picked apart from its
ground opposition. `AuthorLayer` is now simply `UnitLayer`, one mode per
layer, and `authorLayerOf` is gone — a Unit's frame is just its layer.

**Doodads are also missing two things the combat layers have**, because
neither means anything for scenery:

- **No Action picker.** A doodad's Unit ships `actions: []` by
  construction, so the Step tab drops the row rather than rendering its red
  "(no Actions on this Unit yet)" warning — for a doodad that state is
  correct and permanent, not a gap to go fill.
- **No Scaling tab.** Scaling is a difficulty response ("throw more of
  these at a stronger player"); set dressing doesn't scale, so the tab is
  withheld rather than shown offering a knob that shouldn't be turned.

The frame you aren't authoring stays **visible but dimmed and
non-interactive** (`.shmup-enc-offlayer`), and its timeline track collapses
to bare timing hairlines — separate to author, together to check. (Air
tracks used to carry a dashed teal **pin marker** at the decouple moment;
with air pinning at spawn that marker sits exactly on the first step, so
it was removed as redundant.) The camera box is drawn unconditionally in air mode (not just in
the E4 hitbox preview) because there every authored position is really
"where on screen, and when" — without it the air canvas is an empty field
with nothing to place against.

**Authored positions stay tile-local.** Air mode is a rigid render-time
translation, never a coordinate-system change. Two consequences, both of
which would be bugs done the other way:

1. The runtime resolves air positions *through* the tile frame — pinning
   freezes that frame's origin, it does not switch coordinate systems. So
   storing viewport-relative positions would contradict it.
2. A rigid translation preserves arc length, so every derived step time
   (`encounterTiming.ts`, `bezier.ts`'s `cubicBezierLength`) is unaffected
   by which mode you authored in. No save-version bump, no migration.

`airFrame.ts` keeps the two halves of the offset deliberately separate:
`pinShiftY` (the decoupling) is what *geometry* math uses — attack
anchors, `facePlayer` aim against the player marker — while
`referenceShiftY` (the mode term) translates the whole scene uniformly at
render. Folding the mode term into relative geometry would double-count it
and make a pinned unit slowly swing its aim for no authored reason.

Two smaller consequences: a newly placed **air** Unit defaults to *inside*
the camera box, near the top, rather than above the tile — pinned at spawn,
anything placed off-camera would simply stay off-camera, so an entrance is
now a deliberate thing you drag rather than a default; and an encounter
whose placed Units are *all* air opens
in Air mode, because opening it in Ground would show every one of them
dimmed and unselectable.

**Still not built**: Parts don't move (see "Attacks" below — scheduling
only).

### Attacks (`unitTypes.ts`, `partActions.ts`, `ActionForm.tsx`, `PartEditor.tsx`, `PartActionPanel.tsx`)

**An attack is just one optional field of an Action — `ActionAttack |
null` — not a separate class.** The prior (fifth-pass) `WeaponDef` was
folded straight into `ActionDef.attack` when Actions came back: nothing
was gained by the indirection, since Weapons were never actually shared
across Units or even across a Unit's own Parts (each Part owned a private
list) — the only reuse a separate class bought was two Actions on the
*same* Part wanting a byte-identical fire pattern, which Cloning (an
authoring-UI operation, not a data concept) covers fine. A spawned
projectile is still an actual Unit, not a bespoke bullet type
(`attack.spawnUnitId`) — recursion (a bullet that itself fires) falls out
for free.

**Both the base Unit and every Part have their own independent Action
buffet, and both can carry attacks.** A Unit's own `actions` (referenced
by its steps) is what a Part-less Unit uses directly — "a jet that flies
and shoots is one Unit, zero Parts, one Final Action." A Unit with Parts
still resolves its *own* movement/facing/state (and optionally fires) from
its own steps' Actions, independently of whatever each Part's own track is
doing — a turret Part firing doesn't stop the base hull from also having
an attack of its own if one's authored. `UnitPart` (`unitTypes.ts`) is
`{id, name, offset, spriteId, customSprite, hasHitbox, hasHealth, hp,
damageMultiplier, actions}` — `offset` is a position relative to the
Unit's own origin, so a turret mounted forward of a ship's center anchors
its fire (and its own Actions' facing) from the right spot. Every Unit is
seeded with one default "Main" part, so the common single-Action-system
case needs zero extra authoring; a battleship with three
independently-scheduled turrets is just three Parts, each with its own
Action-track placements — this is what makes independent per-part tracks
fall out for free instead of needing a dedicated multi-entity system.

**Facing subsumes aim — there's no separate weapon aim mode.** An
attack's base angle is simply whatever the *owning Action's* `facing`
resolves to at fire time:

- **`"fixed"`** — a base angle (`fixedFacingDeg`). "Aim at a fixed point on
  the map" is just this, with the angle chosen to point there — not a
  third mode, and not something a per-placement override exists for
  anymore (see "Per-placement overrides" below) — Cloning the Action is
  how you'd author a fixed-angle variant.
- **`"faceMovement"`** — follows the instance's actual direction of travel,
  numerically differentiated from its own bezier position curve
  (`movementPreview.ts`'s `computeInstanceHeadingDeg`) — falls back to a
  fixed stand-in while genuinely stationary (dwelling), since there's no
  principled direction to derive in that case.
- **`"facePlayer"`** — tracked continuously toward a reference point
  standing in for the player (not simulated in the live preview, same
  no-live-player-at-authoring-time approximation the movement preview already
  accepted; the E4 hitbox preview does have a real static reference marker
  to aim at, see below).

**The attack itself is still one flat, orthogonal set of fields, not a
shape x aim x trigger matrix** — unchanged in shape from the fifth-pass
`WeaponDef`, just relocated under `ActionDef.attack` and renamed a couple
fields:

- **Arc range** (`arcStartDeg`/`arcEndDeg`, relative to the owning
  Action's facing) + **shot count** + **spacing** (even/random) +
  **per-shot delay** (time between shots *within* one burst, distinct from
  `burstIntervalMs`, the time *between* bursts). One primitive covers a
  fan (narrow arc, few shots), a full radial burst (`0°/360°`), or a burst
  with a deliberate gap at the facing direction (`5°/355°`, a safe lane).
- **Sweep** (`sweepSpeedDeg`, `pingPong`): a nonzero sweep speed rotates
  the whole arc over time — this **is** "rotating" fire, not a separate
  mode.
- **`repeatCount: number | null`** — how many bursts this Action's attack
  fires before it's done. `null` = fire for as long as the Action itself
  keeps running (a Final Action's indefinite repeat, e.g. a turret that
  just keeps shooting); a number = a fixed, finite count (one beat of a
  scripted sequence). Replaces the old placement-level `durationMs > 0`
  gate — see "Timing" below for how this feeds the Action's own computed
  duration.
- **`spawnUnitId`/`spawnScale`**: any Unit in the library (including one
  with its own Parts/Actions — recursive/splitting fire is free, no
  nested-payload shape needed) with a simple flat size multiplier.
  `spawnScale` is deliberately simple; see `shmup-editor.todo.md` for the
  deferred difficulty-scaling-curve system this is *not* attempting to be.
- **`spawnGroup: CollisionGroup`** — see "Collision groups" below. New in
  this pass; defaults to `"enemyProjectile"`.

**Collision groups** (`CollisionGroup`, `unitTypes.ts`) — `"enemy" |
"friendly" | "enemyProjectile" | "friendlyProjectile"`, a flat, fixed set
authored directly on the `ActionAttack` that spawns a projectile, **not**
inherited from spawner lineage. Noah's design, matching how he'd set this
up in Unity: a small fixed collision matrix in the eventual game runtime
(not this editor's concern) enforces that a group never checks itself, and
the two projectile groups never check each other either — cleanly solving
both "no friendly fire" and "bullets don't hit bullets even across sides"
without tracking who-spawned-what. No separate Doodads group — lumped in
with Enemy. This editor only ever authors enemy-side content, hence the
`"enemyProjectile"` default.

**`PartActionPlacement`** (`encounterTypes.ts`) is the Part-track
placement: `{id, partId, time, actionId}` — a straight simplification of
the fifth-pass `EncounterAttack`, which carried `weaponId`, `durationMs`,
and `aimAngleOverride`. All three are gone: an Action *is* the reference
now (and may or may not carry an attack), duration is computed from the
referenced Action's own attack fields rather than authored per-placement
(see "Timing" below), and aim is just whichever way the Action's own
`facing` resolves — no per-placement override, since Cloning the Action is
how you'd author a variant. `time` is the same shared clock as steps but
is **always manually authored** — unlike a step, there's no
position/distance to derive it from, since a Part placement has no
position of its own (Parts don't move independently yet — see "Movement"
above). It fires from wherever the instance's bezier path (plus the
Part's `offset`) puts it at that moment — `partActionAnchorWorld()` in
`EncounterEditor.tsx` reuses `movementPreview.ts`'s
`computeInstancePreview` for this, falling back to the instance's first
step if the placement's time is before the instance has technically
spawned. `partActions.ts` is **unordered** array CRUD (`addPartAction`/
`updatePartAction`/`deletePartAction`/`partActionsForPart`) — unlike
steps, placements have no chronology invariant to maintain, so deleting
one never cascades to any other.

**There's no more draggable aim handle on canvas.** The fifth pass had one
(a fixed-aim Weapon's angle, dragged via a handle at the attack's anchor)
— now that aim is just the owning Action's own `facing`/`fixedFacingDeg`,
authored once on the Action rather than per-placement, there's nothing
left for a per-placement drag to write to.

**Parts are independent tracks, not attacks attached to a waypoint.** The
🔫+ button that used to add a placement (on a selected step's control
cluster, with its own Part picker for multi-Part Units) is **gone**. It
framed the operation as "attach an attack to this waypoint" — and a Part's
firing schedule has never had anything to do with where the hull happens
to have a waypoint. It existed only because a Part with no placements had
no lane, no marker and nothing to select. Noah, on finding it still there
after Actions had already absorbed attacks: "why do we still have an
attack button? Aren't attacks 100% covered by Actions in general?" They
are — the button was pre-unification vocabulary that outlived the data
model it described.

What replaces it:

- **Placing a Unit places all of its Parts.** `partActions.ts`'s
  `seedPartActions` gives every Part a placement at the instance's spawn
  time, pointed at that Part's first Action. A battleship arrives with all
  four turret tracks already on the timeline rather than as a hull you
  then bolt guns onto.
- **A Part with no Actions still gets its dot**, with a `null` `actionId`.
  Refusing would recreate the same discoverability hole one level down — a
  Part you can't reach until you go elsewhere and give it an Action first.
  Both validators (`encounterValidation.ts`, and the game's own
  `authoredContent.ts`) already accepted a null `actionId`, so this needed
  no save-version bump and left existing content untouched.
- **Adding more**: select a dot on a Part's lane and press **+**, which
  appends at the **playhead** — the shared clock every track is
  choreographed against — and the Part tab's Time Dial adjusts it after.
  Same select-then-append gesture a step uses, just scheduling instead of
  positioning. A lane whose placements were all deleted (or an encounter
  authored before seeding existed) keeps a **+** parked at the playhead, so
  an emptied Part always has a way back.

See "Timing" below for how the lanes themselves render and collapse.

### Per-Part hitboxes (`unitTypes.ts`, `PartEditor.tsx`)

**General now, not reserved for hand-coded bosses.** `UnitPart` gained
`hasHitbox`/`hasHealth`/`hp`/`damageMultiplier` in this pass — Noah: "Per
part hitboxes aren't a huge lift for the editor, honestly. We're 80% of
the way there with sprites and positions, let's just go for it."
`hasHitbox: false` (the default) means the Part is fused to the base
sprite — damage attributed to the parent Unit, no separate collision.
`hasHitbox: true` gives the Part its own collidable area, subject to
`damageMultiplier` (>1 = weak point/critical spot, <1 = reinforced armor);
`hasHealth: true` on top of that gives it a genuinely separate HP pool
(`hp`) rather than transferring damage through to the Unit's shared one.
See "Invincibility" above for how a Part's own invincibility state
composes with its parent Unit's (AND-logic, top-down only).

### Visual authoring pass (`PartPositionEditor.tsx`, `ActionPreview.tsx`, `actionPreview.ts`)

The Parts/weapon-track pass above shipped as pure data-entry — no
defaults, no way to see a Part's position or a Weapon's pattern except by
reading numbers. Noah's follow-up feedback ("a lot of numbers, zero
defaults, nothing visual... emphasis on the G") drove three fixes. (The
preview described below moved from a standalone `WeaponForm.tsx`/
`WeaponPreview.tsx` to `ActionForm.tsx`/`ActionPreview.tsx` when Actions
came back — same math, now previewing an Action's facing + optional
attack together instead of a standalone Weapon.)

- **`UnitPart` gained its own `spriteId`/`customSprite`** — a Part can
  now render/reposition visually, not just anchor an Action buffet
  logically. `unitStore.ts`'s `SAVE_VERSION` bumped (6→7) for the new
  required fields.
- **`PartPositionEditor.tsx`**: a small fixed-size canvas embedded in
  `PartEditor.tsx`, above the (still-present, still typeable) numeric
  Offset X/Y fields. Renders the owning Unit's body sprite dimmed
  (opacity 0.45 + a slight grayscale, same "ghosted reference" language
  `.shmup-enemy-node--hidden` already uses) and the Part's own sprite on
  top at its current offset — drag the Part sprite directly, or nudge it
  with four arrow buttons (`NUDGE_STEP` px per tap). Flat 1:1 px-per-
  offset-unit mapping centered on the canvas; no bounding-box/PADDING math
  needed like `EncounterEditor.tsx`'s world canvas, since this is a small
  fixed-size widget, not a scrolling world space. The encounter canvas's
  Part-Action markers also switched from a generic icon to the firing
  Part's actual sprite when one is set (falls back to ◈ for a spriteless
  Part).
- **`ActionPreview.tsx`/`actionPreview.ts`**: a live animated canvas at
  the top of `ActionForm.tsx` (deliberately first, not an afterthought)
  showing what the Action's facing/attack actually does — a shooter
  marker showing the resolved facing direction (and, for `facePlayer`, a
  dashed line to the reference point) even with no attack configured, plus
  — once an attack is added — the current arc boundaries (sweeping live if
  `sweepSpeedDeg` is nonzero), a telegraph glow during wind-up, and bullet
  dots (the spawned Unit's own sprite, resolved via `spawnUnitId`, falling
  back to a plain dot) flying outward along each shot's angle. Split the
  same way `movementPreview.ts` is: pure, declarative functions in
  `actionPreview.ts` (`computePreviewBullets`/`shotAngleOffsets`/
  `sweepOffsetDeg`/`isTelegraphing`/`burstPeriodMs`, unit tested directly)
  recomputing bullet positions from scratch at any elapsed time — no
  simulation state to reset when a field changes mid-preview — driven by a
  `<canvas>` + `requestAnimationFrame` loop in the component itself.
  Explicitly a *representative* visualization, not a physics match for the
  eventual game runtime (doesn't exist yet): a fixed preview bullet speed,
  not whatever the spawned Unit's own stats would imply; a single-burst
  attack (`burstIntervalMs === 0`) still loops every
  `PREVIEW_LOOP_FALLBACK_MS` so it keeps demonstrating the pattern instead
  of firing once and going static (this preview loops regardless of the
  Action's own `repeatCount`, purely for demonstration purposes — see
  "Timing" below for how `repeatCount` affects a real placement);
  `facing: "facePlayer"` aims at a fixed reference point standing in for
  the player, and `facing: "faceMovement"` aims at a fixed stand-in
  direction (there's no real travel path while just authoring an Action in
  isolation — the E4 hitbox preview below resolves `faceMovement` for
  real, against the instance's actual direction of travel); ping-pong
  sweep oscillates within a fixed `SWEEP_PINGPONG_AMPLITUDE_DEG` (90°)
  since `ActionAttack` has no separate amplitude field to derive one from
  — a documented preview simplification, not authored data.
- **A default Unit library is seeded automatically, well beyond just a
  Bullet.** `unitTypes.ts`'s `createDefaultUnitLibrary()` builds:
  - the original ready-to-use generic projectile (a supplied glow sprite,
    `bullet-basic.png`, low HP, small hitbox, sensible speed) via
    `createDefaultBulletUnit()`, stable id `DEFAULT_BULLET_UNIT_ID` so
    reseeding never duplicates it, with one seeded "Fly" Action (100%
    movement, `facing: "faceMovement"`, no attack) set as both its sole
    Action and its `defaultActionId` — `createBlankAttack` still defaults
    `spawnUnitId` to this Bullet, so a brand-new attack does something
    visible immediately instead of firing nothing;
  - a curated set of 20 more projectile Units (bullets/shells, rockets,
    mines/bombs, fire/energy orbs, sci-fi canisters — see
    `public/shmup-editor/projectiles/README.md`), each with the same
    single "Fly" Action pattern as the Bullet (a projectile is always
    spawned dynamically via some other Unit's `attack.spawnUnitId`, never
    hand-placed, so `defaultActionId` — the Action a dynamically-spawned
    Unit runs — is the only Action it actually needs) and made-up
    `hp`/`speed`/`size`/`contactDamage`, giving any attack's `spawnUnitId`
    picker real variety instead of one option;
  - a full roster of enemy Units built from every sprite in
    `enemySprites.ts` (the pre-existing armored-truck/battle-tank
    Parts-demo set plus a new "incoming" vehicle batch — helicopters, jets,
    trucks, turrets, a battleship, and a 3-car armored train, see
    `public/shmup-editor/enemies/README.md`), each pre-wired with a
    "Move" Action (100% movement facing the direction of travel, or
    stationary/fixed-facing for the two turret Units) on the Unit's own
    buffet — set as `defaultActionId` — plus an "Attack" Action (0%
    movement, `facing: "facePlayer"`, firing the default Bullet on
    repeat) either also on the Unit's own buffet (single-sprite vehicles)
    or on a dedicated Turret Part's independent buffet (body+turret
    vehicles, mirroring the pre-existing armored-truck/battle-tank
    Parts-demo split). Each Unit also gets a `layer` (`"air"` for the
    helicopters/jets/prop plane, `"ground"` for everything else — trucks,
    tanks, motorcycles, trains, turrets, the battleship). Stats
    (`hp`/`contactDamage`/`scoreValue`/`speed`/`minSpeed`/`turnRateDegPerSec`/`size`) are
    made-up placeholder numbers loosely scaled to each vehicle's apparent
    size/role, not balanced gameplay data. Every one of these — Unit id,
    Action id (Move/Attack/Strafe), and each turreted enemy's per-turret
    Part id/Action id — is **deterministic**, not the usual random
    `makeUnitId()`/`makeActionId()`/`makePartId()`: `enemyUnitId(slug)` and
    its siblings (`enemyMoveActionId`, `enemyAttackActionId`,
    `enemyStrafeActionId`, `enemyTurretPartId`, `enemyTurretAttackActionId`)
    always produce the same id for the same slug. That's what lets
    `types.ts`'s hand-authored default-tile Encounters (see "Persistence"
    below) reference "the Attack Action on the seeded Turret" by a fixed
    string, even though the tile library and the Unit library are two
    separate `.DAT` files seeded independently. A mobile simple enemy also
    gets a third Action, **Strafe** — `enemyAttackActionId`'s stationary,
    face-player Attack is right for something that plants and fires (a
    Turret), wrong for a vehicle meant to fire *while* moving (a jet's
    strafing run); Strafe keeps facing the direction of travel instead,
    same fire pattern otherwise;
  - a doodad set of 93 inert scenery Units — one per sprite in the doodad
    batch (foliage, rocks, desert flora, a military camp kit and its desert
    recolor, urban street furniture, industrial clutter, and large rooftop
    structures; see `public/shmup-editor/doodads/README.md`) — built by
    `DOODAD_SPECS`/`createDoodadUnit`. A doodad reuses `UnitDef` wholesale
    rather than getting a parallel type (this file's header: a Unit "also
    covers non-combatant doodads"), so encounter placement, scaling and
    preview all work on it for free. What makes one inert is a specific
    combination: `layer: "doodad"`, `speed: 0`, `actions: []` with
    `defaultActionId: null` (which the Step tab reads as "(none — holds
    position)"), `contactDamage: 0`, `scoreValue: 0`, and the default Part's
    `hasHitbox: false` (which adds no *second* hitbox over the Unit's own).
    **Not being shootable is enforced runtime-side, not by these stats**:
    `EncounterRunner.ts`'s `isCollidableLayer` spawns the doodad layer with
    its physics body disabled, keyed off the layer alone, so player fire
    passes straight through scenery and homing never locks onto it. The stats
    above are what a doodad would be if it somehow were hit, not what stops it
    being hit. Note the null default is
    deliberately *not* the inert `createMoveAction(false)` that
    `repairSeededSimpleEnemies` exists to undo for turrets: a turret with no
    Action was a bug because a turret is meant to shoot, whereas a rock doing
    nothing is the entire point. `size` is hand-tuned per prop (a manhole
    cover 12, a warehouse roof 56) because the sprites are all fitted to one
    256px square canvas and so carry no usable scale of their own. Doodads
    also don't get a stable id per prop (unlike the deterministic enemy ids
    above) — `types.ts`'s hand-authored Encounters (see "Persistence" below)
    place doodads by picking a sprite that fits the tile's art and reading
    its `spriteId` back off `DOODAD_SPECS`/`doodadUnitId`, not by importing a
    per-doodad constant.

    Because the batch is purely *additive* seed content, a library saved
    before it shipped gains it via `backfillDoodads` on load rather than a
    `SAVE_VERSION` bump — the same reasoning that makes
    `repairSeededSimpleEnemies` a content-level repair: a bump resets the
    library and discards every Unit the user authored. A one-shot
    `doodadsSeeded` flag on the saved record (optional, so pre-existing saves
    parse as not-yet-backfilled) guards it, so the batch lands exactly once
    and a doodad the user deliberately deletes stays deleted instead of
    reappearing on every load.

    **Two seeding bugs, since fixed** (`createSimpleEnemyUnit`, plus
    `repairSeededSimpleEnemies` for already-saved libraries). Noah's report:
    "placed turrets don't have a default Action, so I have to place them, set
    the action, repeat for any other placements."
    1. Single-sprite enemies got their Attack on the *Unit's* buffet but their
       one "Main" Part was left `actions: []`. The encounter editor's (since
       removed) 🔫+ node control gated on
       `parts.some(p => p.actions.length > 0)`, so it was permanently disabled
       for all twelve of them — you could never place an attack without
       detouring through the Units editor first. Under the Part-lane model
       that replaced it this class of bug can't recur: a Part with no Actions
       still gets a lane and a dot, and its Action picker is right there.
    2. A stationary enemy (a Turret, `speed: 0`) took
       `createMoveAction(false)` as its `defaultActionId`, which is inert by
       construction — `movementPercent: 0`, `attack: null`. So a freshly placed
       turret stood there doing nothing until you hand-picked an Action, once
       per placement. Stationary units now default to their **Attack** Action;
       anything that can move still defaults to Move.

    `repairSeededSimpleEnemies` applies both fixes in place on every
    `loadUnits`, deliberately **instead of** a `SAVE_VERSION` bump: the stored
    *type* shape never changed, only the seeded content, and bumping the
    version resets the whole library — discarding any Units the user authored
    themselves. It matches only ids `createSimpleEnemyUnit` owns, only
    redirects a default that is genuinely the inert Move (a `null` default is
    "(none — holds position)", a real authoring choice that must survive a
    repair that runs on every load), and is idempotent.

  All of the above use stable (not random) ids
  (`unit-default-<slug>`/`unit-default-proj-<slug>`) so reseeding never
  duplicates them. `unitStore.ts`'s `loadUnits` seeds-and-persists this
  library the moment it would otherwise return empty — a brand-new
  install, or any save that fails the version/shape check (the same
  fallback every prior version bump already used). Noah, on the shared
  default Bullet staying live rather than getting cloned per-use: "Most
  enemies will fire the same handful of projectiles, so changing one of
  them WILL affect all units — but that's fine by me. I think it makes
  balance easier maybe?"

### Timing (`encounterTypes.ts`, `encounterTiming.ts`, `EncounterTimeline.tsx`)

**There is no `Trigger` type anymore — every step just has a `time`.** The
original design had a `TriggerKind = "always" | "unitPosition" |
"playerPosition" | "time"` union; once the encounter editor grew a real
timeline scrubber (below), that indirection stopped earning its keep —
`"always"` just meant "whatever time the previous action happens to end,"
which a scrubber can show directly, and `"playerPosition"` was never
actually previewable (it depends on where the live player is, which
doesn't exist at authoring time — the same reasoning that, in this same
pass, also cut `AttackPayload`'s `"onProximity"` trigger kind (fires when
the player enters a radius) and its `proximityRadius` field from
`unitTypes.ts` — `AttackTrigger` is now just `"continuous" | "onDeath" |
"onTrigger"`, all either already time-based or a genuine runtime event
unrelated to timing). `time` is **one shared clock for the whole encounter** — every
unit instance's steps are timed against the same origin, not relative to
that instance's own start, so multiple units can be choreographed against
each other (two turrets alternating fire, a second wave arriving 3s after
the first) instead of each running on an island. A unit instance's first
step can have `time > 0` for a delayed/staggered spawn — there's no
separate "delay" mechanic, it falls out of the shared clock for free.

**A step's `time` is mostly *derived*, not freely authored** (an early cut
of this feature let `time` be fully independent of movement speed, which
read as an obvious bug — see "Movement" above for the full story of why
that changed) — see `encounterTiming.ts`:

- **A step's `time` is derived whenever its position differs from its
  *predecessor's*** — there's a real curve (`bezier.ts`) and a real
  effective speed (the owning Unit's fixed `speed` times the
  *predecessor* step's own referenced Action's `movementPercent`) to
  compute a duration from: `time = precedingStep.time + arcLength ÷
  effectiveSpeed`. `recomputeStepTimes` does this in one forward pass over
  an instance's `steps` array, called by `EncounterEditor.tsx`'s
  `updateInstance` wrapper after *every* mutation (position drag, handle
  drag, Action swap) so a derived time never goes stale — you don't have
  to remember to "re-derive" anything. Move a waypoint closer, straighten
  a curve back out, or swap in a faster Action, and the arrival time
  visibly shrinks; none of that is a special case, it falls straight out
  of the arc-length/movementPercent terms. An unresolved `actionId` (null,
  or a stale reference) defaults to 100% movement for this math, so an
  unconfigured step doesn't silently stall the timeline.
- **A step's `time` stays manually authored when there's nothing to
  derive it from** — the first step of an instance (this is *when the
  unit spawns*, not a destination-arrival) or a step *dwelling at the
  same position* as its predecessor (no destination, nothing to derive).
  `StepPanel.tsx`'s Time field is disabled with an explanatory hint for a
  derived step; it's a normal editable number for a manual one.
- **Dragging a *derived* step on `EncounterTimeline.tsx` to retime it is
  gone.** It used to solve for the *preceding* step's own
  `speedMultiplier` and write that back — safe, because `speedMultiplier`
  was a per-placement field. Now that "how fast" lives on the *Action*
  (`movementPercent`) — a reusable, shared thing potentially referenced by
  many placements — solving-and-writing-back would quietly rewrite every
  other placement of that same Action too. There's no longer a safe place
  to stash a per-placement retime; retiming a movement segment now means
  picking a different (or Cloned, differently-tuned) Action for the step
  that starts it, not dragging its arrival marker. The timeline's retime
  handle (⟷) only renders on a manually-timed step now (first step, or
  dwelling) — a derived step has no handle to drag. A Part-Action
  placement's `time` *is* still freely per-placement authored, but it has
  never had a drag handle either: it's edited by the Time Dial in the Part
  tab (`PartActionPanel.tsx`). (An earlier revision of this doc claimed the
  drag gesture "survives only for Part-action placements" — it did not;
  no such handle was ever rendered for them.)
- **Array index order is the authorial sequence order — steps are no
  longer reordered by dragging.** An earlier design kept `steps` sorted by
  `time` as an invariant so dragging past a neighbor could reorder the
  sequence; once `time` is mostly computed rather than freely draggable,
  that stopped making sense (there was never a UI gesture to reorder
  steps any other way — array order was always the true authored
  sequence). `encounterSteps.ts`'s `updateStep` just floors a manual
  `time` patch at 0 now; `recomputeStepTimes` is what keeps every step
  chronologically after its predecessor.

**An Action's own duration (when it carries an attack) is always
computed, never hand-edited** — "The duration is the longer of: time it
takes the animation to play, time it takes to complete the action. You
define the animation and the weapon behavior, you don't directly edit the
duration of an action" (Noah). Since animation doesn't exist yet, in
practice `hitboxPreview.ts`'s `computeAttackDurationMs` derives it from
the attack's own fields: `telegraphMs` + every burst-to-burst gap after
the first (`(repeatCount - 1) * burstIntervalMs`) + the last burst's own
per-shot delays (`(count - 1) * perShotDelayMs`) — or `null` (indefinite)
when `repeatCount` is `null`. `PartActionPanel.tsx` shows this as a
read-only readout next to a selected Part-Action placement, not an
editable field.

**`EncounterTimeline.tsx`** renders the shared clock as a horizontal ruler
with one track per unit instance, below the canvas. Each step is a small
diamond positioned at `time * PX_PER_SEC`; tapping one selects it (same
selection as the canvas), and a drag handle (⟷) appears only when selected
— mirroring the canvas's own move-handle pattern rather than making every
marker draggable at all times.

**Every Part of a placed Unit owns a lane under its Unit's own track**, as
a small independent unit with its own schedule. Lanes are no longer
conditional on a Part already having placements — that condition was the
sole reason the removed 🔫+ button had to exist (see "Attacks" above).
A lane's dots select and append exactly like step diamonds.

**A Unit's Part lanes are expanded exactly while that Unit is selected**,
and fold into a single hairline summary row otherwise. That's the whole
collapse mechanism — no toggle to find, no state to persist, and picking
up a different Unit folds the last one automatically ("maybe *is the
parent selected* is what decides if it's collapsed or not" — Noah). The
folded row still plots every Part placement as a hairline, because a
battleship that hides *whether it fires at all* would defeat the reason
you were lining tracks up in the first place. A four-turret Unit would
otherwise own most of the ruler permanently, which is what made stacking
several of them unreadable.

**Off-frame tracks** (a ground Unit while authoring Air, or vice versa)
collapse to the same bare hairlines regardless of selection — see
"Authoring frames" above.

**Play/scrub doubles as a live motion preview.** A Play button runs the
playhead forward in real time (looping back to 0 at the end) via
`requestAnimationFrame`; scrubbing manually does the same thing without
autoplay. At the current scrub time, `movementPreview.ts` computes each
visible unit instance's *actual* interpolated position — not just which
step is active, but where the unit is *between* steps, evaluating the
segment's bezier curve at `u = elapsed/duration` (see "Movement" above) —
and renders it as a small teal marker on the canvas, distinct from the
authored orange waypoint nodes. **A step's `pos` is a waypoint the unit
travels toward along a curve, not a place it teleports between** — this
is the sense in which the preview is genuinely new capability, not just a
retiming UI: you can now see whether an authored sequence actually reads
as intended motion, not just guess from where the dots happen to sit.
This preview is the editor's own approximation for authoring purposes —
there's no shared runtime to match yet (`games/shmup` has no enemy-movement
implementation), consistent with the editor's "no shared code with the
game" stance elsewhere.

**A step at the same position as its predecessor (dwelling), or a step
with no next waypoint at all, holds in place — it never moves in the
preview.** There's no principled destination to head toward in either
case, so the preview doesn't guess one; freezing is the only outcome that
can never look like the unit "keeps traveling after it reaches the final
node," which is the exact bug report that drove several iterations of
this feature (see "Movement" above).

### Placement settings (`StepPanel.tsx`, `PartActionPanel.tsx`)

**There are no per-placement field overrides anymore.** A prior pass had a
narrow whitelist of fields a placement could override on top of whatever
it referenced (`EncounterStep.speedMultiplier`, `EncounterAttack
.aimAngleOverride`) — both are gone now that the values they used to
override (pacing, aim) live directly on the shared, reusable Action
instead. A placement's own settings are now just *which* Action it
references and *when*:

- **`StepPanel.tsx`** — a step's `time` (a `Dial` when manually authored,
  a read-only readout when derived — see Timing above) and an **Action**
  picker listing the owning Unit's own `actions`, `"(none — holds
  position)"` for `null`.
- **`PartActionPanel.tsx`** (the "Part" tab) — an **Action** picker listing
  that Part's own `actions`, `time` (`Dial`), and a read-only computed
  **Duration** readout when the resolved Action carries an attack (see
  Timing above's `computeAttackDurationMs`). **Which Part is context, not a
  field**: it used to be a dropdown, back when placements were created by a
  🔫+ popup that made you pick a Part and left you able to reassign it
  afterwards. Now that every Part owns a visible lane and you select a
  placement *from* that lane, a control that could silently move it onto a
  different turret is a way to lose work, not a feature — retargeting means
  deleting the dot and adding one on the lane you meant. A Duration readout
  is absent for an Action with no attack, which is correct rather than an
  omission: a Part Action can legitimately be pure state.

Retiming, retargeting a different facing, or changing a fire pattern all
mean picking a different (or newly-authored, or Cloned) Action on the Unit
or Part — not typing a per-placement override.

### Canvas (`EncounterEditor.tsx`, `EncounterTileFrame.tsx`, `encounterSteps.ts`)

#### Touch targets on a zoomed canvas

**Every on-canvas control used to shrink with the zoom, because it lived
inside the stage's `transform: scale(zoom)`.** Measured on a 390x664 phone:
the authored 28px node controls rendered at **9.5px** at the fit-to-view zoom,
and 4.3px zoomed out — physically untappable. Worse, the five-button cluster
sat within ~5px of the stage's own top edge, and the old deselect rule treated
anything outside `.shmup-enemy-canvas-stage` as "tapped away". Simulating a
6px-sd aim error against the app's real handlers: **38% of taps hit the
intended button, ~40% did nothing, and ~16% silently deselected the unit** —
which is what made "reselect the enemy, then tap the scaling thing again" a
constant tax. After the changes below the same simulation gives **91–98% hits
and ~1% deselects**.

- **A selected step's control cluster renders in screen space**
  (`.shmup-enc-node-hud`), as a sibling of the transformed stage rather than a
  child of it, anchored at the node's viewport position
  (`selectedNodeHud = stagePos * zoom + pan`). Counter-scaling the cluster in
  place does *not* work: one uniform scale inflates the ring's *spread* along
  with the buttons, which pushes the outer controls past the viewport's clip
  edge and makes them unhittable. Screen space lets button size (28px) and ring
  spread (76px) be chosen independently, both in real pixels. The anchor is
  clamped by `NODE_HUD_MARGIN` so the whole cluster stays inside the canvas
  even for a node at (or panned past) an edge.
- **Because of that**, the node/handle/scaling drag handlers live on the
  **viewport**, not the stage: `beginDrag` calls `setPointerCapture` on the
  button it was fired from, so a HUD button's pointermove events bubble
  through the HUD and would never reach a handler bound to the stage. The
  viewport is the nearest common ancestor of both, and `toWorld` works off
  absolute client coords, so nothing else changes.
- **Single elements still counter-scale in place** against the stage's
  `--enc-counter-scale` custom property (`min(1 / zoom, COUNTER_SCALE_MAX)`),
  since one button has no ring spread to inflate: bezier/scaling
  `.shmup-handle-btn`s, the selected attack marker's ✕, and the selected node's
  own sprite (capped at 3x, so the unit you're editing stays visible under a
  cluster that is now much larger than it).
- **The deselect rule keys off `.shmup-enemy-canvas-viewport`, not the stage.**
  The stage is only as big as its content, so at a fit-to-view zoom it leaves a
  margin of visible-but-off-stage canvas that used to count as "outside".

Same tap-driven interaction model as earlier passes (tap a node to select
it, overlay quick-action buttons, a settings tab for the real fields — see
"Layout" below), simplified by the graph-to-array collapse: consecutive steps
within one instance render as an SVG `<path>` cubic-bezier command
(`resolveSegment`, `bezier.ts`) instead of a graph edge — there's nothing
to tap or delete on the connector itself, only its two endpoints' handles
to drag (see "Movement" above).

- **Handle drag targets are real HTML `<button>` elements**
  (`.shmup-handle-btn`, 22px), not SVG shapes — mirroring the ✥/+/✕
  node-control buttons (`.shmup-enemy-node__btn`) rather than the earlier
  SVG `<circle>` approach. SVG circles were unreliable to hit-test on
  mobile: the canvas SVG has a blanket `pointer-events: none` and only
  `<line>` had an override, so newly-added `<circle>` drag targets
  silently inherited `none` and were completely unclickable until a
  `pointer-events: all` override was added by hand. Rather than keep
  patching that pattern, handles were converted to HTML buttons —
  consistent with the rest of the canvas's tap-driven controls and a
  legitimate touch target on mobile. The SVG now only renders the dashed
  stalk `<line>`s connecting a selected step to its handle buttons.
- **Coordinate bug found and fixed while verifying the button
  conversion**: the screen→world pointer conversion (`onStagePointerMove`,
  used for both position-dragging a step and dragging a bezier handle)
  was missing the bounding box's `minX`/`minY` offset — it only inverted
  `PADDING`, not the `- minX + PADDING` / `- minY + PADDING` that
  `toStage()` actually applies. `minX`/`minY` are nonzero whenever
  anything in the instance's step layout sits left of or above the tile
  frame's own origin, which is the default case for a freshly-added Unit
  instance (staggered above the frame with negative Y). The bug silently
  corrupted drag targeting by exactly `minX`/`minY` and predates this
  pass — it also affected the pre-existing step position-drag handle, not
  just the new bezier handles. Fixed by a `toWorld(clientX, clientY)`
  helper that correctly inverts `toStage()`.

- **A newly appended step lands a fixed *screen* distance from its parent,
  continuing that instance's heading** (`nextStepPos`, called by
  `addNextStep`). `encounterSteps.ts`'s own `DEFAULT_NEXT_OFFSET` is a flat
  `TILE_UNIT` (720 world units) to the right, which is zoom-blind: at a
  phone's fit-to-view zoom that put the new node ~244px right inside a
  ~342px-wide canvas, so it landed off the visible edge more often than not
  and you had to pan around hunting for the thing you'd just created before
  you could drag it anywhere. Dividing `NEW_STEP_SCREEN_GAP` (76px) by the
  live zoom keeps it the same comfortable, always-visible distance at every
  zoom level. Direction follows the previous segment so appending extends a
  path rather than kinking it back toward +x; a lone first step has no
  heading yet, so "onward" is down-screen. `addStep`'s own flat default
  survives for callers (and tests) that don't care about the viewport.

- **`EncounterTileFrame.tsx`** is unchanged from the graph-based pass — a
  read-only dashed rectangle sized to the tile's real footprint, labeled
  with its actual edge tags, always present in the canvas's bounding box.
- **World scale (`editorScale.ts`)**: the tile frame's size (and every
  other world-coordinate default — a freshly-added step's offset from its
  predecessor, a Scaling shape's default handle positions) is driven by
  one shared `TILE_UNIT` constant, now `720` (was `130` — Noah: "weren't
  you going to make [tiles] much larger so units aren't half their
  size?"). `130` was never anchored to anything; each file that needed a
  "how far apart should this default be" number picked its own value by
  eye and hoped it stayed roughly in sync with the others, which is
  exactly how a 56px authoring icon ended up reading as ~43% of a 1x1
  tile's width. `720` is anchored to `games/shmup/src/config.ts`'s real
  `GAME_WIDTH` — a 1x1 tile now represents roughly one real screen's
  width, the same "tie the editor to real gameplay scale" reasoning
  `hitboxPreview.ts`'s camera-bounds overlay already applies. Everything
  that read the old local `TILE_UNIT`/`DEFAULT_NEXT_OFFSET`/scaling-shape
  defaults now imports this one constant instead
  (`EncounterEditor.tsx`, `encounterSteps.ts`, `unitScaling.ts`'s
  `createDefaultScaling()`); `ZOOM_MIN` dropped from `0.15` to `0.08` so
  the widest (3x1) footprint still fits on a narrow phone viewport at the
  new scale. Purely a "what number does new content start at" change —
  no data shape changed, so no `SAVE_VERSION` bump; an already-saved
  encounter's existing (small, old-scale) positions render unchanged,
  just now closer to the tile's corner than before until re-authored.
- **`encounterSteps.ts`** replaces the old `encounterGraph.ts` graph CRUD
  with pure array operations on one instance's `steps` list —
  `addStep`/`updateStep`/`moveStep`/`isFirstStep`/`isLastStep`/
  `deleteStepsFrom` (truncates the array from a given step to the end,
  the array equivalent of the old cascade-delete-a-subtree behavior).
  `encounterSteps.test.ts` covers all of these directly against arrays —
  no graph-traversal test helpers needed.
- **"+ Add Unit"** opens a picker of the Unit library (sprite thumbnails);
  picking one adds a new `EncounterUnit` instance seeded with one step
  (time 0, `actionId: null` — no Action chosen yet, see the Step tab's
  Action picker), staggered diagonally from any existing instances —
  position is staggered by default, time isn't; stagger a later instance's
  start time manually on the timeline if wanted.
- Each instance renders its own sprite (looked up by `unitDefId`) on every
  step, with the unit's name labeled under its first step. Step badges:
  ▶ marks the first step, 🛡️ marks a step whose *derived* invincible state
  (`actionState.ts`'s `resolveInvincibleAt`, see "Invincibility" above) is
  `true` (rendered with `.shmup-enemy-node--hidden` — dashed border,
  reduced opacity — so an invincible/teleport-out step reads as ghosted at
  a glance). No attack badge on steps for a Part-track placement — those
  render as their own markers, below (a step whose *own* referenced Action
  carries an attack has no separate badge either; its attack renders live
  in the E4 hitbox preview, anchored at the step's own position).
- **Part-Action placements render as separate markers**
  (`.shmup-part-marker`, smaller and differently colored than a movement
  waypoint — same "reads as secondary" reasoning as the live preview dot;
  the firing Part's own sprite when it has one, a ◈ fallback otherwise),
  positioned via `partActionAnchorWorld()` at wherever the instance's
  bezier path puts the Part at the placement's own time. Anchoring there
  rather than at a fixed spot is what makes them useful for timing — you
  see where a shot originates, not just that one exists. Selecting one
  shows a **+/✕** pair, the same append-and-delete controls a selected step
  gets (+ appends another placement on that same Part's track, at the
  playhead). No aim handle anymore, since aim lives on the referenced
  Action's own `facing` (see "Attacks" above).
- **Deleting the first step removes the whole instance** from the
  encounter (confirm-then-`removeInstance`) — same reasoning as the prior
  pass's entrance-node special case, just phrased in step-list terms.
  Deleting any other step truncates the array from that point on
  (confirm-then-`deleteStepsFrom`) when it would remove more than one step.
- **A tap on any `<button>` never triggers the canvas's outside-click
  deselect** — carried over unchanged from both earlier passes.

- **Pan/zoom (`EncounterMinimap.tsx`)**: the canvas is a fixed-size
  viewport (`.shmup-enemy-canvas-viewport`) showing a stage transformed by
  `translate(pan) scale(zoom)` — continuous zoom from `0.08` to `3`, well
  below a tile's own size so a whole large tile can be seen at once (the
  floor dropped from `0.15` when `TILE_UNIT` grew to match the game's real
  `GAME_WIDTH`: a 3x1 tile at 720/column needs roughly 0.145 to fit a
  ~380px phone viewport, leaving no headroom), matching
  `JigsawPuzzle.tsx`'s pattern rather than the discrete-step/native-scroll
  one NS Art uses. Zoom via on-canvas +/− buttons, ctrl/cmd+wheel toward
  the cursor, or two-finger pinch; one-finger drag on empty canvas
  background pans. A small minimap (bottom-left) shows the tile outline
  and every step position at a glance, with click/drag-to-pan. The
  viewport fits the whole stage on first mount (`fitToStageRect`, guarded
  by `didFitViewRef` to run once) and afterwards only ever refits when the
  Ground/Air toggle changes — air mode's subject is the camera box, which
  sits a whole tile-height below the tile and is completely outside a
  ground-mode fit. That refit is deferred into an effect keyed on the mode
  rather than done in the toggle handler, because the stage's bounding box
  only grows to include the camera box *after* the mode has changed;
  fitting inline would measure the old stage. Nothing else refits — the bug
  this replaced was the
  stage's own bounding box being recomputed every render from *content*,
  including whatever was mid-drag, so the coordinate frame shifted under
  the pointer while dragging a unit near an edge. The fix separates "world
  content" (`minX`/`minY`/`width`/`height`, derived only from **committed**
  positions — `scalingHandlesFor`'s live-drag override is explicitly
  excluded from this calculation) from "how you're viewing it" (`pan`/
  `zoom` state, applied as a pure CSS transform on the stage): dragging a
  unit never touches pan/zoom, and panning/zooming never touches unit
  positions.
- **Interactive controls layered over the pan/zoom arena must guard the
  arena's own `onPointerDown`.** The zoom buttons and minimap sit inside
  `.shmup-enemy-canvas-viewport` so their raw `pointerdown` bubbles to the
  arena's background-pan handler; if that handler unconditionally calls
  `setPointerCapture` on itself first, the control's own `onClick` never
  fires (pointer capture wins the gesture before the browser completes the
  click). `onArenaPointerDown` checks `e.target.closest("button, canvas,
  input, select")` and bails out immediately for a match, so any control
  that manages its own pointer events (the minimap already did via
  `stopPropagation`) is left alone.

### Layout: pinned timeline/viewport + tabs (`EncounterEditor.tsx`, `ShmupEditor.tsx`)

**Reworked after real usability friction — Noah's report: scrolling down
to a selected node's settings routinely scrolled far enough to trigger the
outside-tap deselect, so the settings disappeared right as you reached
them.** The original layout stacked everything in one long scrolling
column (toolbar, canvas, timeline, Add-Unit picker, Step/Attack/Scaling
panel, Save/Cancel) — fine on desktop, a trap on mobile.

- **`EncounterTimeline` + the canvas viewport live in one head**
  (`.shmup-enc-sticky-head`), stuck together as a single unit so the viewport
  doesn't need to know the timeline's own (variable, track-count-dependent)
  height to position itself under it.
- **The editor column is height-locked, and the tab panel is the only
  vertical scroller.** The head was originally `position: sticky; top: 0`,
  which never actually engaged: `.shmup-editor` sets `overflow-y: auto` and
  is therefore the head's nearest scrollport, while the element that really
  scrolls is `.standalone-page`, further out — and sticky only reacts to its
  own scrollport. Measured on a 390x664 phone, the "pinned" 421px head was
  entirely gone by 600px of scroll, so you ended up editing dials with no map
  on screen, while the page grew to ~1400px and two nested vertical scrolls
  fought over one gesture. Now `.standalone-page:has(.shmup-enc-fill)` (and
  the Doors 97 `.window__content` equivalent) hands the editor a definite
  height, the head is an ordinary non-sticky flex child that cannot scroll
  away, and `.shmup-enc-tab-content` is `flex: 1; overflow-y: auto;
  overscroll-behavior: contain`. `:has()` is a progressive enhancement —
  without it the chain falls back to the old content-height behaviour.
- **The ▲/▼ button at the right of the tab strip trades map height for panel
  height** (`panelExpanded`). Even height-locked, a phone can't give both a
  useful map and a useful panel: the head took 39% of the viewport and left
  the panel 35%, against Scaling panels that are taller than that. ▲ shrinks
  the map to a reference strip and lifts the panel to ~47% of the viewport;
  `embiggen` (below) is the same trade in the opposite direction. Deliberately
  a shrink rather than a hide — losing the map entirely is what the old
  scroll-the-page layout already did wrong.
- **Everything else is a tab**, not a stack: **Basics** (name, weight),
  **+ Add** (the Unit picker), **Step**/**Attack** for whichever node is
  selected, and **Scaling** for as long as *any* instance is selected.
  Scaling is deliberately not gated behind its ⚖️ canvas button any more —
  that button was a 9.5px target at a phone's fit-to-view zoom and being the
  only way in meant a near-miss (which usually deselected the unit) cost you
  the selection and the trip both. **The ⚖️ button is now gone outright**: a
  permanent tab made a second, tiny door onto the same panel pointless, and
  sitting top-centre it crowded the ✥ move handle it shared an edge with. The
  node cluster is four controls on four corners, nothing in between. `activeTab` is
  the single source of truth: `scalingPanelOpen` derives from it, so the tab
  strip and the canvas can't disagree about whether scaling handles are up
  (the old separate `scalingOpenFor` state is gone). A stale contextual tab
  (its node got deleted) falls back to Basics automatically via
  `effectiveTab`'s derivation, not extra cleanup code. "+ Add Unit"'s old
  toggle-button-plus-inline-picker collapsed into just the Add tab itself —
  selecting it *is* the toggle now.
- **Nothing in the editor may set a `z-index` on a flex child of
  `.shmup-enemy-form`.** A flex item with a z-index creates a stacking context
  even when statically positioned, and `.shmup-enc-sticky-head` carried one
  left over from its `position: sticky` days. That trapped the Embiggen
  fullscreen canvas (z-index 1000) *inside* the head, so its 1000 only ranked
  it against its own siblings — and the Save/Cancel footer (z-index 20, same
  level as the head but later in DOM order) painted on top of the fullscreen
  canvas, over the minimap and zoom buttons. Removing the head's z-index lets
  the fullscreen canvas out-rank the footer as intended.
- **"Embiggen"** (⛶, top-right corner of the viewport — same word Doors
  97's own window maximize button already uses) makes the viewport fill
  the screen (`position: fixed; inset: 0`) when half the screen isn't
  enough; tap again or press Escape to shrink back. Independent of the
  Doors 97 window's own maximize — this is about the canvas specifically
  still needing more room even in a maximized window on a small screen.
  The existing pan/zoom state (and the one-time `fitView`) carries over
  unchanged across the toggle; only the viewport's own CSS position/size
  changes.
- **The E4 hitbox-preview toggle moved from the old toolbar into a corner
  overlay** (⊡, top-left of the viewport, matching the zoom buttons/
  minimap's existing corner-overlay convention) — its Difficulty Dial only
  renders inline next to the button while the toggle is on.
- **Muted `.shmup-hint` explanatory paragraphs are gone from every panel**
  (StepPanel/PartActionPanel/UnitScalingPanel and the canvas's own top
  instruction paragraph) — Noah's "remove all the muted explanatory text,
  put instructions in the Help menu instead." `ShmupEditor.tsx` now
  registers a "Help" menu with two topics (Tile Editor, Encounter Editor),
  each opening a small modal with the consolidated tips. This Help menu is
  intentionally the *only* one: `ShmupEditorPage.tsx`'s `StandaloneWindow`
  used to carry its own separate `helpContent` (Tile-editor-only tips) —
  `StandaloneWindow` concatenates its own menus with a hosted app's
  `useWindowMenus` registration rather than replacing them the way Doors
  97's `Window.tsx` does, so keeping both would have shown two "Help"
  labels on the standalone route specifically. The Tile-editor tips moved
  into `ShmupEditor.tsx`'s own modal instead, and `helpContent` was
  dropped from `ShmupEditorPage.tsx`.
- **Numeric fields converted to `Dial`s wherever a plain number made sense
  as a drag/nudge/tap-to-type control** — Weight (Basics), Time (Step),
  Time (Attack), Spawn delay/V width/Grid width+depth/Ring radius
  (Scaling, alongside the Max count/Min cost Dials E3 already had). A
  step's `time` when derived (`timeDerived`) renders as a plain read-only
  `.shmup-readout` instead of a Dial, since a Dial has no disabled/
  non-interactive state and dragging it would silently do nothing — same
  treatment now given to an Attack placement's computed Duration readout
  (see "Timing" above), which was never a Dial to begin with. (The
  Actions-are-back pass, later, removed the Step tab's Speed-multiplier
  Dial and the Attack tab's Duration/Aim-override Dials entirely — see
  "Placement settings" above — so this bullet describes the mobile-UX-
  rework pass's state at the time, not every field listed here still
  exists as a Dial today.)
- **Save/Cancel + the validation error message are a sticky-bottom footer**
  (`.shmup-enc-footer`), always reachable regardless of scroll position or
  active tab — the same "don't make me scroll to reach the thing I need"
  fix applied to the other end of the screen.
- The outside-tap deselect effect's "was this click inside something that
  should keep the selection" check now includes `.shmup-enc-tabs` (the
  tab bar + content wrapper) in place of the narrower `.shmup-panel`
  check it used before tabs existed.

### Unit/Part/Action forms adopted the same tab + Dial treatment (`UnitStatsForm.tsx`, `PartEditor.tsx`, `ActionForm.tsx`)

**A follow-up pass ("give the rest of the UI the tab and knob treatment,"
Noah) — the Encounter editor's tabs/`Dial` conversion above didn't extend
to the Unit-authoring side when Actions came back, so those forms were
still one long scrolling stack of plain number inputs with `.shmup-hint`
paragraphs.** Reworked to match, same reasoning as the mobile-UX pass:

- **`UnitStatsForm.tsx`**: **Basics** (name/sprite/HP/contact damage/score
  value/speed/turn rate/hitbox size — all Dials except name/sprite —
  /layer/default-Action), **Actions** (the Unit's own buffet — list +
  inline `ActionForm`), **Parts** (list, Edit still navigates to the
  dedicated `PartEditor.tsx` view — a Part is a full sub-form in its own
  right, unlike an Action, so it doesn't fit inline). *Basics has since
  split into Stats + Visuals and lost the default-Action picker to the
  Actions tab — see "The Unit editor's Stats page shows the stats" below.*
- **`PartEditor.tsx`**: **Basics** (name/sprite/`PartPositionEditor` +
  Offset X/Y Dials), **Hitbox** (has-hitbox/damage-multiplier Dial/
  has-health/HP Dial), **Actions** (list + inline `ActionForm`, same as
  the Unit's own).
- **`ActionForm.tsx`**: **Basics** (name/facing/Movement %/Angle Dials),
  **State** (sets-invincible/requires-invincible), **Attack** (the
  Add/Remove-Attack toggle, and when present, every arc/count/spacing/
  sweep/burst/spawn field — all Dials except the enum selects). The live
  `ActionPreview` stays outside the tabs, above them, regardless of which
  tab is active — same "the animated preview is the first thing shown, not
  an afterthought" reasoning as before.

All three reuse the exact same `.shmup-enc-tabbar`/`.shmup-enc-tab-btn`/
`.shmup-enc-tab-content`/`.shmup-dial-grid` CSS classes `EncounterEditor.tsx`
already established — despite the `enc`-prefixed class names (a holdover
from when tabs were Encounter-editor-only), the markup and styling are
generic and were never actually scoped to that one view. **Every removed
`.shmup-hint` paragraph's content moved into the Help menu's new "Units &
Actions" topic** (`ShmupEditor.tsx`), alongside the pre-existing Tile
Editor/Encounter Editor topics — same "explanatory text lives in Help, not
inline" convention the Encounter editor's own tab pass established.

### The Unit editor's Stats page shows the stats (`UnitStatsForm.tsx`, `UnitMovementPreview.tsx`, `unitMovementPreview.ts`)

A later quality pass over the Unit editor specifically (Noah). The tab
pass above gave `UnitStatsForm.tsx` tabs, but its **Basics** page was
still a grab bag — a sprite picker sitting on top of six stat Dials, two
selects, and no picture of what any of it did.

**Basics split into Stats + Visuals**, and `defaultActionId` moved to
**Actions**:

- **Stats** — name, the live movement preview (below), Speed/Turn rate/
  Hitbox size Dials, HP/Contact dmg/Score Dials, Layer.
- **Visuals** — the `SpritePicker` alone today. It's its own tab because
  it's the seam every future "how does this Unit look" field lands on
  (per-Unit animation being the near-term one), and a tab that grows
  beats a stats page that slowly becomes two unrelated pages.
- **Actions** — the default-Action picker now sits at the top of this
  tab, directly above the buffet it picks from. It was only ever on
  Basics because that's where the plain `<select>`s happened to live; it
  is meaningless until the Unit has at least one Action.

**`UnitMovementPreview.tsx`** is the Stats page's counterpart to
`ActionPreview.tsx`: a 220px canvas in which the Unit laps a fixed demo
circuit forever, nose pointed along the curve.

**It is solved by the same `pathSolver.ts` an encounter uses** (see
"Turning" above), on a **route you pick** rather than one fixed shape
(Noah: "give me more options of routes to visualize... they should include
all the things a person might try to do"). No single shape asks a Unit
every question — a lap of a square says nothing about turning around, a
hairpin says nothing about holding a sustained curve — so
`unitMovementPreview.ts` carries a small catalogue, ordered easiest to
hardest, chosen from a dropdown under the canvas:

| Route | What it asks | Corners |
|---|---|---|
| Straight line | Corner to corner and back: nothing but a 180 at each end. | hard |
| Circle | One sustained curve — everything turns while moving, nothing stops. | rounded |
| Figure eight | Curves all the way round, reversing which way it turns halfway. | rounded |
| Diamond | Four identical 90s on the diagonals. | hard |
| Square | Four identical 90s with longer straights between them. | hard |
| Five-point star | Five 144° turns in quick succession. | hard |
| Bit of everything | Straights, two rounded corners taken under power, three hard turns and a 180 — the default. | both |

**Routes carry authored handles, not just positions.** A waypoint built by
`curved()` has the same `handleIn`/`handleOut` you get by dragging that
step's bezier handles on the encounter canvas; one built by `corner()` has
none. That distinction is the whole reason the rounded routes exist: without
handles every route is a polygon, and a Unit that can stop takes every
corner by halting and rotating — which made the preview imply a tank
couldn't corner under power at all (Noah: "a tank *can* turn while driving,
but the Unit editor makes it seem impossible"). On the circle, *every*
Unit sweeps continuously and nothing pivots anywhere; on "bit of
everything" a tank pivots at four waypoints and sweeps through two.

Fixing that turned up a real solver bug rather than just a preview one: for
a pivot Unit, `solvePivotPath` derived the *arrival* heading from the chord
even when the waypoint carried an authored handle, while building the
segment itself against the handle. A tank on a hand-curved path was
therefore billed a phantom pivot at every such waypoint and visibly snapped
round mid-curve. The override now governs both headings, which is what
dragging a handle means: carry your speed through here.

Each route declares its own **`viewRadius`** rather than sharing one zoom:
the shapes have genuinely different extents, and a route that fills only
the middle third of the canvas wastes resolution where the interesting part
is. It is fixed per route and never fitted to the solved path — auto-fitting
would rescale the picture as you turned a dial, making the very change
you're looking for impossible to see. A test pins that every route stays
inside its own view for a pivoter, a jet and a battleship alike.

The selected route is remembered at module scope for the session, because
the Stats tab remounts whenever you open a different Unit and snapping back
to the default is exactly wrong when the reason you switched Units was to
compare two of them on the same shape. It is a view preference, so it is
deliberately not persisted into `UNITS.DAT`.

That's the whole value of it — the Stats tab isn't illustrating the
numbers, it's rehearsing them:

- A Unit that can stop drives every leg dead straight and visibly
  **pauses to rotate** at each corner, for longer at the sharper ones (a
  30°/sec tank spends 6s on a 180, 3s on a 90).
- A Unit that can't stop **swings wide** through the corners it can't
  make, on a curve that never bends tighter than its turning circle.
- Dragging Min speed from 0 to anything above it switches the Unit between
  those two behaviors on screen, which is the fastest way to understand
  what the stat does.

A lap is a *timed* schedule rather than a distance sweep, because a pivot
is a pause: each leg costs its pivot plus its travel, and travel is the
solved arc length ÷ the speed that leg's tightest bend allows — the same
rule `encounterTiming.ts` times a real encounter with. The caption carries
what the picture can't ("53.3s per lap · pivots corners (up to 6.0s)", or
"15.5s per lap · turns no tighter than 83").

Two rings are drawn: the **hitbox** at true scale against the path, with
the sprite over it at `size × 3` (mirroring games/shmup's
`TUNING.encounters.artToHitboxRatio`, and rotated by the same nose-up
`ART_FACING_DEG` convention `spriteScale.ts` uses — both copied
constants, since `spriteScale.ts` pulls in the game-only `TUNING`), and
the **turning circle**, in a different colour and dash rhythm so two
dashed circles don't read as one shape.

Distance accumulates from a per-frame clock rather than being recomputed
as `speed × elapsed`: identical at a constant speed, but only the
accumulating form keeps the Unit where it is while a dial is being
dragged instead of teleporting it around the loop.

### Sprites (`enemySprites.ts`, `SpritePicker.tsx`)

Mirrors `tileImages.ts`'s built-in-plus-custom-upload structure exactly.
Built-in set: a body-split-from-turret Parts-demo pair (armored truck,
battle tank) Noah supplied directly, plus a growing "incoming" vehicle
batch, a curated projectile set, and a 93-piece doodad set of top-down
scenery props (see `public/shmup-editor/enemies/README.md`,
`public/shmup-editor/projectiles/README.md` and
`public/shmup-editor/doodads/README.md` for sourcing/processing details)
— every built-in is a single static pose, no animation frames.
Processing is a one-time Jimp-based script per batch that chroma-keys real
alpha transparency in, trims to content, and pads to a square icon.

The doodad batch (`scripts/prepare-doodads.mjs`) differs from the earlier
scripts in two ways worth knowing before adding art like it. Its eight
contact sheets have no cell borders to measure, so per-prop boxes are
derived from the art by `scripts/doodadSegment.mjs` (band-splitting on runs
of empty rows/columns, so a deliberately scattered prop like a pebble field
or a run of bollards stays one sprite instead of shattering into a dozen)
rather than hand-listed like `prepare-projectiles.mjs`'s `SHEET_CELLS`. And
it keys every magenta pixel wherever it sits, not just what an edge flood
fill can reach, because several props are meshes whose holes show the
backdrop through them — camo netting, the fenced rooftop — which a flood
fill leaves as magenta confetti baked inside the sprite. The key is a soft
one that un-mixes the backdrop's contribution out of partially-covered edge
pixels, measuring contamination as red-and-blue-in-excess-of-green rather
than as distance from the backdrop color; a distance threshold wide enough
to catch the real halo also swallows every neutral gray rock on the sheets. Custom upload reuses the same
`paletteQuantize.ts`/`indexedPng.ts` pipeline as tile art, generalized in
`imageUpload.ts` into `decodeUpload`/`canvasToIndexedPngDataUrl` helpers
shared by both `loadTileImageFile` (cover-fit crop, opaque — fills a whole
square) and `loadSpriteImageFile` (**contain**-fit, transparent surround —
a sprite must stay fully visible against a see-through background rather
than being cropped to fill a square). An animation preview (idle/move/
attack/die frames) is deferred — see `shmup-editor.todo.md`'s Remaining
list.

### Persistence

An encounter is saved as part of its owning tile — `TileDef.encounters` is
a plain field inside `TILES.DAT` (`tileStore.ts`). `encounterValidation.ts`
validates the placement shapes an encounter actually saves —
`isEncounterStep`/`isPartActionPlacement`/`isEncounterUnit`/`isValidEncounter`
— which are just `actionId: string | null` plus string references
(`partId`) plus plain numbers/`Vec2`s, no nested definition data. The
Unit-owned *definitions* those references point at (`UnitPart`/
`ActionDef`) validate in `unitStore.ts` instead, since Units are what own
Parts (and Actions) now: `loadUnits`/`saveUnits` validate `parts[]` and
`actions[]` (`isUnitPart`/`isActionDef`/`isActionAttack`/
`isCollisionGroup`/`isValidUnitDef`) before trusting a saved library — no
recursion needed either, since `ActionAttack.spawnUnitId` is a plain
string reference rather than a nested `BulletDef`/`AttackPayload`
structure. There's no separate encounter library or file.

The timeline scrubber pass changed `EncounterStep`'s shape (`trigger` →
`time`) and `AttackPayload`'s (dropped `onProximity`/`proximityRadius`) —
both non-additive changes, so `tileStore.ts`'s `SAVE_VERSION` (2→3),
`unitStore.ts`'s `SAVE_VERSION` (3→4), and `unitStore.ts`'s
`TILE_SESSION_VERSION` (1→2) all bumped, so a pre-scrubber save/session
resets to empty on load rather than silently carrying the old shape (same
"corrupt or stale-shape save falls back to a safe default" pattern as
everywhere else in this app — no migration code needed, the version
mismatch alone triggers the existing fallback). The scrub head position
and play/pause state are **not** part of any saved draft — they're a
viewing aid, not authored content, so a reload resets the playhead to 0
rather than needing to survive it (unlike the actual steps, which do).

The follow-up pass that made `time` mostly derived (Timing, above) did
**not** need another version bump — `EncounterStep.time` and
`speedMultiplier` kept the exact same field names and types (`number`);
only what *computes* them changed, which is pure runtime behavior, not a
save-file shape change.

The bezier-curve movement pass (Movement, above) **did** need version
bumps, being genuinely non-additive: `UnitDef.baseSpeed` was renamed
`speed` (plus turning stats), `ActionDef` lost its `movement` field
entirely, and `EncounterStep` gained `handleIn`/`handleOut`. `unitStore.ts`'s
`SAVE_VERSION` (4→5) and `TILE_SESSION_VERSION` (2→3), plus `tileStore.ts`'s
`SAVE_VERSION` (3→4), all bumped for the same "reset rather than silently
carry a mismatched shape" reason as every prior bump.

The Parts/Weapon-track pass (Attacks, above) bumped every version again
for the same reason, being the most non-additive change yet: `ActionDef`
lost `attack` entirely, `UnitDef` gained `parts: UnitPart[]`,
`EncounterStep` lost `aimAngleOverride` (moved to `EncounterAttack`), and
`EncounterUnit` gained `attacks: EncounterAttack[]`. `unitStore.ts`'s
`SAVE_VERSION` (5→6) and `TILE_SESSION_VERSION` (3→4), plus
`tileStore.ts`'s `SAVE_VERSION` (4→5), all bumped. `UnitEditSession` also
gained `activePart: UnitPart | null`, mirroring `activeAction` one level
down (see the `PART-EDIT`/Weapon note below) — the same version bump
covers this, since it's the same file/shape.

The visual authoring pass (above) bumped `unitStore.ts`'s `SAVE_VERSION`
again (7→8, for `UnitPart`'s new `spriteId`/`customSprite`), and cutting
Actions entirely (the fifth pass) bumped every version one more time:
`UnitDef` lost `actions: ActionDef[]`, `EncounterStep` lost `actionId` and
gained `visible: boolean`, and `UnitEditSession` lost `activeAction`
entirely. `unitStore.ts`'s `SAVE_VERSION` (7→8) and `TILE_SESSION_VERSION`
(4→5), plus `tileStore.ts`'s `SAVE_VERSION` (5→6), all bumped.

**Actions coming back (the sixth, current pass) bumped every version
again — the mirror image of the fifth pass's bump, being just as
non-additive.** `EncounterStep` dropped `visible`/`speedMultiplier` and
gained `actionId: string | null`; `PartActionPlacement`
(`encounterTypes.ts`) replaced `EncounterAttack` entirely (dropping
`weaponId`/`durationMs`/`aimAngleOverride`, gaining `actionId`);
`WeaponDef` is gone from `unitTypes.ts`, folded into `ActionDef.attack`;
`UnitPart` gained `hasHitbox`/`hasHealth`/`hp`/`damageMultiplier`;
`UnitDef` gained `layer`/`defaultActionId`/`actions: ActionDef[]`.
`unitStore.ts`'s `SAVE_VERSION` (8→9) and `TILE_SESSION_VERSION` (7→8),
plus `tileStore.ts`'s `SAVE_VERSION` (8→9), all bumped for the usual
"reset rather than silently carry a mismatched shape" reason — a
pre-reversal save simply doesn't have a shape any of this pass's code
expects.

Two more fsStore files alongside `TILES.DAT`/`UNITS.DAT`, same folder
(`C:\Programs\Accessories\Shmup Editor\`), for root `CLAUDE.md`'s mandatory
in-progress-session-survives-reload rule — a half-built tile/encounter or
unit/part is a much bigger loss on an accidental mobile reload/rotation
than E1's original tile-form draft gap:

- **`UNIT-DRAFT.DAT`** (`unitStore.ts`'s `loadUnitDraft`/`saveUnitDraft`) —
  a `UnitEditSession { unit, activePart }`: the Unit stats form currently
  being edited, plus whichever single Part is mid-edit (if any), mirroring
  the tile/encounter session shape one level down. `UnitStatsForm` and
  `PartEditor` both bubble every field change up via `onDraftChange` (a
  `useEffect([draft])` in each), so navigating from the Unit form to the
  Part editor and back doesn't lose in-progress edits on either side —
  each form unmounts while the other view is showing. **Neither a Unit's
  nor a Part's own Actions get a session slot of their own** —
  `UnitStatsForm`/`PartEditor` both edit their own `actions` inline
  (expand-in-place via `ActionForm`, live two-way bound into the owning
  form's draft state), the same "no separate Save/Cancel flow" shape the
  original inline `AttackPayloadForm` always had, just now organized as a
  list instead of one checkbox-gated block. `UnitEditSession` still only
  tracks `{ unit, activePart }` — no `activeAction` field exists, even now
  that Actions are back, for the same reason.
- **`TILE-DRAFT.DAT`** (`loadTileSession`/`saveTileSession`) — the *whole*
  tile-editing session: the tile currently being edited (name, edges,
  image, and its `encounters` list as saved-so-far) **plus** whichever
  single encounter is mid-edit, if any, since that encounter's own draft
  hasn't been merged into the tile's `encounters` array yet. `TileEditorForm`
  bubbles every field change up via `onDraftChange` (simplest done via a
  `useEffect([draft])` rather than touching every individual `setDraft`
  call site) specifically so navigating to the Encounter editor and back
  doesn't lose in-progress tile-level edits — `TileEditorForm` unmounts
  while a different view is showing, so anything not yet bubbled up would
  otherwise be lost. On mount, `ShmupEditor.tsx` checks for a saved
  session (checking `UNIT-DRAFT.DAT` first, then `TILE-DRAFT.DAT`) and
  resumes silently into whichever of the four views (unit-edit, part-edit,
  tile-edit, encounter-edit) the session was left in.
  Position drags on the Encounter canvas are the one exception to "write
  on every change" — a drag updates only local component state, committed
  to the session once on release, not on every pointer-move frame.

Both new files are seeded for new installs (`filesystem/seed.ts`) and
backfilled for existing sessions (`FileSystemStore.ts`'s `migrate()`), same
as `TILES.DAT`.

## Per-instance scaling (E3)

**Corrected mid-flight — the first pass built this wrong.** An initial cut
of E3 modeled "spawn nodes" as a standalone concept (`SpawnNodeDef`) living
parallel to `EncounterUnit`, with its own origin/marker/picker on the
canvas — a second, competing way to populate an encounter. Noah's
correction, against the original "Design Handoff v2" doc's actual §6: you
place a Unit and author its behavior with the **existing** step/attack
timeline exactly as before (unchanged by E3 at all); Scaling is **a tab/
section on that already-placed instance**, not a new kind of thing. The
standalone-spawn-node code was deleted outright, not kept around unused —
see git history if the earlier shape is ever relevant. This section
describes what actually shipped after the correction.

**`EncounterUnit` gained a `scaling: UnitScaling` field** (`unitScaling.ts`)
— every placed instance has one, always, at `maxCount: 1` (a no-op) by
default. Opening the Scaling tab doesn't create anything new; it edits a
field that was already there. A duplicate produced by scaling **replays
the instance's entire step/attack sequence independently, anchored to its
own slot** (convoy-style) — this file only computes *where* the slots are
and *how many* there are, never behavior.

**One scaling mechanism, not several — condensed down from an earlier
over-build, then simplified again after worked examples exposed a second
bug.** The first pass over-built a `flat`/`linear`/`capped`/`stepped`
curve-type picker (`spawn-and-warnings.spec.todo.md` §1's broader vision)
onto the wrong data model; condensing that down to one mechanism still
left a `powerSplit` (0-100%) field splitting incoming Difficulty between
count and power as two separate currencies, plus a `minCount` floor.
Worked examples from Noah exposed that `powerSplit` silently discarded
budget once `maxCount` saturated (e.g. a 4-instance cap at 5 Difficulty/
instance with 50 incoming Difficulty should give each instance the whole
remaining share, not just its own 5) — and that the true floor for count
is simply zero (an unaffordable instance doesn't spawn at all, which
doubles as elite/late-game gating with no separate system needed). Both
fields were removed. **Current algorithm** (`resolveScaling()`,
`unitScaling.ts`): a single incoming Difficulty value spreads evenly, not
split by any weighting field —
`count = min(floor(D / cost), maxCount)`, floored at 0, then
`power = floor(D / count)` — the *whole* remaining Difficulty divided
evenly across however many instances actually spawned (not each
instance's own cost), rounding in the player's favor. No curve-shape
choice anywhere. `power` is a representative preview number only, same
"no shared runtime yet to match" caveat `ActionPreview.tsx` already
documents for its own approximations — retrofitting real per-param curves
onto Unit/Action stats stays out of scope (see `shmup-editor.todo.md`).
`maxCount` is authored via `Dial` (`src/components/Dial/`), a reusable
FL-Studio-style vertical-drag knob component — right-click or long-press
to reset, tap the value to type a number directly, optional +/- nudge
buttons — built for reuse across Doors 97, not scoped to this editor.

**`cost` moved off this per-placement panel and onto the Unit itself**
(Noah: "I want to shift cost from the encounter to the unit. Encounters
shouldn't be able to spawn a stupidly powerful unit just because the cost
is set too low there... [so] we don't have to manually balance EVERY
encounter against each other"). `UnitScaling.minCostPerInstance` is gone;
`UnitDef.cost` (`unitTypes.ts`), authored on the Unit Stats page next to
HP/contact damage/score, is what `resolveScaling` reads now — a Unit's
Difficulty budget is set once and every Encounter that places it inherits
the same number, instead of each Encounter author setting (and
potentially under-pricing) it independently. The Scaling panel
(`UnitScalingPanel.tsx`) shows the owning Unit's cost read-only, next to
the count/power readout it feeds, rather than authoring it. This is a
required-shape change, not a purely-additive one, so it bumps
`SAVE_VERSION` in both `tileStore.ts` and `unitStore.ts` (and the game's
matching `AUTHORED_TILES_VERSION`/`AUTHORED_UNITS_VERSION`) — same
"reset rather than silently carry a mismatched shape" precedent as every
prior `EncounterUnit`/`UnitDef` shape change in this file's version-bump
comments.

**Positioning shape has real draggable canvas handles, not number-only
fields** — per §6/§8.2, `ScalingShapeKind` is `curve`/`v`/`grid`/`ring`,
each with its own handle set (`unitScalingShapes.ts`'s `resolveScalingSlots`
is the pure, unit-tested geometry):

- **Curve** — a variable-length polyline through `curvePoints` (add/remove
  via panel buttons) ending at `curveEnd`, each an offset from the
  instance's own position — unifies straight line (zero intermediate
  points), arc, and S-curve as one primitive, per spec. Slots are placed at
  even arc-length intervals along the whole polyline.
- **V** — the instance's own position is the point/apex (fixed, per spec:
  "original position becomes the V's point"); a single draggable `vTip`
  handle sets the far end, `vWidth` (a panel field) sets how wide the two
  arms spread at that end. Slots distribute symmetrically outward from the
  apex, one arm each side.
- **Grid** — two draggable handles (`gridWidth`/`gridDepth`, one on each
  axis from the instance's own centered position) size a block/rank
  formation; slots pack into the resulting rows/cols.
- **Ring** — a draggable `ringCenter` handle (defaults to the instance's
  own position, per spec) plus a draggable `ringRadius` handle at distance
  `ringRadius` from it; slots distribute evenly around the circle.
- All four are **offsets from the instance's own first-step position**, not
  absolute world coordinates — same convention `EncounterStep.handleIn`/
  `handleOut` already use, and what lets `createDefaultScaling()` produce
  sensible handles regardless of where the instance ends up placed.
- **Ping-pong**: mirrors the whole resolved slot set across the owning
  tile's own center axis, free, no extra authoring — a `pingPongOverride`
  (a draggable ⟷ handle, world-space X) is the narrow, only-shown-when-
  relevant override for an intentionally asymmetric mirror, same "override
  whitelist" pattern as a step's `speedMultiplier`.
- Only the instance's own `scaling.shape`'s handles render at once — per
  §8.2, "extra draggable handles... appear contextually only while editing
  the relevant... Action," not all four shapes' handles simultaneously.

**Surfaces** (`EncounterEditor.tsx`, `UnitScalingPanel.tsx`) — everything
lives on the same canvas/panel area steps and attacks already use, no new
view:

- Each instance's **first step** gains a 5th control button, **⚖️**
  (top-center — the existing move/add/attack/delete buttons occupy the 4
  corners, and a lone single-step instance is simultaneously first *and*
  last, so top-right is already claimed by "+"). Tapping it toggles that
  instance's Scaling tab: the panel area below the canvas swaps `StepPanel`/
  `PartActionPanel` out for `UnitScalingPanel`, and that instance's shape
  handles appear on the canvas (selecting the instance's first step under
  the hood, so the existing `selectedInstance`/`selectedUnitDef` plumbing
  stays coherent). A ⚖️ badge on the node itself (alongside ▶/🛡️) marks any
  instance whose `maxCount > 1`, so scaling-enabled instances are
  identifiable without opening the tab.
- **Ghost slot dots** (`.shmup-scaling-ghost-dot`, dim, non-interactive)
  preview where duplicates would actually land, computed live from
  `resolveScalingSlots`/`applyPingPong` at the panel's own **preview
  Difficulty slider** (0-100, editor-preview-only — no live `D` at
  authoring time) — dragging the slider updates the canvas ghost count in
  the same frame as the panel's numeric readout, both driven by the one
  `resolveScaling()` call. This is scoped to one instance's own slider,
  static (not tied to the timeline scrubber) — good for shaping a single
  instance's positioning shape in isolation. E4's "Hitbox preview" toggle
  (see below) separately ships an actual **encounter-wide** Difficulty
  slider driving every scaled instance in the encounter at once, live at
  the current scrub position — the two sliders are independent and serve
  different moments of authoring (shaping one instance's shape vs.
  sanity-checking the whole encounter's readability).
- **Count range fields gate the *group* fields only.** `maxCount > 1` reveals
  spawn delay/shape/ping-pong — the things that only mean something for a set
  of duplicates. **Max count, Cost each, and the resolved readout are always
  present**, whatever `maxCount` is. Cost used to be gated too, which hid the
  single most important budget property in exactly the case that needs it most:
  a lone expensive instance. Difficulty is one currency spent top down — a tile
  splits its budget across what it spawns, and an instance whose cost exceeds
  its share doesn't spawn at all — so cost is what gates a miniboss out of early
  runs and into the endgame, with no separate difficulty-range system. The
  readout says **"Priced out — nothing spawns at this Difficulty"** when the
  resolved count is 0, which is the authoring feedback that gating depends on.

- **The reveal is structured so it doesn't shuffle the controls around it.**
  Noah's report: "some dials cause other dials to appear suddenly — if spawn
  number goes from 1 to >1 everything jumps around." Measured, turning it on
  grew the panel 127px → 406px and 4 → 16 controls, and switching positioning
  shape displaced Ping-pong / Difficulty / the readout by 68px each. Three
  changes, no behaviour lost:
  - **`Max count` sits alone in its `.shmup-dial-grid`.** It used to share a
    wrapping flex row with Min cost / Spawn delay, so enabling scaling could
    re-flow the very dial you were touching.
  - **Everything gated behind `maxCount > 1` is one labelled section**
    (`.shmup-scaling-more`, headed "Group of N") rather than ~12 controls
    materialising inline at assorted depths — the reveal reads as a section
    opening below the dial you just turned.
  - **The shape-specific dials live in a fixed-height slot**
    (`.shmup-scaling-shape-slot`, one dial-row tall). Curve/V/Grid/Ring need
    0/1/2/1 dials respectively, so reserving the tallest means changing shape
    now displaces **nothing** below it.

  Combined with the height-locked layout (the panel is its own scroller at a
  fixed size), the panel container itself no longer grows at all on reveal:
  only its scroll content changes.

- **The canvas side of scaling was effectively invisible, and is now legible.**
  Noah: "they initialize really far away (just like movement handles used to)…
  only the curve type actually looks accurate at all. they're not intuitive."
  Four separate causes, all measured on a 390x664 phone:
  - **The ghost preview defaulted to showing nothing.** Ghost slots render
    `resolveScaling(scaling, previewDifficulty).count` positions, and
    `scalingPreviewDifficulty` started at **0**, which resolves to a count of 1.
    Enabling scaling and picking a shape drew a single dot until you found the
    Preview Difficulty slider at the bottom of the panel. It now starts at the
    ceiling, so the full group is visible while you shape it.
  - **Ghost dots and stalk lines were sized in stage units**, so they shrank
    with the zoom exactly like the buttons did: a 10px dot rendered at 1.75px,
    and the 1.5px/2px SVG strokes at 0.26px/0.35px. Both are counter-scaled
    against `--enc-counter-scale` now.
  - **Defaults spanned more than a whole tile** (`curveEnd` 1.1x TILE_UNIT,
    `gridWidth` 1.2x, `ringRadius` 0.75x — the ring put 2 of 6 slots off the
    visible canvas), so the first thing you did was pan hunting for handles.
    Roughly halved (see `createDefaultScaling`) to ~0.6 tile, which is ~75px of
    canvas at a phone's fit zoom: readable as a shape, and every handle on
    screen. A third of the old size was tried first and is too cramped to read.
  - **Only Curve's handles sat on the shape.** V offered a single handle at the
    midpoint of its open end — a dot on no part of the shape — with its width a
    dial having no canvas presence at all; Grid used two edge-midpoint handles.
    Every shape's sizing handle now lands exactly on a real ghost slot: V gained
    an arm handle at the open end's corner (`vArmPos`, deliberately the same
    construction `vSlots` uses for its extreme parameter) alongside the tip, and
    Grid's two edge handles became one corner handle driving both dimensions.
    Curve's end and Ring's radius already coincided with their first/last slot.
  - **Ring has exactly one handle, the radius; its centre is always the
    instance's own position.** `ringCenterOffset` is gone from the model
    entirely (editor and runtime), not just hidden: it defaulted to {0,0}, which
    put its handle underneath the unit's own sprite where it could never be
    grabbed, and a ring centred on anything other than the unit was never
    actually wanted. Dropped from both validators rather than version-bumped, so
    saves still carrying the key keep loading — an extra property is harmless.

- **The step-control cluster is hidden while the Scaling tab is open**, and
  scaling handles paint above unit sprites (`z-index` on `.shmup-handle-btn`).
  Both are the same collision: a scaling shape starts right next to the
  instance, so the four-button cluster sat directly on top of the handles you
  opened the tab to drag — and the ring's centre handle, which defaults to
  exactly the instance's own position, was completely buried under the node
  sprite that shares it, i.e. permanently ungrabbable.

**Persistence**: `EncounterUnit.scaling` is a **required** field validated
strictly (`encounterValidation.ts`'s `isUnitScaling`) — not treated as a
purely-additive optional one, same precedent as the Parts/weapon-track pass
bumping versions when `EncounterUnit` gained `attacks`. `tileStore.ts`'s
`SAVE_VERSION` (6→7) and `unitStore.ts`'s `TILE_SESSION_VERSION` (5→6) both
bumped — a pre-E3 encounter unit is genuinely missing required scaling
fields, not one optional one, so a stale save resets rather than being
partially backfilled. Scaling edits ride along inside the existing
`TILE-DRAFT.DAT` session for free (just another field on the `EncounterUnit`
object already bubbled up via `onDraftChange`) — no new stable FS id or
session slot needed, and no new saved draft state for the panel's own
preview-budget slider (ephemeral, same as the timeline's scrub/play state).

## Low-fi hitbox/boundary preview (E4)

**Editor-side timeline playback layered on the scrubber E2 already
shipped — not a new playback engine, and not real Phaser.** `hitboxPreview.ts`
+ a "Hitbox preview" toggle button (⊡, a corner overlay on the canvas
viewport itself — see "Layout" above; originally a toolbar button before
that toolbar was removed) swap the canvas's touch-friendly authoring
icons (56px sprite thumbnails, sized
for tapping, not real scale) for reference geometry at the current
`scrubTime`, so "does a full-count line still fit the tile and still read
clearly" is something to actually look at rather than infer from numbers
(the goal `spawn-and-warnings.spec.todo.md`'s original design doc named
for this feature).

**What renders, at the current scrub position**:
- **Enemies** — a box per live instance (and per scaled duplicate, at its
  own slot's live position — see below), sized to the Unit's real `size`
  (its hitbox radius), not the big authoring icon. **Colour-coded by
  frame**: red for ground/doodad, amber for air. At real hitbox scale the
  two are otherwise identical rectangles, and they behave completely
  differently once the level scrolls — one rides the terrain off the
  bottom, the other pins to the screen (see "Authoring frames" above).
- **Bullets in flight** — a red dot per bullet, reusing `actionPreview.ts`'s
  actual per-shot math (`shotAngleOffsets`, `sweepOffsetDeg`,
  `PREVIEW_BULLET_SPEED`, `PREVIEW_BULLET_LIFE_MS`) via
  `hitboxPreview.ts`'s own `computeAttackBullets`. This is **not** the same
  orchestration as `ActionForm.tsx`'s standalone preview: that preview
  loops a single-burst attack forever (`PREVIEW_LOOP_FALLBACK_MS`) so it
  keeps demonstrating itself while you're just browsing the picker, which
  would make every attack look like it fires forever here — exactly the
  density/fairness misread this preview exists to catch. `computeAttackBullets`
  instead fires an Action's attack exactly as authored: once when the
  Action's *computed* duration (`computeAttackDurationMs`, see "Timing"
  above) resolves to `0`, otherwise repeating every `burstIntervalMs` only
  while still within that computed duration (or forever, for an
  indefinite/`null` duration — a Final Action). Rendered for both a base
  Unit's own currently-active-step attack (anchored at the instance's own
  live position) and every Part-track placement's attack, independently.
  Bullet size is the attack's `spawnUnitId`'s own real `size`
  (`resolveBulletRadius`), falling back to a documented default (6px) when
  it doesn't resolve.
- **Player reference** — a green circle, radius 6, documented against
  `games/shmup/src/tuning/index.ts`'s real `TUNING.combat.hitboxRadiusNormal`
  (independently maintained, not imported — same "no shared code with the
  game" stance the rest of the editor takes). It **moves with the scrub**,
  via the game's own shared scroll model (`computePlayerRefLocalY` is
  `scrollModel.ts`'s `playerTileLocalY`): the ship holds a fixed screen
  position while the tile scrolls past it, so in tile-local terms it climbs
  the tile from below. An earlier revision of this doc described it as a
  static marker 85% down the tile — that predates the scroll model, and a
  static marker was only ever one frame of the truth. Still not *simulated*
  or draggable: where the ship is at a given moment is known, where the
  player chooses to be is not. A `facing: "facePlayer"` Action's bullets aim
  at this marker (`resolveActionFacingDeg`) — a real improvement over
  `ActionForm.tsx`'s isolated preview, which has no reference point
  available at all while just browsing the picker. A `facing:
  "faceMovement"` Action's bullets aim along the instance's real,
  currently-live direction of travel instead
  (`movementPreview.ts`'s `computeInstanceHeadingDeg`) — also a real
  improvement over the isolated preview's fixed stand-in direction, since
  this preview has an actual path to differentiate.
- **Tile bounds** — a thick yellow border on the tile's real footprint
  (the same rectangle `EncounterTileFrame` already outlines, just louder).
- **Camera/playable bounds** — a dotted border showing "how much of the
  tile is visible on screen at once", which like the player marker **tracks
  the scrub** (`computeCameraBoundsRect` reads `cameraLocalBand(t)`): the
  band of tile-local y on screen climbs the tile as the level scrolls. The
  camera is always one screen wide however wide the tile is
  (`cameraLocalXBand`), so on a 2- or 3-wide tile the outer columns are
  genuinely never on screen at once. Height comes from
  `games/shmup/src/config.ts`'s real 720x1280 portrait aspect ratio. What
  it still does **not** do is animate/ease the way the real playable-bounds
  box does when a level transitions between wider and narrower sections
  (§4) — that easing is L2 work that doesn't exist yet. In Air mode this
  same rectangle is the fixed frame everything else moves against, and is
  drawn solid rather than dotted (see "Authoring frames").

**Scaled duplicates render for real, using an encounter-wide Difficulty
slider — the previously-deferred §8.3 slider.** The toggle reveals its own
Difficulty slider (0-100, independent of the per-instance Scaling tab's
own preview slider above) driving `resolveScaling()`/`resolveScalingSlots()`/
`applyPingPong()` for **every** scaled instance in the encounter
simultaneously. Duplicates replay the exact same step/attack sequence
anchored to their own slot, same model E3 already established, just
evaluated live instead of as static ghost dots.

**`spawnDelayMs` actually staggers duplicates now — it used to be a
stored-but-never-read field, so every duplicate appeared to spawn
simultaneously regardless of its value (Noah caught this: "everything
spawns simultaneously instead of individually").** Fix: slot index `N`'s
own local clock (the same authored step/attack `time` values every
duplicate shares) is offset from the shared `scrubTime` by `N *
spawnDelayMs`, so `computeInstancePreview`/`partActionAnchorWorld` — which
only ever read local/authored time, never global time — evaluate each
duplicate at its own correctly-shifted instant. Before its own delayed
spawn instant, `computeInstancePreview` returns null the same way it
already does for the base instance before its first step's time, so a
not-yet-spawned duplicate simply doesn't render — no separate "hasn't
spawned yet" check needed. Duplicates' attacks shift the same way.

**Explicitly not built** (`shmup-editor.todo.md` tracks these as
Remaining): chaining multiple tiles via L1's edge-matcher to preview a
generated sequence (blocked on L2's JIT-streaming system existing first);
surfacing L6's warning-indicator lead times (L6 isn't built anywhere yet);
an actual animated/scrolling camera simulation.

No persistence — `hitboxPreviewOn`/the encounter-wide Difficulty slider
are ephemeral viewing aids, same "not part of `draft`/`onDraftChange`"
reasoning as `scrubTime`/`playing` themselves.

## Persistence

Per root `CLAUDE.md`'s mandatory rule, the tile library is **fsStore-backed**,
not localStorage: `C:\Programs\Accessories\Shmup Editor\TILES.DAT` holds
the whole library as a versioned JSON array (`{ version, tiles }`), loaded/
saved via `src/experiences/ShmupEditor/tileStore.ts`. A brand-new install
(empty `TILES.DAT`) or a corrupt/stale-shape save is seeded with the full
default tile library (`types.ts`'s `createDefaultTileLibrary`) rather than
falling back to empty — one `TileDef` per built-in image in
`tileImages.ts`, tagged for what's actually in the art (a plain biome's
edges all carry that biome's tag; a transition tile's two "pure" edges
are tagged and its other two are hardwalled, since a mixed/gradient edge
has no single tag that could describe it — see that file for the exact
per-tile breakdown). The seed is saved immediately, same pattern as
`unitStore.ts`'s pre-existing default-Unit-library seeding (below).

**Four default tiles also ship with hand-authored starter Encounters** —
`Grass` and the three `Road (*)` tiles (`types.ts`'s
`grassEncounters`/`roadStraightEncounters`/`roadCurveEncounters`/
`roadTrailheadEncounters`), each placing real roster Units from
`createDefaultUnitLibrary`, referenced by their deterministic ids (see
"A default Unit library is seeded automatically" above). Every other
default tile stays `encounters: []`. Two goals drove the choice of
content, not just "something on every tile": showing off what the editor
can actually author (formations, convoys, a scripted strafing run, a Part
firing independently of its hull's own movement), and making a playtest
of a generated map more fun to watch than one enemy standing still on
every tile (Noah, after an earlier all-tiles pass that put one static
instance on each: "some of the things you did don't make any sense, like
having a turret in the middle of water... it's just one guy on each tile,
that's boring").

Each of the four tiles offers **multiple separate Encounters** rather than
one that mixes everything — a ground-only one, an air-only one, and (on
Grass and Road (Straight)) a mixed one that combines a lighter version of
both, plus a harmless "flyby" variation folded in either as its own
Encounter (Grass's "Heli Flyby") or as an extra unthreatening element
inside another (Road (Curve)'s "Bend Ambush"). All weights are equal
(`1`), so which Encounter a tile spawns with is a uniform random pick —
Encounters aren't combined, per-tile weighting reflects only "this
Encounter vs. that Encounter on the same tile," matching how the rest of
the tile library already used `weight`.

- **Grass**: *Turret Line* (a `grid`-scaled rank of Turrets, `maxCount: 5`,
  a single row via `gridDepth: 0`), *Helicopter Loiter* (Attack
  Helicopters fly in and hold near the top of the screen rather than
  flying through and off it — the dwell is a step at the same position as
  its predecessor, per `encounterTiming.ts`'s rule for that), *Overwatch*
  (a lighter Turret pair plus one loitering Transport Helicopter — the
  "mixed" option), *Heli Flyby* (a `v`-shaped formation of Transport
  Helicopters that only ever reference their Move Action, never Attack —
  pure bonus points, "no risk of hurting you").
- **Road (Straight)**: *Convoy* (a Battle Tank leads, its Turret Part
  firing independently via a `PartActionPlacement` while the hull just
  drives — the base Unit's own steps and a Part's Action track running on
  the same shared clock, completely decoupled; Transport Trucks queue up
  behind it via `curve`-shaped scaling with a `spawnDelayMs` stagger),
  *Strafing Run* (a Jet Fighter enters fast, loops, then switches to its
  **Strafe** Action for a low pass across the road, then peels off — the
  speed/maneuverability showcase Noah asked for by name), *Escort* (a
  shorter Convoy plus one Jet Fighter making a single strafing pass
  overhead — the mixed option).
- **Road (Curve)**: *Bend Ambush* (an Armored Truck follows the road's
  visual bend — three steps bending left then right, not a straight
  line — with a Turret (Quad) guarding the inside of the curve, plus a
  folded-in harmless helicopter flyby pair), *Strafing Run* (the same
  showcase as Road (Straight)'s, flown along the curve's diagonal instead
  of straight down — no separate Mixed Encounter here, Bend Ambush already
  covers "ground plus incidental air").
- **Road (Trailhead)**: kept deliberately lean, since this tile is a
  level's opening/closing stretch rather than a set-piece — *Checkpoint*
  (a light Turret pair) and *Recon Pass* (a single Prop Plane flythrough,
  not the full loop-and-strafe).

Every step's `time` in this hand-authored content is computed from
straight-line distance at the Unit's `speed` (`types.ts`'s `stepAfter`)
rather than `encounterTiming.ts`'s full arc-length/turning-aware
derivation — close enough for authored-by-hand default content, since the
runtime only ever interpolates against whatever `time` a step already
carries; the fuller derivation only matters for the *editor's own
timeline UI* staying honest while a human drags things around.

**Two seeded tiles shipped with tags that contradicted their own art**, and
are corrected by `repairSeededTiles` (`types.ts`) on load:

- **Road (Curve)** was seeded with Road (Straight)'s edges — `grass-road`
  north *and* south — but the art enters from the south and exits **east**.
  It claimed a road continued off the top of a tile that plainly shows grass
  there, so the matcher would butt it against a road tile to the north and
  draw a road that stops dead at the seam. Now `grass` north/west,
  `grass-road` south/east.
- **"Grass / Sand"** is rocky scrubland over grass — its top half is
  `rocky.png`'s own texture, boulders and all — but was named and tagged
  `sand`, so it sat flush against real sand tiles where the seam is glaring
  (Noah spotted it in the Connection Viewer). Renamed **"Grass / Rocky"**,
  retagged `rocky`, and the image id/file renamed `grass-sand` ->
  `grass-rocky` to match. The genuine grass↔sand transition is the separate
  `grass-sand-natural` tile, which was always correct.

  Renaming a built-in image *id* is normally off the table — ids are stored
  references on every tile saved against them, so a rename blanks their art.
  It was taken here because the editor has no real users yet (Noah's call),
  and `RENAMED_IMAGE_IDS` covers the sessions that do exist. That map is
  applied to **every** tile, user-authored ones included, and deliberately
  *not* gated on matching a seeded signature the way the tag fixes are:
  repointing a moved reference is not overwriting authoring, and leaving a
  user's tile "alone" here would break it rather than protect it. It runs
  after the tag fixes (which still match on the pre-rename id), so a library
  lands correctly whether it is fully stale or was already tag-repaired by an
  earlier build and left holding the old id.

The repair is a targeted content fix rather than a `SAVE_VERSION` bump, for
the same reason as `repairSeededSimpleEnemies`: a bump resets the library and
discards every tile the user authored. Seeded tiles get *random* ids
(`makeTileId`), so unlike the Unit repair there is no stable id to match on —
each fix instead matches the **entire stale signature** (image id, name, every
edge) and rewrites only on an exact hit, so a tile the user renamed, retagged,
or rebuilt on the same art is left completely alone. Unlike the Unit repairs,
this one is **written back to `TILES.DAT`** when it changes something (once,
on the first load after the fix): `games/shmup` reads that file directly with
no idea the repair exists, so a fix living only in the editor's memory would
leave the played level still matching on the bad tags.

Purely-additive optional fields (`customImage`) don't bump
`SAVE_VERSION` — a pre-existing save missing it is still valid and gets
backfilled to its default (`null`) on load, rather than the whole
library being discarded for a one-field gap. A load also silently drops
any leftover `biome` field from a save written before that field was
removed — it's simply not part of `TileDef` anymore. The
folder + file are seeded for new installs (`filesystem/seed.ts`) and
backfilled for existing sessions (`FileSystemStore.ts`'s `migrate()`).

There is currently no `.exe`/Doors-97-window entry for this tool — it's
reachable only via the `/shmup-editor` route. The FS folder exists purely
so `TILES.DAT`/`UNITS.DAT`/`UNIT-DRAFT.DAT`/`TILE-DRAFT.DAT` are
hackable/discoverable in the file browser.

**Help → "Reset to Defaults..." manually re-seeds both libraries.**
Automatic reseeding (above) only fires when a save is empty or fails its
version/shape check — a browser that already seeded before a built-in
sprite/tile-image was renamed or removed (e.g. the skull-\* sprite
removal) is left with a library that loads *successfully* but points at
art that's gone (broken image icons, no crash). There's no version bump
that would catch that case since the saved shape itself didn't change.
`ShmupEditor.tsx`'s `handleResetToDefaults` is the manual escape hatch:
gated behind a confirmation modal (same `.shmup-help-backdrop`/
`.shmup-help-modal` markup the Help topics use, not a new component) since
it's destructive and irreversible, it calls `createDefaultTileLibrary`/
`createDefaultUnitLibrary` directly and overwrites `TILES.DAT`/`UNITS.DAT`,
clears both draft session files, resets all in-memory editing state, and
returns to the Tile List view.

## Related

- [`shmup-editor.todo.md`](shmup-editor.todo.md) — remaining work (E1's
  art import, E2/E3's deferred per-param scaling-curve retrofit, E4-E5)
- [`games/shmup/levels-and-tiles.spec.todo.md`](games/shmup/levels-and-tiles.spec.todo.md) — the data model this editor's tile export shape matches, including §1's "tile variant" concept this editor realizes as `EncounterDef` (see "Unit + Encounter editor (E2)" above)
- [`games/shmup/enemies-and-bullets.spec.todo.md`](games/shmup/enemies-and-bullets.spec.todo.md) — the game-runtime spec for L3/L4/L8 (Epic 5), reconciled to treat this editor's Unit+Parts+Action-buffet+flat-step-list+bezier shape (see "Unit + Encounter editor (E2)" above) as the authoritative content model, replacing its original node-graph draft. Flags a few open questions this editor's design doesn't need to answer but L3/L4's runtime implementation will: how an Action-spawned bullet Unit moves without an authored step list (resolved by `defaultActionId`, see above, though the runtime still has to actually implement it), the CollisionGroup matrix's exact enforcement, and whether branch-condition-dependent behaviors (flee/enrage/phase-change) get a narrow opt-in replacement or stay hand-coded-only like bosses
- [`games/shmup/spawn-and-warnings.spec.todo.md`](games/shmup/spawn-and-warnings.spec.todo.md) — §1's shared difficulty-budget model (§4.2's recursive conserved-budget variant is what "Per-instance scaling (E3)" above implements; §1's broader per-param curve-type system stays unbuilt, see `shmup-editor.todo.md`) and §2's spawn-node draft, superseded for this editor by the per-instance Scaling design above (see git history for the earlier, wrong standalone-spawn-node shape)
- [`ns-doors-97.md`](ns-doors-97.md) — the filesystem this tool persists through
