# Shmup — Difficulty Budget & Warning Indicators Spec

> Issues: **L5 #187** (spawn nodes + generalized scaling), **L6 #188**
> (warning indicators). Part of **Epic 5 #181**. Status: §1's budget
> concept and §3's warnings are design-locked, not yet implemented. §2's
> standalone "spawn node" model is **superseded** — the count/power half
> of L5 shipped in `/shmup-editor` Epic 6 E3 as a tab on an already-placed
> Unit instance, not a separate concept; see §2 below. Source: design
> handoff doc (Claude Chat → Claude Code), 2026-07-04, reconciled against
> the shipped `systems/difficulty/curves.ts` + `archetypes.ts` (F8 #136)
> and the shipped `/shmup-editor` scaling model.

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
per-instance count/power scaling (§2 below), and per-param enemy/bullet
stat scaling (`enemies-and-bullets.spec.todo.md`). Design once, reference
everywhere:

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
- **Count/power allocation**: shipped as `/shmup-editor`'s per-instance
  `UnitScaling`/`resolveScaling()` (see §2) — `count = min(floor(budget /
  minCostPerInstance), maxCount)`, then `power = floor(budget / count)`,
  the whole remaining budget divided evenly across however many instances
  actually spawned. No separate `powerSplit` currency: a cheap
  `minCostPerInstance` against a low `maxCount` behaves like "power only"
  (a miniboss that hits its count cap fast and dumps the rest of the
  budget into one or two instances); an expensive `maxCount` against a
  high one behaves like "count only" (a swarm, budget spread thin).

Existing `ARCHETYPE_EMPHASIS`-style per-archetype leans (e.g. elite leans
HP/damage, drone leans density) are re-expressible as authored per-param
curve-type + rate choices on an enemy definition — no separate emphasis
table needed once every param can independently choose its own curve.

## 2. Per-instance scaling (shipped — supersedes the original spawn-node design)

This section originally specified a standalone "spawn node" concept
living on a tile variant, parallel to and separate from placed enemies —
its own origin/shape/distribution/timing model. Noah corrected that
during Epic 6 E3: there is no separate spawn-node kind of thing. An
editor author places a Unit instance exactly as always (steps +
Parts/Weapons on the existing timeline, not a node graph) and opts it
into duplication via a **Scaling tab on that same instance**. Duplicates
replay the instance's entire authored step/attack sequence independently,
anchored to their own slot — there's no separate authoring surface for
"the group" as a distinct entity from "the enemy."

**See `specs/shmup-editor.md`'s "Per-instance scaling (E3)" section for
the full shipped design** — `UnitScaling`'s fields, the four positioning
shapes (Curve/V/Grid/Ring, replacing this section's old origin-type +
distribution + direction + mirror fields with real draggable canvas
handles), ping-pong mirroring, and `resolveScaling()`'s count/power
formula (§1 above). `specs/shmup-editor.todo.md`'s "Per-instance scaling
(E3)" entry tracks what's shipped vs. remaining (notably: the
encounter-wide difficulty-preview slider, and spawn delay not yet on the
shared timeline).

No leader-death/scatter logic for scaled instances (see Epic 5 #181's
deferred list) — each duplicate runs its own copy of the instance's
step/attack sequence independently once spawned.

## 3. Warning indicators (L6)

> **Reconciled 2026-07-25** — this is, and always was, a `games/shmup`
> runtime concern, not something `/shmup-editor` builds or surfaces (see
> `shmup-editor.todo.md`'s E4 entry, corrected the same day — its preview
> mode explicitly does not try to build toward this). More importantly,
> the concept itself was too narrow: framing this purely as "spawns are
> predetermined, so telegraph them ahead of time" undersells what's
> actually needed. The real system is **generic**, covering anything
> currently off-screen — not just a not-yet-spawned enemy — especially
> something actively moving toward the play area (an enemy that entered
> the tile off-camera and is closing in, not only the moment-of-spawn
> case). Spawn-triggered warnings (below) are the scripted-timing special
> case of this general system, not the whole of it.

Because all spawn timing is predetermined (part of the hidden
difficulty-budget-driven schedule, not literally random), the game always
knows N seconds ahead of a spawn that it's coming — this is the
spawn-triggered slice of the generic off-screen/approaching-threat system
described above, automatically driven by schedule data, never manually
authored per-enemy:

- **Edge marker**: an arrow/bubble at the screen edge pointing toward an
  off-screen spawn location, for anything entering via lateral movement
  from outside the visible field. The same marker generalizes to any
  currently off-screen threat closing on the play area, not just one
  that hasn't spawned yet — a fast air Unit that's already alive but still
  outside the camera's bounds needs the identical treatment.
- **On-field marker**: an exclamation/flash at the exact on-field spawn
  point, for `appear`/static-entrance enemies (factories, turrets,
  hazards) that materialize inside the visible tile.
- **`warningLead`** (how far ahead of actual spawn the indicator appears)
  is tunable per enemy/Unit instance, not a single global constant —
  faster-entering enemies need more lead time than slow ones, since the
  goal is equal *reaction time*, not equal *warning time*. For the
  generic off-screen case (not a fresh spawn), the equivalent lead isn't a
  fixed delay but a distance/time-to-arrival threshold computed from the
  threat's actual position and speed.
- `teleport`'s `telegraphAtDestination` toggle and beam attacks'
  `onTrigger` telegraph phase (both `enemies-and-bullets.spec.todo.md`)
  are the same underlying concept applied at smaller scale — a visible
  warning before a state change becomes live.

This system exists specifically so predictable/scripted spawns — and
anything else currently outside the visible play area — never feel like a
cheap shot. Nothing should become dangerous without a preceding, readable
signal, whether it's about to spawn or is already alive and closing in
from off-screen.

## Related

- [`levels-and-tiles.spec.todo.md`](levels-and-tiles.spec.todo.md) — tiles
  and tile variants, which scaled Unit instances live on
- [`enemies-and-bullets.spec.todo.md`](enemies-and-bullets.spec.todo.md) —
  the enemy/bullet Unit-instance model (steps + Parts/Weapons, not a node
  graph) this spec's budget scales
- [`shmup-editor.md`](../../shmup-editor.md) — the shipped `/shmup-editor`
  per-instance scaling design §2 points to
- [`run-structure.spec.md`](run-structure.spec.md) — `computeDifficulty()`,
  the source of `D` this spec's budget derives from
- [`tuning.spec.todo.md`](tuning.spec.todo.md) — where the concrete curve
  rate/cap/threshold constants for new content will live, same as every
  other numeric lever
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
