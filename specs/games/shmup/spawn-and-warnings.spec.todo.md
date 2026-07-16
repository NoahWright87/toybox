# Shmup — Spawn Nodes, Difficulty Budget & Warning Indicators Spec

> Issues: **L5 #187** (spawn nodes + generalized scaling), **L6 #188**
> (warning indicators). Part of **Epic 5 #181**. Status: design locked,
> not yet implemented. Source: design handoff doc (Claude Chat → Claude
> Code), 2026-07-04, reconciled against the shipped
> `systems/difficulty/curves.ts` + `archetypes.ts` (F8 #136).

## What this generalizes (does not replace)

Today, per-stat scaling is a fixed set of bespoke, hardcoded curve
functions (`hpCurve`, `dmgCurve`, `speedCurve`, `fireRateCurve`,
`densityCurve`, `rewardCurve` in `curves.ts`), each with its own authored
shape (linear+quadratic, sqrt, etc.), combined with a small, fixed
per-archetype emphasis table (`ARCHETYPE_EMPHASIS` in `archetypes.ts` —
exactly `drone`/`elite`/`boss`). This spec generalizes that into an
**attachable curve-type system** any numeric param can opt into, so new
enemy/spawn content doesn't require new curve functions or archetype
entries. **`D`
(`systems/difficulty/difficulty.ts`'s `computeDifficulty()`) remains the
single scalar feeding all of this** — this spec does not change how `D`
itself is computed, only what consumes it.

## 1. Difficulty budget (shared system)

Referenced by tile-variant weighting (`levels-and-tiles.spec.todo.md`),
spawn-node scaling (§3 below), and per-param enemy/bullet stat scaling
(`enemies-and-bullets.spec.todo.md`). Design once, reference everywhere:

- **Difficulty budget**: a number derived from `D` (the existing
  escalation scalar — season/episode/stage-offset/mapLag, unchanged).
  Allocated to a tile, then further allocated across that tile's active
  spawn points by an editor-authored per-spawn-point weight (e.g.
  "factory gets 40% of this tile's budget, turrets get 60%").
- **Scaling curve types**, attachable to any individual numeric parameter
  (bullet count, fire rate, damage, HP, spawn count, arc width, spiral
  radius, etc.):
  - `flat` — never scales, ignores budget entirely.
  - `linear` — value = base + rate × budget.
  - `capped` — linear up to a max, then flat.
  - `stepped` — jumps at defined budget thresholds (tiers).
- **Fairness default**: movement speed and homing/turn-rate strength
  default to `flat` or tightly `capped` even in contexts where other
  params scale freely. More bullets/HP/damage reads as "harder";
  faster/more-homing tends to read as "unfair" past a fairly low ceiling.
  This is a deliberate per-param choice in the editor (`specs/shmup-editor.todo.md`'s
  E2), not an accidental side effect of a global scaling toggle.
- **Spawn-node count/power allocation**: a spawn node defines `minCount`,
  `maxCount`, and a `powerSplit` percentage (0-100) describing how
  incoming budget divides between buying more count vs. buying more
  power/tier per existing unit. `powerSplit = 0` behaves like "count
  only" (weak, ever more numerous — a swarm). `powerSplit = 100` with
  `maxCount = 1` behaves like "power only" (a miniboss that never
  duplicates, only gets stronger).

Existing `ARCHETYPE_EMPHASIS`-style per-archetype leans (e.g. elite leans
HP/damage, drone leans density) are re-expressible as authored per-param
curve-type + rate choices on an enemy definition — no separate emphasis
table needed once every param can independently choose its own curve.

## 2. Spawn nodes

A **spawn node** lives on a tile variant (`levels-and-tiles.spec.todo.md`
§1) and defines how a group of enemies (each running the same underlying
Unit definition — steps + Parts/Weapons, not a node graph; see
`enemies-and-bullets.spec.todo.md`, reconciled against Epic 6's shipped
`/shmup-editor` authoring model) come into existence together.

- **Origin type**: `point` (single fixed location, e.g. a factory door),
  `region` (a box/rect, scattered/random placement), or `shape` (a
  template of relative positions — V, arc, line, grid).
- **Distribution**: `random` (for `region` origins) or `ordered` (fixed
  relative positions, for `shape` origins).
- **Shape definition**: authored as **normalized boundary positions**
  (e.g. a V spanning 25-75% of tile width), not fixed absolute positions
  per-count. Spacing between individuals is derived programmatically from
  the current spawn count filling that boundary — a count of 3 spaces
  widely, a count of 15 packs tightly, same shape either way. This
  decouples shape authoring entirely from count scaling.
- **Direction**: a rotation applied to the shape (e.g. a V oriented from
  north vs. northwest vs. west) — one angle param, not a separate shape
  per direction.
- **Mirror**: boolean; reflects the entire origin (post-rotation) across
  a center axis, spawning a second full copy of the group. Composes with
  any origin type — mirroring a point spawns two factories, mirroring a
  shape mirrors the formation.
- **Timing**: first-spawn delay, interval between individual spawns (0 =
  simultaneous, >0 = staggered queue), and total count (fixed, or "until
  tile ends").
- **Scaling**: uses §1's shared system — `minCount`, `maxCount`,
  `powerSplit`.

No leader-death/scatter logic for spawn groups (see Epic 5 #181's
deferred list) — each individual in a group runs its own copy of the
enemy graph independently once spawned.

## 3. Warning indicators (L6)

Because all spawn timing is predetermined (part of the hidden
difficulty-budget-driven schedule, not literally random), the game always
knows N seconds ahead of a spawn that it's coming. Warnings are
**automatically triggered off spawn timing**, never manually authored
per-enemy:

- **Edge marker**: an arrow/bubble at the screen edge pointing toward an
  off-screen spawn location, for anything entering via lateral movement
  from outside the visible field.
- **On-field marker**: an exclamation/flash at the exact on-field spawn
  point, for `appear`/static-entrance enemies (factories, turrets,
  hazards) that materialize inside the visible tile.
- **`warningLead`** (how far ahead of actual spawn the indicator appears)
  is tunable per enemy/spawn-node, not a single global constant — faster-
  entering enemies need more lead time than slow ones, since the goal is
  equal *reaction time*, not equal *warning time*.
- `teleport`'s `telegraphAtDestination` toggle and beam attacks'
  `onTrigger` telegraph phase (both `enemies-and-bullets.spec.todo.md`)
  are the same underlying concept applied at smaller scale — a visible
  warning before a state change becomes live.

This system exists specifically so predictable/scripted spawns never feel
like a cheap shot — nothing should become dangerous without a preceding,
readable signal.

## Related

- [`levels-and-tiles.spec.todo.md`](levels-and-tiles.spec.todo.md) — tiles
  and tile variants, which spawn nodes live on
- [`enemies-and-bullets.spec.todo.md`](enemies-and-bullets.spec.todo.md) —
  the enemy/bullet node-graph model this spec's budget scales
- [`run-structure.spec.md`](run-structure.spec.md) — `computeDifficulty()`,
  the source of `D` this spec's budget derives from
- [`tuning.spec.todo.md`](tuning.spec.todo.md) — where the concrete curve
  rate/cap/threshold constants for new content will live, same as every
  other numeric lever
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
