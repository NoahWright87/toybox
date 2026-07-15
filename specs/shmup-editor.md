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

## Unit + Encounter editor (E2)

**Revised five times.** The first pass put a full movement/dwell/attack
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
"Movement" below. **A fifth pass cut Actions entirely** — see immediately
below. See git history for all five earlier shapes if useful.

**There is no Action buffet anymore.** `ActionDef` used to bundle an
`animationState` (idle/moving/attacking/dying) and a `visible` flag,
authored once per Unit and referenced per step. Noah's read: "is there a
point to Actions anymore? You can pick an animation, but it's not like
you can actually choose frames." Correct — `animationState` was fully
inert, since the editor only ever renders a static idle sprite (real
multi-frame animation is a separate, unbuilt future feature that will
need its own data-model decision anyway, tied to however frame sets end
up attaching to a sprite — not a slot pre-guessed now). `visible` is the
only field that ever did anything, and a plain boolean has no reuse value
worth a whole named, buffet-and-select indirection — every placement's
visibility need is independent and trivial to set directly. So
`EncounterStep` just carries its own `visible: boolean` now — no Action,
no `actionId`, no Actions section/editor/session slot anywhere in the
Unit-authoring UI. `ActionEditor.tsx` was deleted outright, not kept
around unused.

The mental model: **a Unit owns two movement stats (speed/turnRate) plus a
set of Parts, each owning its own reusable Weapon buffet; an encounter
places Units and walks each one along a curved path through an ordered
list of steps (each carrying its own visibility) while independently
placing attack events on each Part's own timeline track.**

- A **Unit** (`UnitDef`, `unitTypes.ts`) is a sprite + stats — HP, contact
  damage, score value, `speed`, `turnRate`, hitbox size — **plus**
  `parts: UnitPart[]` (attack buffet), authored once and referenced (not
  re-authored) from any encounter placement. A small **Units** menu
  (alongside **Tiles**) manages the library via `UnitStatsForm.tsx` (stats
  fields plus a Parts section — list + New/Edit/Delete, mirroring the tile
  editor's Encounters section); `UnitList.tsx` is the same visual-checker
  sprite grid as the tile list.
- A **`UnitPart`** (`unitTypes.ts`) is `{id, name, offset, spriteId,
  customSprite, weapons: WeaponDef[]}` — see "Attacks" below for the full
  model. Every Unit is seeded with one default "Main" part, so the common
  single-weapon-system case needs no extra authoring.
- An **encounter** (`EncounterDef`, `encounterTypes.ts`) still belongs to
  one specific tile (`TileDef.encounters`) and is still authored **inside
  the tile editor** (Encounters section on `TileEditorForm.tsx`,
  New/Edit/Delete, switching to a dedicated `EncounterEditor.tsx` view and
  back). Each **`EncounterUnit`** instance references a `UnitDef` by id and
  owns both a `steps: EncounterStep[]` movement track and an
  `attacks: EncounterAttack[]` set of attack-track placements — plain
  arrays, not a graph. Each `EncounterStep` is `{ id, pos, visible, time,
  speedMultiplier?, handleIn?, handleOut? }`: a position on the canvas,
  whether the Unit is visible there, a `time` (see "Timing" below) saying
  when, and bezier handles shaping the curve on either side (see
  "Movement" below). The same "Skull Buggy" Unit can be walked through a
  sharply-curving step sequence in one tile's encounter and a single
  stationary step in another's — path shape belongs to the placement, not
  the Unit's identity; only *speed*/*turnRate* travel with the Unit.

**Three dedicated concepts dissolved into ordinary steps** rather
than surviving as their own types, once behavior stopped living on a
graph (and, later, once Actions stopped existing at all):
- **Dwell** — a step at the *same position* as its predecessor *is*
  dwell-in-place; there's no separate `DwellBehavior` type or
  dwell-specific form (a zero-length bezier segment has nothing to travel
  along).
- **Entrance/Exit** — the first and last step in an instance's step list
  are just ordinary steps; there's no dedicated `EntranceAppearance`/
  `ExitConfig` type, and no enable/disable logic for "can this step have
  an exit" — the "+ Add next step" button is always available on the last
  step, full stop.
- **Teleport** — no dedicated `TeleportMovement` primitive. A step with
  `visible: false` (still called "Disappear" in the UI) followed by a
  later step at a different position with `visible: true` ("Reappear")
  composes to the same visible effect without a special case in the
  movement vocabulary.

**Branch conditions remain cut entirely** (unchanged from the prior
pass) — no conditional jump exists anywhere in the step list; steps play
in the fixed order they're authored in.

### Movement (`bezier.ts`, `unitTypes.ts`)

**Movement stopped being an Action-level choice (straightLine/wave/
spiral) and became a single cubic bezier curve per segment, driven by two
plain Unit stats.** The original per-Action movement vocabulary was
dropped in favor of: every segment between two of a Unit instance's steps
is one cubic bezier curve, shaped by each step's own `handleIn`/
`handleOut` offsets and paced by the owning Unit's `speed` (px/sec).
`UnitDef.turnRate` caps how far a handle can extend, **as a multiple of
that segment's straight-line length** — `turnRate: 1` allows a handle up
to 100% of the segment length (a fairly pronounced bend); a stiffer/
slower-turning Unit gets a lower `turnRate` and can only author gentler
curves. This is a purely geometric constraint, not a physics simulation,
and it's enforced wherever a handle is *read* (`resolveHandleOut`/
`resolveHandleIn`), not just where it's written — lowering a Unit's
`turnRate` after curves were authored at a higher one tightens every
curve consistently rather than leaving stale, now-invalid handle data
sitting around unused.

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
computes a raw offset from the pointer position, clamps it by `turnRate`
immediately (so the dot visually "sticks" once you drag past the limit
rather than floating past it), and stores the clamped value — the stored
data always reflects exactly what the curve actually uses, never an
unenforced excess. **The handle drag targets are real HTML `<button>`
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

**`turnRate`'s old meaning (homing toward the live player, degrees/sec)
is gone along with the movement-kind system** — it was never actually
simulated in the preview anyway (no live player exists at authoring
time), so the "known approximation, not a bug" caveat that used to cover
it no longer applies to anything.

**Bullets are no longer a separate type — see "Attacks" below.** An
earlier pass kept a dedicated `BulletDef`/`MovementBehavior`
(straightLine/wave/spiral) system for fired projectiles, reasoning that a
bullet "has no waypoints to curve between." The Parts/Weapon-track pass
replaced that entirely: a Weapon spawns an actual `UnitDef` by id, and
`MovementBehavior`/`BulletDef`/`MovementForm.tsx` were deleted outright,
not kept around for a use case that no longer exists.

**Wave/spiral/wobble for Units aren't gone, they're deferred** — see
`shmup-editor.todo.md`'s Remaining list for the planned per-Unit
"constant motion" property (a secondary offset the sprite/hitbox orbits
or oscillates around its primary bezier-path position, independent of
`speed`/`turnRate`) that will eventually cover what those movement kinds
used to.

### Attacks (`unitTypes.ts`, `encounterAttacks.ts`, `WeaponForm.tsx`, `PartEditor.tsx`, `AttackPanel.tsx`)

**Attacks live on their own timeline tracks, independent of movement
steps — "added anywhere on the timeline" per the request that drove this
pass.** Attacking used to ride along with a movement waypoint's Action
(`ActionDef.attack`) — it never did after this pass, and `ActionDef`
itself is gone entirely as of a later pass (see the top of this section).

**A Unit has one or more Parts, each owning its own reusable Weapon
buffet.** `UnitPart` (`unitTypes.ts`) is `{id, name, offset, spriteId,
customSprite, weapons}` — `offset` is a position relative to the Unit's
own origin, so a turret mounted forward of a ship's center anchors its
fire from the right spot (`spriteId`/`customSprite` shipped in a later
pass, see "Visual authoring pass" below). Every Unit is seeded with one
default "Main" part, so the common single-weapon-system case needs zero
extra authoring; a battleship with three independently-scheduled turrets is
just three Parts, each with its own attack-track placements — this is
what makes independent per-part tracks fall out for free instead of
needing a dedicated multi-entity system.

**The weapon model is one flat, orthogonal set of fields, not a shape ×
aim × trigger matrix.** `WeaponDef` replaced the original three-axis
`AttackPayload` (`shape`: single/arc/radialBurst/beam, `aim`:
fixed/aimed/rotating, `trigger`: continuous/onDeath/onTrigger) per a
re-read of the original "Design Handoff v2" doc's §5.6 weapon model:

- **Aim**: `fixed` (a base angle) or `player` (tracked continuously or
  snapshotted once at fire time — not simulated in the live preview, same
  no-live-player-at-authoring-time approximation `turnRate` already
  accepted).
- **Arc range** (`arcStartDeg`/`arcEndDeg`, relative to the aim) + **shot
  count** + **spacing** (even/random) + **per-shot delay** (time between
  shots *within* one burst, distinct from `fireIntervalMs`, the time
  *between* bursts). One primitive covers what used to be three separate
  shapes: a narrow arc with few shots is a fan, `0°/360°` is a full
  radial burst, and a range like `5°/355°` is new territory the old
  matrix couldn't express at all — a burst with a deliberate gap at the
  aim direction (a safe lane).
- **Sweep** (`sweepSpeedDeg`, `pingPong`): a nonzero sweep speed rotates
  the whole arc over time — this **is** what "rotating" aim used to be,
  not a separate aim mode.
- **No trigger kind at all.** An attack-track placement's own `time` (see
  below) already says *when* it fires — the old `onTrigger` collapsed
  into that. A repeating burst is just a nonzero `fireIntervalMs`
  (`continuous`'s replacement). `onDeath` was cut outright rather than
  ported, since "everything is time-based" (the explicit design decision
  behind this pass) leaves no time-based home for a death-triggered
  event; a future pass could reintroduce it as an orthogonal flag if
  needed.
- **Beam was cut, not ported** — a sustained damage line doesn't fit the
  arc/count primitive, and can be faked with a rapid-fire long/thin
  projectile in the meantime.
- **`spawnUnitId`/`spawnScale`**: a Weapon spawns an actual `UnitDef` by
  id (any Unit in the library, including one with its own Parts/Weapons —
  recursive/splitting fire is free, no nested-payload shape needed) with
  a simple flat size multiplier. Replaces the old inline `BulletDef`
  entirely — see "Movement" above. `spawnScale` is deliberately simple;
  see `shmup-editor.todo.md` for the deferred difficulty-scaling-curve
  system this is *not* attempting to be.

**`EncounterAttack`** (`encounterTypes.ts`) is the placement: `{partId,
weaponId, time, durationMs, aimAngleOverride}`. `time` is the same shared
clock as steps but is **always manually authored** — unlike a step, there's
no position/distance to derive it from, since an attack has no position of
its own. It fires from wherever the instance's bezier path (plus the
Part's `offset`) puts it at that moment — `attackAnchorWorld()` in
`EncounterEditor.tsx` reuses `movementPreview.ts`'s
`computeInstancePreview` for this, falling back to the instance's first
step if the attack's time is before the instance has technically spawned.
`durationMs` keeps a repeating Weapon (`fireIntervalMs > 0`) firing past
`time`; 0 is a single burst. `aimAngleOverride` is a narrow per-placement
override of the Weapon's `fixedAngleDeg` (only meaningful for a
`fixed`-aim Weapon) — same "encounters select pacing/aim, they don't
author identity" carve-out steps' `speedMultiplier` already uses.
`encounterAttacks.ts` is **unordered** array CRUD (`addAttack`/
`updateAttack`/`deleteAttack`/`attacksForPart`) — unlike steps, attacks
have no chronology invariant to maintain, so deleting one never cascades
to any other.

**A fixed-aim attack gets a draggable aim handle on canvas**, reusing the
same `.shmup-handle-btn` pattern as bezier handles, but simpler: since the
attack's anchor itself moves along the bezier path over time, there's
nothing to store but the angle. Dragging computes `atan2` from the
anchor to the pointer and writes straight into `aimAngleOverride` in
degrees; the handle renders at a fixed visual distance
(`AIM_HANDLE_LENGTH`) from the anchor at that angle. A `player`-aimed
Weapon gets no handle — nothing fixed to drag.

**Adding an attack**: tapping the 🔫+ button on a selected step (next to
✥/+/✕) adds an attack event at that step's time. If the Unit has exactly
one Part, it's added directly (to that Part's first Weapon); with more
than one Part, a small picker (mirrors "+ Add Unit"'s picker) asks which
Part. Disabled with a hint if the Unit has no Weapons authored anywhere
yet — nothing to reference.

### Visual authoring pass (`PartPositionEditor.tsx`, `WeaponPreview.tsx`, `weaponPreview.ts`)

The Parts/weapon-track pass above shipped as pure data-entry — no
defaults, no way to see a Part's position or a Weapon's pattern except by
reading numbers. Noah's follow-up feedback ("a lot of numbers, zero
defaults, nothing visual... emphasis on the G") drove three fixes:

- **`UnitPart` gained its own `spriteId`/`customSprite`** — a Part can
  now render/reposition visually, not just anchor a Weapon buffet
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
  attack markers also switched from a generic 🔫 icon to the firing Part's
  actual sprite when one is set (falls back to 🔫 for a spriteless Part).
- **`WeaponPreview.tsx`/`weaponPreview.ts`**: a live animated canvas at
  the top of `WeaponForm.tsx` (deliberately first, not an afterthought)
  showing what the Weapon actually fires — a shooter marker, the current
  arc boundaries (sweeping live if `sweepSpeedDeg` is nonzero), a
  telegraph glow during wind-up, and bullet dots (the spawned Unit's own
  sprite, resolved via `spawnUnitId`, falling back to a plain dot) flying
  outward along each shot's angle. Split the same way `movementPreview.ts`
  is: pure, declarative functions in `weaponPreview.ts`
  (`computePreviewBullets`/`shotAngleOffsets`/`sweepOffsetDeg`/
  `isTelegraphing`/`burstPeriodMs`, unit tested directly) recomputing
  bullet positions from scratch at any elapsed time — no simulation state
  to reset when a field changes mid-preview — driven by a `<canvas>` +
  `requestAnimationFrame` loop in the component itself. Explicitly a
  *representative* visualization, not a physics match for the eventual
  game runtime (doesn't exist yet): a fixed preview bullet speed, not
  whatever the spawned Unit's own stats would imply; a single-burst
  Weapon (`fireIntervalMs === 0`) still loops every
  `PREVIEW_LOOP_FALLBACK_MS` so it keeps demonstrating the pattern instead
  of firing once and going static; `aimMode: "player"` aims at a fixed
  reference point standing in for the player (same no-live-player-at-
  authoring-time approximation the rest of the editor already accepts);
  ping-pong sweep oscillates within a fixed `SWEEP_PINGPONG_AMPLITUDE_DEG`
  (90°) since `WeaponDef` has no separate amplitude field to derive one
  from — a documented preview simplification, not authored data.
- **A default "Bullet" Unit is now seeded automatically.** `unitTypes.ts`'s
  `createDefaultBulletUnit()`/`createDefaultUnitLibrary()` build a
  ready-to-use generic projectile (a supplied glow sprite,
  `bullet-basic.png`, low HP, small hitbox, sensible speed) with a stable
  id (`DEFAULT_BULLET_UNIT_ID`, not random) so reseeding never
  duplicates it. `unitStore.ts`'s `loadUnits` seeds-and-persists this
  library the moment it would otherwise return empty — a brand-new
  install, or any save that fails the version/shape check (the same
  fallback every prior version bump already used, now landing on one
  Unit instead of a truly blank library). `createBlankWeapon` also
  defaults `spawnUnitId` to this Bullet rather than `null`, so a
  brand-new Weapon does something visible immediately instead of firing
  nothing.

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
  *predecessor's*** — there's a real curve (`bezier.ts`) and a real speed
  (the owning Unit's) to compute a duration from: `time =
  precedingStep.time + arcLength ÷ effectiveSpeed`. `recomputeStepTimes`
  does this in one forward pass over an instance's `steps` array, called
  by `EncounterEditor.tsx`'s `updateInstance` wrapper after *every*
  mutation (position drag, handle drag, action swap, speedMultiplier
  change) so a derived time never goes stale — you don't have to remember
  to "re-derive" anything. Move a waypoint closer, or straighten a curve
  back out, and its arrival time visibly shrinks; that's not a special
  case, it falls straight out of the arc-length term.
- **A step's `time` stays manually authored when there's nothing to
  derive it from** — the first step of an instance (this is *when the
  unit spawns*, not a destination-arrival) or a step *dwelling at the
  same position* as its predecessor (no destination, nothing to derive).
  `StepPanel.tsx`'s Time field is disabled with an explanatory hint for a
  derived step; it's a normal editable number for a manual one.
- **`speedMultiplier` (see Per-step overrides below) is what actually
  controls a derived step's pacing.** Dragging a *derived* step on
  `EncounterTimeline.tsx` doesn't set `time` directly — `EncounterEditor`'s
  `handleRetimeStep` solves `encounterTiming.ts`'s
  `speedMultiplierForDuration` for whatever multiplier would make the
  preceding step arrive exactly where you dropped it, and writes that onto
  the *preceding* step's `EncounterStep.speedMultiplier` — never onto the
  shared `UnitDef`, since a Unit's `speed` is shared across every encounter
  that reuses it, and silently changing one encounter's pacing shouldn't
  touch every other one.
- **Array index order is the authorial sequence order — steps are no
  longer reordered by dragging.** An earlier design kept `steps` sorted by
  `time` as an invariant so dragging past a neighbor could reorder the
  sequence; once `time` is mostly computed rather than freely draggable,
  that stopped making sense (there was never a UI gesture to reorder
  steps any other way — array order was always the true authored
  sequence). `encounterSteps.ts`'s `updateStep` just floors a manual
  `time` patch at 0 now; `recomputeStepTimes` is what keeps every step
  chronologically after its predecessor.

**`EncounterTimeline.tsx`** renders the shared clock as a horizontal ruler
with one track per unit instance, below the canvas. Each step is a small
diamond positioned at `time * PX_PER_SEC`; tapping one selects it (same
selection as the canvas), and a drag handle (⟷) appears only when selected
— mirroring the canvas's own move-handle pattern rather than making every
marker draggable at all times.

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

### Per-placement overrides (`StepPanel.tsx`, `AttackPanel.tsx`)

A narrow, explicit whitelist of fields a *placement* can override on top
of whatever it references — not a general "edit the definition's params
here" escape hatch. Split across two panels now that attacks aren't step
fields anymore:

- **`EncounterStep.speedMultiplier`** (`StepPanel.tsx`) — shown only when
  there's a next step at a different position (`hasOutgoingSegment`,
  computed by `EncounterEditor` the same way `encounterTiming.ts` decides
  whether a step's time is derived — a step whose successor dwells at the
  same position has no segment for a multiplier to affect). Started as a
  purely cosmetic per-placement pacing tweak; now it's the actual
  mechanism for controlling a *derived* step's duration (see Timing
  above) — dragging the *next* step on the timeline writes to *this*
  step's `speedMultiplier` rather than to a raw time value. 1 = the owning
  Unit's own authored `speed`, 2 = twice as fast (half the travel time to
  the next waypoint), etc.
- **`EncounterAttack.aimAngleOverride`** (`AttackPanel.tsx`) — shown only
  when the selected attack's Weapon has `aimMode === "fixed"`; also has a
  draggable canvas handle (see "Attacks" above) that writes the same
  field.

Both are optional; omitted means "use the referenced definition's own
value unmodified."

### Canvas (`EncounterEditor.tsx`, `EncounterTileFrame.tsx`, `encounterSteps.ts`)

Same tap-driven interaction model as earlier passes (tap a node to select
it, overlay quick-action buttons, below-canvas settings panel for the real
fields), simplified by the graph-to-array collapse: consecutive steps
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

- **`EncounterTileFrame.tsx`** is unchanged from the graph-based pass — a
  read-only dashed rectangle sized to the tile's real footprint, labeled
  with its actual edge tags, always present in the canvas's bounding box.
- **`encounterSteps.ts`** replaces the old `encounterGraph.ts` graph CRUD
  with pure array operations on one instance's `steps` list —
  `addStep`/`updateStep`/`moveStep`/`isFirstStep`/`isLastStep`/
  `deleteStepsFrom` (truncates the array from a given step to the end,
  the array equivalent of the old cascade-delete-a-subtree behavior).
  `encounterSteps.test.ts` covers all of these directly against arrays —
  no graph-traversal test helpers needed.
- **"+ Add Unit"** opens a picker of the Unit library (sprite thumbnails);
  picking one adds a new `EncounterUnit` instance seeded with one step
  (time 0) using the unit's first Action, staggered diagonally from any
  existing instances — position is staggered by default, time isn't; stagger
  a later instance's start time manually on the timeline if wanted.
- Each instance renders its own sprite (looked up by `unitDefId`) on every
  step, with the unit's name labeled under its first step. Step badges:
  ▶ marks the first step, 👻 marks a step whose own `visible` is `false`
  (rendered with `.shmup-enemy-node--hidden` — dashed border, reduced
  opacity — so a Disappear/teleport-out step reads as ghosted at a
  glance). No attack badge on steps anymore — attacks render as their own
  markers, below.
- **Attack-track placements render as separate 🔫 markers**
  (`.shmup-attack-marker`, smaller and differently colored than a
  movement waypoint — same "reads as secondary" reasoning as the live
  preview dot), positioned via `attackAnchorWorld()` at wherever the
  instance's bezier path puts it at the attack's own time. Selecting one
  shows a ✕ delete control and, for a fixed-aim Weapon, the aim handle
  (see "Attacks" above). A selected step's control cluster gains a 🔫+
  button (next to ✥/+/✕) to add one there.
- **Deleting the first step removes the whole instance** from the
  encounter (confirm-then-`removeInstance`) — same reasoning as the prior
  pass's entrance-node special case, just phrased in step-list terms.
  Deleting any other step truncates the array from that point on
  (confirm-then-`deleteStepsFrom`) when it would remove more than one step.
- **A tap on any `<button>` never triggers the canvas's outside-click
  deselect** — carried over unchanged from both earlier passes.

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
a plain field inside `TILES.DAT` (`tileStore.ts`). `encounterValidation.ts`
validates the placement shapes an encounter actually saves —
`isEncounterStep`/`isEncounterAttack`/`isEncounterUnit`/`isValidEncounter`
— which are just a `visible` boolean plus string references
(`partId`/`weaponId`) plus plain numbers/`Vec2`s, no nested definition
data. The Unit-owned *definitions* those references point at
(`UnitPart`/`WeaponDef`) validate in `unitStore.ts` instead, since Units
are what own Parts now: `loadUnits`/`saveUnits` validate `parts[]`
(`isUnitPart`/`isWeaponDef`/`isValidUnitDef`) before trusting a saved
library — no recursion needed either, since `WeaponDef.spawnUnitId` is a
plain string reference rather than a nested `BulletDef`/`AttackPayload`
structure (the old `isMovement`/`isAttackPayload`/`isBullet`/
`MAX_PAYLOAD_DEPTH` recursive validators, and later `isActionDef` itself,
were all deleted along with the types they validated). There's no
separate encounter library or file.

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
`speed` (plus a new `turnRate`), `ActionDef` lost its `movement` field
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

The visual authoring pass (below) bumped `unitStore.ts`'s `SAVE_VERSION`
again (7→8, for `UnitPart`'s new `spriteId`/`customSprite`), and cutting
Actions entirely bumped every version one more time: `UnitDef` lost
`actions: ActionDef[]`, `EncounterStep` lost `actionId` and gained
`visible: boolean`, and `UnitEditSession` lost `activeAction` entirely
(a Unit's session now only tracks `activePart`). `unitStore.ts`'s
`SAVE_VERSION` (7→8) and `TILE_SESSION_VERSION` (4→5), plus
`tileStore.ts`'s `SAVE_VERSION` (5→6), all bumped for the usual "reset
rather than silently carry a mismatched shape" reason.

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
  each form unmounts while the other view is showing. **A Part's own
  Weapons don't get a session slot of their own** — `PartEditor` edits
  them inline (expand-in-place via `WeaponForm`, live two-way bound into
  the Part's own draft state), the same "no separate Save/Cancel flow"
  shape the original inline `AttackPayloadForm` always had, just now
  organized as a list instead of one checkbox-gated block. There's no
  `activeAction` anymore — Actions were cut entirely, see the top of this
  section.
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
so `TILES.DAT`/`UNITS.DAT`/`UNIT-DRAFT.DAT`/`TILE-DRAFT.DAT` are
hackable/discoverable in the file browser.

## Related

- [`shmup-editor.todo.md`](shmup-editor.todo.md) — remaining work (E1's
  art import, E2's deferred scaling curves, E3-E5)
- [`games/shmup/levels-and-tiles.spec.todo.md`](games/shmup/levels-and-tiles.spec.todo.md) — the data model this editor's tile export shape matches
- [`games/shmup/enemies-and-bullets.spec.todo.md`](games/shmup/enemies-and-bullets.spec.todo.md) — the bullet/attack-payload shape this editor's weapon model draws from; its enemy-is-a-node-graph section is superseded by this editor's Unit+Parts+flat-step-list model (see "Unit + Encounter editor (E2)" above) and needs a future update to stay in sync
- [`ns-doors-97.md`](ns-doors-97.md) — the filesystem this tool persists through
