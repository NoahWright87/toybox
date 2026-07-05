# Shmup Level & Enemy Editor

> Epic: **[Shmup Editor] Epic 6 #182**. This spec covers what's actually
> shipped; see `shmup-editor.todo.md` for what's still ahead (E3-E5, the
> rest of E1, and E2's deferred scaling-curves piece).

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
- `weight`, `imageId`, `customImage`, `name`: authoring metadata
  (weight is exported; the rest are editor-only, not part of the gameplay
  shape). `imageId` picks from a small built-in set (`tileImages.ts`:
  none/water/grass/shore) **or** the reserved `CUSTOM_IMAGE_ID`, which
  renders `customImage` instead — a per-tile uploaded image (see Custom
  art below). `resolveTileImageUrl()`
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

Navigation between views (Tile List / New Tile / Connection Viewer / Tag
Graph) is via the **Tiles menu** in the window's menu bar
(`useWindowMenus`) — no duplicate on-screen nav buttons; the body just
shows a plain heading for whichever view is active.

- **Tile list — a visual checker, not a metadata card grid.** Tiles
  render as pure art (`TileArt`, no schematic/edge-tag labels — that's
  `TilePreview`'s job, and it's only used by the edit form now), tiled
  **edge-to-edge with no gap** in a CSS grid, each tile spanning its real
  footprint width so a 2x1 tile is visibly twice as wide as a neighboring
  1x1 — the point is judging how tiles' art reads *next to each other*,
  which matters a lot when the art comes from an AI image generator that
  has no idea what tile sits next to it. Per-tile actions (Edit/Duplicate/
  Delete) live behind a small "⋮" corner button instead of an
  always-visible row, so they don't compete with the art for attention.
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
    and falls back to `none` if it was the active selection. Real
    in-editor sketching (vs. upload of existing art) is still deferred.
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

## Enemy + Encounter editor (E2)

**Revised mid-build**: the first pass at E2 put a full movement/dwell/
attack node-graph directly on the enemy definition, matching
[`enemies-and-bullets.spec.todo.md`](games/shmup/enemies-and-bullets.spec.todo.md)'s
literal wording ("an enemy is a node graph"). That didn't match the actual
intended content-authoring model: an enemy should be reusable, simple
sprite-plus-stats data, with movement/attack behavior authored separately,
per appearance, on the **tile** that spawns it. This section documents the
shape that replaced it — see git history for the earlier enemy-owns-the-
graph version if it's ever useful.

The mental model: **tiles have encounters, encounters place enemies.**
- An **enemy** (`EnemyDef`, `enemyTypes.ts`) is just a sprite + stats — HP,
  contact damage, score value, base speed, hitbox size. No behavior. A
  small **Enemies** menu (alongside **Tiles**) manages this library via
  `EnemyStatsForm.tsx`, a plain field form with no canvas at all —
  `EnemyList.tsx` is the same visual-checker sprite grid as the tile list.
- An **encounter** (`EncounterDef`, `encounterTypes.ts`) belongs to one
  specific tile (`TileDef.encounters`) — "each tile can have multiple
  encounters; a random one (weighted) is picked when the tile spawns in a
  level." An encounter places one or more **enemy instances**
  (`EncounterEnemy`), each referencing an `EnemyDef` by id and carrying its
  own independent movement/dwell/attack graph. The same "Skull Buggy" can
  move in a straight line in one tile's encounter and spiral in another's
  — behavior belongs to the appearance, not the enemy's identity.
- Encounters are authored **inside the tile editor**, not from a separate
  top-level menu — `TileEditorForm.tsx` gained an Encounters section
  (list + New/Edit/Delete); editing one switches to a dedicated
  `EncounterEditor.tsx` view and back, the same view-switching pattern
  Tile List ↔ Tile Editor already used.

**Branch conditions were cut entirely**, not just deferred — an HP/time-
threshold conditional jump was real complexity for both the editor and
content authors to work through, and the request was explicit: ship
without it, add it back only if content actually turns out to need it. The
graph is a strict chain: every node has at most one outgoing edge, built
by "growing" a node off an existing one — there's no "connect any two
nodes" gesture and no conditional second target.

### Data model (`encounterTypes.ts`)

- **`GraphNode`** owns state: position, optional `DwellBehavior`
  (wait/orbit, spec §3), optional `AttackPayload` (spec §6), optional
  `ExitConfig` (meaningful only on a leaf — spec §4), optional
  `EntranceAppearance` (meaningful only on the entrance node).
- **`GraphEdge`** owns a single `MovementBehavior` (straightLine/wave/
  spiral/teleport, spec §2) plus its own independent optional
  `AttackPayload`.
- **Bullets are minimal enemies** (spec §7): `AttackPayload.bullet` is a
  `BulletDef` — sprite + one of the 3 non-teleport `MovementBehavior`
  primitives (a bullet's spawn/expire *are* its entrance/exit) + an
  optional nested `AttackPayload` of its own — free recursion for
  splitting/homing/curving/boomerang bullets, unchanged from the first
  pass.
- **`EncounterEnemy`** = `{ id, enemyDefId, entranceNodeId, nodes, edges }`
  — one enemy's placement + behavior within one encounter.
- **`EncounterDef`** = `{ id, name, weight, enemies, createdAt, modifiedAt }`.

Per-param scaling curves and encounter difficulty-range gating (both
floated as possible future work) are **deferred** — see
`shmup-editor.todo.md`'s Remaining section. Weight is a plain flat number.

### Canvas (`EncounterEditor.tsx`, `EncounterTileFrame.tsx`, `encounterGraph.ts`)

Same tap-driven interaction model as the original pass (tap a node for a
✥ move handle / "+" grow / ✕ delete overlay, tap an edge for ✕ delete,
below-canvas tabbed settings panels for the real param forms — see
`NodePanel.tsx`/`EdgePanel.tsx`), generalized to host **multiple
independent enemy instances on one shared canvas**, anchored against the
tile's actual shape:

- **`EncounterTileFrame.tsx`** renders a read-only dashed rectangle sized
  to the tile's real footprint, labeled with its actual north/south/
  east/west edge tags — so an enemy's entrance/exit can be placed
  meaningfully relative to where the tile really connects to its
  neighbors, not an abstract unrelated space. The canvas's bounding box
  always includes this frame, so it's visible even before any enemy is
  placed.
- **"+ Add Enemy"** opens a picker of the enemy library (sprite
  thumbnails); picking one adds a new `EncounterEnemy` instance with its
  entrance node staggered diagonally from any existing instances (so
  default placement doesn't render two entrance labels on top of each
  other) — draggable afterward via the same move handle as any other node.
- Each instance renders its own sprite (looked up by `enemyDefId` from the
  enemy library) on every node, with the enemy's name labeled under its
  entrance node so multiple instances stay distinguishable.
- **Deleting an instance's entrance node removes the whole instance from
  the encounter** (not just clearing its graph to empty, which would leave
  a useless graph-less stub in `encounter.enemies`) — the delete button's
  tooltip changes to "Remove this enemy from the encounter" specifically
  for that case. Deleting any other node cascades to its downstream
  subtree exactly as the original pass's `deleteNode` did (ported to
  `encounterGraph.ts`, operating on `EncounterEnemy` instead of the old
  enemy-owns-the-graph shape).
- **A tap on any `<button>` never triggers the canvas's outside-click
  deselect** — carried over from the original pass's fix (collapsing the
  panel on `pointerdown` shifts the page layout out from under an
  in-flight click, which an end-to-end Playwright pass caught directly:
  `Save Enemy` silently no-opped because the button had moved by the time
  the click landed). Any `<button>` target is excluded from the auto-close
  check.

### Sprites (`enemySprites.ts`, `SpritePicker.tsx`)

Mirrors `tileImages.ts`'s built-in-plus-custom-upload structure exactly.
Built-in set: four "skull" Mad-Max-style vehicles Noah supplied
(ChatGPT-generated) — dune buggy, gunner "technical," motorcycle,
helicopter (`public/shmup-editor/enemies/README.md`). Each source sheet is
actually a 4x4 idle/move/attack/die grid
(`scripts/assets/skull-sprites-source/`), but only the idle frame is
extracted for the built-in today, via `scripts/prepare-skull-sprites.mjs`
— a one-time Jimp-based script that crops the idle cell, flood-fills real
alpha transparency in (the source sheets bake a fake checkerboard into
opaque near-gray pixels rather than using real alpha), trims to content,
and pads to a square icon. Custom upload reuses the same
`paletteQuantize.ts`/`indexedPng.ts` pipeline as tile art, generalized in
`imageUpload.ts` into `decodeUpload`/`canvasToIndexedPngDataUrl` helpers
shared by both `loadTileImageFile` (cover-fit crop, opaque — fills a whole
square) and `loadSpriteImageFile` (**contain**-fit, transparent surround —
a sprite must stay fully visible against a see-through background rather
than being cropped to fill a square). Animating through the other 15
frames per skull sheet (idle/move/attack/die preview) is deferred — see
`shmup-editor.todo.md`'s Remaining list.

### Persistence

An encounter is saved as part of its owning tile — `TileDef.encounters` is
a plain field inside `TILES.DAT` (`tileStore.ts`), validated recursively by
`encounterValidation.ts` (shared with the session draft below; capped at a
generous nesting depth so a maliciously/corruptly deep hand-edited save
fails validation instead of overflowing the stack) and backfilled to `[]`
for pre-existing saves, the same purely-additive-field treatment
`customImage` already got. There's no separate encounter library or file.

Two more fsStore files alongside `TILES.DAT`/`ENEMIES.DAT`, same folder
(`C:\Programs\Accessories\Shmup Editor\`), for root `CLAUDE.md`'s mandatory
in-progress-session-survives-reload rule — a half-built tile/encounter is a
much bigger loss on an accidental mobile reload/rotation than E1's original
tile-form draft gap:

- **`ENEMY-DRAFT.DAT`** (`enemyStore.ts`'s `loadEnemyDraft`/`saveEnemyDraft`)
  — the enemy stats form currently being edited, written on every field
  change.
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
  session and resumes silently into either the tile-edit or encounter-edit
  view, whichever the session was left in. Position drags on the
  Encounter canvas are the one exception to "write on every change" — a
  drag updates only local component state, committed to the session once
  on release, not on every pointer-move frame.

Both new files are seeded for new installs (`filesystem/seed.ts`) and
backfilled for existing sessions (`FileSystemStore.ts`'s `migrate()`), same
as `TILES.DAT`.

## Persistence

Per root `CLAUDE.md`'s mandatory rule, the tile library is **fsStore-backed**,
not localStorage: `C:\Programs\Accessories\Shmup Editor\TILES.DAT` holds
the whole library as a versioned JSON array (`{ version, tiles }`), loaded/
saved via `src/experiences/ShmupEditor/tileStore.ts`. A corrupt or
stale-shape save falls back to an empty library rather than crashing
(same defensive-load pattern as `MahjongSolitaire`'s save state).
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
so `TILES.DAT`/`ENEMIES.DAT`/`ENEMY-DRAFT.DAT`/`TILE-DRAFT.DAT` are
hackable/discoverable in the file browser.

## Related

- [`shmup-editor.todo.md`](shmup-editor.todo.md) — remaining work (E1's
  art import, E2's deferred scaling curves, E3-E5)
- [`games/shmup/levels-and-tiles.spec.todo.md`](games/shmup/levels-and-tiles.spec.todo.md) — the data model this editor's tile export shape matches
- [`games/shmup/enemies-and-bullets.spec.todo.md`](games/shmup/enemies-and-bullets.spec.todo.md) — the data model this editor's enemy export shape matches
- [`ns-doors-97.md`](ns-doors-97.md) — the filesystem this tool persists through
