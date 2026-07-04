# Shmup — Levels & Tiles Spec (grid-fill generation, JIT streaming, camera bounds, biomes)

> Issues: **L1 #183** (tile model + generator), **L2 #184** (JIT streaming + camera
> bounds), **L7 #189** (biome tagging). Part of **Epic 5 #181**. Status:
> design locked, not yet implemented. Source: design handoff doc (Claude
> Chat → Claude Code), 2026-07-04, reconciled against the shipped
> `run-structure.spec.md` (F8 #136).

## What this replaces

Today `PlayScene` renders one unchanging `TileSprite` background
(`TEX.bg`) that scrolls via `tilePositionY -= bgScrollSpeed * dt`, with no
level content variety at all — a node's Play scene looks identical whether
it's node 1 or node 20 of a Season. This spec replaces that single
background with **procedurally assembled, tile-based level content**,
generated just-in-time as the player scrolls forward.

## What does NOT change

The Season → node-map → career meta-structure (`run-structure.spec.md`)
is untouched: `computeDifficulty()`, `generateSeasonMap()`,
`CareerState`, the Boot→Map→Play→Resolve flow. **L7's `biome` tag on
`MapNode` is the only new field this spec adds to that system** — a
generated level's tile-set selection, not its difficulty. `D` continues to
be computed exactly as it is today; this spec's generator consumes it as
an input (see `spawn-and-warnings.spec.todo.md`, L5 #187) but does not
change how it's produced.

## 1. Tile model (L1)

- A tile has a **footprint**: 1x1, 2x1, or 3x1 (width × height, height
  always one "screen" unit — full playfield height per tile).
- A tile has **4 edges** (N/S/E/W in its unrotated orientation), each
  carrying an **edge tag** (string equality is all the matcher needs —
  exact tag taxonomy is an editor/content concern, not an engine one).
- Tiles are **freely rotatable in 90° increments and horizontally
  flippable** — up to 8 usable orientations per drawn tile art asset (no
  fixed "up," this is a top-down/overhead game). Rotating cyclically
  rotates which tag sits on which side; flipping mirrors edge tags and any
  authored spawn-point x-coordinates.
- **Hard-wall edges** are a valid edge-tag value meaning "nothing may
  connect here" — the mechanism that prevents runaway width growth and
  forces the level to narrow back down.
- **Start/end connector tiles**: one per biome (or biome-agnostic),
  enemy-free, used at level start and immediately after a boss tile. They
  trivially match any edge (no spawn content to gate on) — biome-flavored
  art only.
- **Variants**: a tile definition can declare multiple mutually-exclusive
  spawn variants (each a full spawn-node configuration — see
  `spawn-and-warnings.spec.todo.md`). The generator picks one at placement
  time (optionally weighted, e.g. harder variants rarer at low D). This is
  what keeps one tile "personality" from feeling identical every
  placement.

## 2. Grid-fill generation algorithm (L1)

Frontier-based 2D grid fill, adapted from Rogue Legacy-style room
placement for a vertical-scrolling field (x = columns, y = scroll
direction, growing as the level progresses):

1. Generation starts with a single **open edge** at row 0 (width 1).
2. At each step, pick an open edge. Find a tile whose bottom edge tag
   matches (checking all 4 rotations, and the flip axis) and which
   physically fits in the available grid space. Place it. Its top edge(s)
   become new open edges. Remove the edge just filled.
3. **Splits**: a tile with 2+ open top edges creates independent
   frontiers. Each frontier carries its **own difficulty budget** going
   forward and generates independently of its siblings.
4. **Merges**: a tile with 2+ bottom edges accepts multiple incoming
   frontiers and collapses them into fewer open edges going forward.
5. **Diagonals emerge for free**: if a wide tile has only one open top
   edge (the other blocked by a hard wall or grid boundary), the next
   tile is forced to place offset to one side — no special-cased
   "diagonal corridor" logic needed.
6. **No backtracking**: the camera only scrolls forward. Once the player
   commits to one branch of a split, the other branch is never generated
   — don't spend generation budget or spawn logic on unvisited branches.
7. **Termination**: generation for a given frontier stops when a **boss
   tile** (a tile with no open top edge — see `enemies-and-bullets.spec.todo.md`'s
   L8 #190) is placed, or a level-length/budget threshold is hit.

This is pure, seedable, unit-testable logic with no Phaser/scene
dependency — mirror `systems/map/generateMap.test.ts`'s deterministic
mulberry32-seeded-RNG approach so generation is reproducible for a given
seed, the same way the Season node-map already is.

## 3. JIT streaming (L2)

- **Do not pre-generate a full level.** Generate tiles on demand as the
  player approaches the current frontier — trigger generation when the
  player is within a configurable distance of the next open edge.
- Only a handful of tiles are resident in memory at once: one behind (for
  despawn once fully scrolled off), the current tile, and 1-2 ahead
  (pre-built to avoid pop-in).
- The frontier data structure (open edges + their per-branch budget
  state) is small and cheap to keep around for the whole level; tile
  *contents* are not persisted beyond what's near the player.

## 4. Camera & bounds-box behavior (L2)

- The camera framing itself does not need to animate when tile width
  changes — desktop viewports are wide enough to just show more/less
  active width with margin/parallax background filling unused space;
  mobile viewports are already narrow and simply pan.
- What **does** need to animate is the **playable bounds box** — the
  min/max x the player's ship may occupy. This eases (~0.5-1s) whenever
  the level transitions into a wider or narrower section: an invisible
  wall moving instantly is what disorients players, not the art getting
  wider.
- Shared abstraction between desktop and mobile:
  - The tile/level system emits "legal x-bounds for this section."
  - Desktop camera controller: grows/shrinks its active frame to that
    bound (margin if narrower than viewport).
  - Mobile camera controller: treats it as a pan target, always clamped
    to its own (narrower) viewport width.
- No bespoke per-platform camera code should be needed beyond this
  interpretation layer.

## 5. Biomes (L7)

- Biomes (water, dirt, woods, city, desert, etc.) are primarily an **art +
  edge-tag** concern, not a separate logic system — biome-appropriate
  connector tiles, edge tags, and flavor of appear animation
  (`enemies-and-bullets.spec.todo.md` §Entrance) are the only
  biome-specific hooks needed structurally.
- **Integration point with the existing map system**: `MapNode`
  (`systems/map/types.ts`) gains a `biome: BiomeId` field, threaded
  through `generateSeasonMap()` (weighted per node type, similar in
  spirit to existing special-node-chance-by-Ratings-rank weighting — flat
  weighting is acceptable for MVP) and into `EpisodeLaunchData`
  (`scenes/sceneData.ts`). `PlayScene`'s tile generator reads
  `episode.biome` to pick which tile-set to draw tiles from. This is the
  **only** new field the whole Epic 5 design adds to the existing
  Season/node-map/`D` system — nothing about scaling, node types, or
  career progression changes.
- Start/end connector tiles are biome-agnostic or carry biome-flavored art
  variants per §1 above; they never gate on biome logically, only
  visually.

## Related

- [`run-structure.spec.md`](run-structure.spec.md) — the Season/node-map/`D`
  system this spec plugs into via the `biome` field only
- [`enemies-and-bullets.spec.todo.md`](enemies-and-bullets.spec.todo.md) —
  the enemy node-graph system that populates generated tiles, and boss
  tiles (L8)
- [`spawn-and-warnings.spec.todo.md`](spawn-and-warnings.spec.todo.md) —
  spawn nodes (which live on tile variants) and the difficulty-budget
  system tiles/spawn-nodes consume
- [`content-and-assets.spec.md`](content-and-assets.spec.md) — sprite
  registry conventions tile art should follow
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
