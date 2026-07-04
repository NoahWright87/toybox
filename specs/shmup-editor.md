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
- `weight`, `color`, `name`: authoring metadata (weight is exported;
  color/name are editor-only, not part of the gameplay shape).

Rotation: footprint-1 tiles get all 4 rotations x flip (8 orientations);
footprint 2/3 tiles only get 0°/180° x flip (4) — rotating a
wider-than-tall tile 90° would make it taller-than-wide, which this grid
can't represent. This mirrors the same resolution the game's L1 generator
uses for the same ambiguity in the source design doc.

## Surfaces

- **Tile list** — every saved tile as a schematic card (edit/duplicate/delete).
- **Tile editor form** — name, footprint picker, per-column north/south
  `EdgeSlot` inputs (tag + "Wall" checkbox), east/west inputs, connector
  toggle, weight, color, with a live schematic preview alongside (rotate/
  flip buttons cycle through every valid orientation). Save is disabled
  until every non-wall edge has a non-empty tag.
- **Connection tester** — pick two tiles + independent orientations for
  each; shows every horizontal alignment where the "below" tile's south
  could attach under the "above" tile's north, per-column tag comparison,
  and whether that alignment actually attaches. This is the "usage" check
  for authored tiles — it exercises the same one-matching-slot-plus-
  vacant-space rule the real generator (L1 #183) uses, including that a
  hard-wall column never presents an attachable frontier.

## Persistence

Per root `CLAUDE.md`'s mandatory rule, the tile library is **fsStore-backed**,
not localStorage: `C:\Programs\Accessories\Shmup Editor\TILES.DAT` holds
the whole library as a versioned JSON array (`{ version, tiles }`), loaded/
saved via `src/experiences/ShmupEditor/tileStore.ts`. A corrupt or
stale-shape save falls back to an empty library rather than crashing
(same defensive-load pattern as `MahjongSolitaire`'s save state). The
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
