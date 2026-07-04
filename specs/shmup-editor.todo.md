# Shmup Level & Enemy Editor — TODOs (PRD)

> Epic: **[Shmup Editor] Epic 6 #182**. Issues: **E1 #191** (tile editor),
> **E2 #192** (enemy editor), **E3 #193** (spawn node editor), **E4 #194**
> (preview/playtest), **E5 #195** (export/import pipeline). Status: design
> locked, nothing built yet. Source: design handoff doc (Claude Chat →
> Claude Code), 2026-07-04.

## What this is

A new browser-based authoring tool, served at **`/shmup-editor`**, used to
create tiles, enemy definitions, and spawn configurations for the shmup
game's data-driven level system (`specs/games/shmup/levels-and-tiles.spec.todo.md`,
`enemies-and-bullets.spec.todo.md`, `spawn-and-warnings.spec.todo.md`). It
outputs JSON files that a human commits into the `games/shmup` workspace
as static content.

## Why a route in the main app, not inside games/shmup

`games/shmup/` is a separately-built Vite/Phaser bundle, outside the main
Doors 97 app's router — it can't import `fsStore` or
`@noahwright/design` without pulling the whole main app into its bundle
(see `specs/games/shmup/content-and-assets.spec.md`'s FS-override notes
for the same constraint on sprite overrides). The editor is a
content-authoring tool, not a live game system: it doesn't need Phaser,
and building it as an ordinary React route keeps it inside this repo's
standard experience conventions (retro Win95 chrome, `@noahwright/design`
components, this spec file).

**The editor and the game do not share a live connection.** The editor's
job is to produce valid JSON; landing that JSON inside `games/shmup` is a
separate, manual (for now) step — see E5 below.

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

### E1 — Tile editor (#191)

Import/sketch background art per footprint (1x1/2x1/3x1), assign edge
tags per side (with an 8-orientation rotate/flip preview), define one or
more mutually-exclusive spawn variants per tile, mark hard-wall edges,
mark start/end connector tiles. Outputs tile JSON matching
`levels-and-tiles.spec.todo.md`'s data model.

### E2 — Enemy editor (#192)

Pick sprite/image, build the node graph visually (place nodes, draw
edges), assign a movement behavior + params per edge, dwell behavior +
params per node, entrance appear-animation, exit node + exit type, attack
payloads on nodes/edges, branch conditions, per-param scaling curves, and
nested bullet payload(s) recursively via the same interface. Outputs
enemy JSON matching `enemies-and-bullets.spec.todo.md`'s data model.

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
  for exported tiles/enemies/spawn-nodes/biome tile-sets.
- Whether the editor's own authoring state (in-progress, unexported work)
  persists via `fsStore` per this repo's mandatory reload-survival rule
  (root `CLAUDE.md`) — likely yes, since it's a main-app experience like
  any other; needs a stable FS path/ID once E1 construction starts.
- Whether tile/enemy art in the editor reuses the shmup sprite-registry
  manifest convention (`content-and-assets.spec.md`) directly, or needs
  its own lighter-weight asset-reference scheme suited to sketch/import
  workflows.

## Related

- [`games/shmup/levels-and-tiles.spec.todo.md`](games/shmup/levels-and-tiles.spec.todo.md)
- [`games/shmup/enemies-and-bullets.spec.todo.md`](games/shmup/enemies-and-bullets.spec.todo.md)
- [`games/shmup/spawn-and-warnings.spec.todo.md`](games/shmup/spawn-and-warnings.spec.todo.md)
- [`games/shmup/overview.spec.todo.md`](games/shmup/overview.spec.todo.md) — spec map for the game this tool authors content for
- `src/experiences/Hellzone/HellMapEditor.tsx` — closest existing in-repo editor precedent (different game/data model)

## Reminders

- Move completed items to a `shmup-editor.md` spec once E1 ships — this
  file is the PRD/roadmap, not current state.
