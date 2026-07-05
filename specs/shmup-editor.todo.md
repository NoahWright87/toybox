# Shmup Level & Enemy Editor — TODOs (PRD)

> Epic: **[Shmup Editor] Epic 6 #182**. Issues: **E1 #191** (tile editor —
> partially shipped, see `shmup-editor.md`), **E2 #192** (enemy +
> encounter editor — shipped minus scaling curves/difficulty gating, see
> `shmup-editor.md`), **E3 #193** (spawn node editor), **E4 #194**
> (preview/playtest), **E5 #195** (export/import pipeline). Source: design
> handoff doc (Claude Chat → Claude Code), 2026-07-04.

## What this is

A browser-based authoring tool at **`/shmup-editor`**, used to create
tiles, enemy definitions, and spawn configurations for the shmup game's
data-driven level system (`specs/games/shmup/levels-and-tiles.spec.todo.md`,
`enemies-and-bullets.spec.todo.md`, `spawn-and-warnings.spec.todo.md`). It
will output JSON files that a human commits into the `games/shmup`
workspace as static content (the concrete hand-off mechanics are E5's job
— nothing lands there automatically yet).

Settled (see `shmup-editor.md` for the shipped slice): the editor is a
route in the **main app**, not inside `games/shmup`'s Phaser workspace;
it shares **no runtime code** with the game (only the JSON shape); tiles
persist via **fsStore**, not localStorage.

## Non-goals for this tool

- Not a general-purpose level editor for other games in the repo (e.g.
  Hellzone's `HellMapEditor.tsx` stays separate — different data model,
  different game).
- Not a live-preview-against-the-real-Phaser-bundle tool — E4's preview
  mode is a lightweight in-browser simulation of node-graph/spawn timing,
  not an embedded copy of `games/shmup`.
- No multiplayer/real-time collaboration — single-author, local browser
  session, export-to-file.

## Surfaces (build in this order — E1/E2 are load-bearing)

### E1 — Tile editor (#191) — partially shipped

**Done** (see `shmup-editor.md`): mobile-first footprint sizing (a 1x1
tile fills most of a phone's width; wider footprints scroll horizontally,
contained to the diagram itself), per-column edge dropdowns (tag registry
+ "+ New tag..." instead of freeform text — avoids typo-based mismatches)
doubling as the diagram itself, a built-in tile-image set (none/water/
grass, tiled across the footprint) replacing the flat color swatch,
start/end connector toggle, menu-driven navigation (no duplicate
on-screen nav buttons), fsStore-backed persistence, and per-tile
**custom art upload** (downscaled/cover-cropped, palette-quantized, and
stored as an indexed PNG so a handful of uploads can't exhaust
`LocalStorageAdapter`'s quota — see `imageUpload.ts`).

Three surfaces were reworked around a "visually check it, don't just
pass/fail it" theme, since tag-matching correctness stopped being the
open question once the tag-dropdown system shipped — with AI-generated
art the real question is whether tag-compatible tiles' *art* reads well
together:
- **Tile list → visual-checker grid**: tiles render as pure art tiled
  edge-to-edge with no gap (real footprint width, so seams are actually
  checkable), actions tucked behind a small "⋮" corner button instead of
  an always-visible row.
- **Connection Tester → Connection Viewer**: further reworked into a
  bidirectional strip builder — tiles render large and literally adjacent
  (~1px apart) so seams are checkable at a glance, "+ Add" appears above
  *and* below the strip (grows either direction, not append-only), the
  picker offers only the first connecting orientation per tile (not every
  permutation), and per-tile rotate/flip/delete controls overlay directly
  on the tile (shown one at a time, on tap) instead of a side column — see
  `shmup-editor.md` for the full design (including why the old ✅/❌ joint
  marker was dropped, and the window-title-suffix mechanism,
  `useWindowTitle`, that lets it drop its on-screen heading too).
- **New: Tag Graph** (`TagGraph.tsx`/`tagGraph.ts`) — a hand-rolled
  Obsidian-style force-directed graph where nodes are edge tags (not
  tiles) and an edge exists wherever some tile carries both tags. Node
  size/edge thickness track tile counts, so rarity and clustering are
  visible directly rather than something you have to infer. Click a
  node/edge to see its tiles; click a tile to edit it.

A per-tile `biome` field (`BiomeSelect.tsx`/`biomeRegistry.ts`) was built
and then **removed** — biome turned out to be entirely emergent from
ordinary edge tags rather than something a tile needs to declare; see
`shmup-editor.md`'s Data model note and
`specs/games/shmup/levels-and-tiles.spec.todo.md` §5 for the reasoning.
The Tag Graph above is what replaces it as the tool for spotting biome
clusters/rarity — there's nothing biome-specific left in the data model
to visualize instead.

**Remaining:**
- Attach spawn variants to a tile (needs E3's spawn-node editor to exist
  first — a tile variant *is* a spawn-node configuration per the design
  doc, so this is blocked on E3, not purely an E1 gap).
- In-editor sketching of tile art (today's upload flow takes an existing
  image file; drawing new art from scratch in the tool is still future
  work).
- The tile-edit form's in-progress draft (`TileEditorForm`'s `draft`
  state, including a freshly-uploaded `customImage`) only persists on
  explicit Save — unlike root `CLAUDE.md`'s mandatory in-progress-session
  rule, a mid-edit reload/rotation loses it. Pre-existing gap (predates
  custom art), but worth closing alongside a future E1 pass since a
  lost upload is a worse loss than a lost edge-tag pick.
- (Side quest, not scoped yet) Some way to soften visibly-mismatched art
  seams between adjacent AI-generated tiles at the actual seam — this is
  a `games/shmup` runtime-rendering concern (a feathered edge-blend
  between whichever two tiles end up adjacent at generation time), not
  something the editor's static previews can address, since the editor
  never renders two *different* tiles touching except in the Connection
  Viewer's single-column stack.

### E2 — Enemy + Encounter editor (#192) — shipped, minus scaling curves

**Revised mid-build**: the first pass put a full movement/dwell/attack
node-graph directly on the enemy definition. That didn't match the
intended content model — an enemy should be simple, reusable sprite+stats
data, with behavior authored separately per tile. See
`shmup-editor.md`'s "Enemy + Encounter editor (E2)" section for the full
current design; this entry describes what actually shipped after the
correction.

**Done**:
- **Enemies** are sprite + stats only (HP, contact damage, score value,
  base speed, hitbox size) — `EnemyStatsForm.tsx`, a plain field form, no
  canvas. `EnemyList.tsx` is the same visual-checker sprite grid as the
  tile list.
- **Encounters** belong to a tile (`TileDef.encounters`) and are authored
  from inside the tile editor (a new Encounters section on
  `TileEditorForm.tsx`, New/Edit/Delete), not a separate top-level menu.
  Editing one opens `EncounterEditor.tsx`: a free-form, tap-driven canvas
  (place/move/delete nodes, each new node already linked to its parent —
  no drag-to-connect gesture) that can host **multiple independent enemy
  instances** at once, each referencing an enemy from the library and
  carrying its own movement/dwell/attack graph. The tile's real
  footprint/edges render as a read-only reference frame
  (`EncounterTileFrame.tsx`) so entrance/exit placement is meaningful
  relative to where the tile actually connects to its neighbors.
- Movement behavior + params per edge (all 4 primitives), dwell behavior +
  params per node (both), entrance appear-animation on the entrance node,
  exit type on any leaf node, attack payloads on any node/edge (pattern
  shape x aim mode x trigger), and nested bullet payloads authored
  recursively through the same `AttackPayloadForm` component (a bullet is
  a minimal enemy per `enemies-and-bullets.spec.todo.md` §7) — all
  unchanged from the first pass, just relocated from the enemy definition
  onto each encounter's per-instance graph.
- Saves as part of the owning tile in `TILES.DAT`; the in-progress
  tile-plus-encounter session survives reload/rotation via `TILE-DRAFT.DAT`
  (and the enemy stats form via `ENEMY-DRAFT.DAT`) per root `CLAUDE.md`'s
  mandatory rule — resumed silently on mount into whichever view (tile-edit
  or encounter-edit) the session was left in.

**Scope decisions**:
- **Branch conditions were cut entirely**, not deferred-but-present —
  removed from the data model, forms, and validators. Explicit ask: ship
  the simpler system, add conditional jumps back only if a concrete
  content need shows up.
- The graph is still a strict chain (each node has at most one outgoing
  movement edge) — unchanged reasoning from the first pass, now just
  scoped to one enemy instance within one encounter instead of to the
  enemy's own identity.

**Remaining:**
- **Per-param scaling curves** (flat vs. scales-with-difficulty) —
  deferred. `enemies-and-bullets.spec.todo.md` never defines a curve shape
  beyond "flat" as one option, so there was nothing concrete to build
  against yet. Every numeric param is a plain flat number today.
- **Encounter difficulty-range gating** — Noah floated this alongside
  weight ("super rare treasure event, extra hard bosses, vs boring normal
  enemies"); weight shipped (plain number, default 1), but gating an
  encounter to a difficulty-budget range depends on the difficulty-budget
  system (`spawn-and-warnings.spec.todo.md`), which doesn't exist yet.
- **Built-in sprites**: four "skull" Mad-Max-style vehicles (buggy,
  technical, motorcycle, helicopter — see `public/shmup-editor/enemies/README.md`
  and `scripts/prepare-skull-sprites.mjs`), each only the idle-pose frame.
  Custom upload also works for authoring any other enemy today.
- **Animation preview is deferred.** Each skull sheet actually has 16
  frames (4 states x 4 frames: idle/moving/attacking/dying —
  `scripts/assets/skull-sprites-source/README.md`), but the editor only
  ever shows a static idle sprite — there's no per-enemy concept of "the
  other 15 frames" yet, and no player/preview UI to flip through them.
  Real, moderate-sized follow-up work: (a) a data-model decision for how
  frame sets attach to a sprite (a built-in vs. a custom upload have very
  different provenance for this), (b) re-running the background-removal
  step from `prepare-skull-sprites.mjs` against the other 15 frames per
  sheet instead of just frame 1, and (c) a small animation-player
  component. Reasonable to fold into E4 (Preview/playtest mode) rather
  than block E2 on it.
- Enemy variants aren't attachable to a tile yet — still blocked on E3's
  spawn-node editor (same dependency E1's tile-variant gap already notes).

### E3 — Spawn node editor (#193)

Attach one or more spawn nodes to a tile variant (origin/shape/direction/
mirror/timing/scaling), referencing enemy definitions built in E2.
Outputs spawn-node JSON matching `spawn-and-warnings.spec.todo.md`'s data
model.

### E4 — Preview/playtest mode (#194)

Preview a tile or a short generated sequence in-browser without a full
game import round-trip — validates readability/fairness (warning lead
times, bullet density) before export.

### E5 — Export/import pipeline (#195)

The versioned JSON schema for every authored type, the concrete landing
path inside `games/shmup/src/` (e.g. a `content/levels/` directory), and
in-editor structural + referential validation (a spawn node's enemy
reference must resolve, etc.) so a malformed export fails loudly in the
editor rather than crashing the game at runtime.

## Open questions (resolve before/during E5)

- Exact landing directory + filename convention inside `games/shmup/src/`
  for exported tiles/enemies/spawn-nodes.
- Whether tile/enemy art in the editor reuses the shmup sprite-registry
  manifest convention (`content-and-assets.spec.md`) directly, or needs
  its own lighter-weight asset-reference scheme suited to sketch/import
  workflows.
- Whether this tool ever gets a Doors 97 window/Taskbar entry (full
  `NsDoors97/CLAUDE.md` registration checklist) or stays a standalone-only
  dev route indefinitely, like Hell Map Editor.

## Related

- [`games/shmup/levels-and-tiles.spec.todo.md`](games/shmup/levels-and-tiles.spec.todo.md)
- [`games/shmup/enemies-and-bullets.spec.todo.md`](games/shmup/enemies-and-bullets.spec.todo.md)
- [`games/shmup/spawn-and-warnings.spec.todo.md`](games/shmup/spawn-and-warnings.spec.todo.md)
- [`games/shmup/overview.spec.todo.md`](games/shmup/overview.spec.todo.md) — spec map for the game this tool authors content for
- `src/experiences/Hellzone/HellMapEditor.tsx` — closest existing in-repo editor precedent (different game/data model)

## Reminders

- `shmup-editor.md` now tracks current (partial-E1) behavior; keep
  promoting sections here into it as E1's remaining gaps and E2-E5 ship.
