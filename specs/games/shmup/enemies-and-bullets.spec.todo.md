# Shmup — Enemies & Bullets Spec (node-graph model, bullets-as-enemies, bosses)

> Issues: **L3 #185** (enemy node-graph model), **L4 #186** (bullets-as-
> minimal-enemies), **L8 #190** (boss tiles + first hand-coded boss). Part
> of **Epic 5 #181**. Status: design locked, not yet implemented. Source:
> design handoff doc (Claude Chat → Claude Code), 2026-07-04.

## What this replaces

Today `entities/Enemy.ts` has exactly two shapes of behavior: a
`drone`/`elite` that drifts straight down (`body.setVelocity(0,
moveSpeed())`) and fires one bullet straight at the player's general
direction on a cooldown, or a `boss` that bounces side-to-side. There is
no path/graph concept, no wave/spiral/teleport movement, no branch
conditions, and `entities/EnemyBullet.ts` is a plain pooled straight-line
sprite with no pattern authoring at all. This spec replaces both with a
small, composable vocabulary so new enemies are data, not code.

## What does NOT change

- `systems/difficulty/difficulty.ts`'s `computeDifficulty()` (the `D`
  formula) is untouched. This spec's node-graph enemies still receive
  their numeric stats from the difficulty-budget system
  (`spawn-and-warnings.spec.todo.md`, L5 #187), which generalizes but does
  not replace the *source* of difficulty.
- The **player** weapon/effect-composition system
  (`systems/effects/projectileBehavior.ts` — pierce/fork/blast/homing,
  `weapons.spec.todo.md`) is completely untouched. L4's "bullets are
  enemies" reshapes only how *enemy* fire is authored; player bullets stay
  on their existing, separate system.

## 1. Enemy definition shape (L3)

An enemy is a **node graph**: a set of nodes connected by directed edges,
with one designated entrance node. Static enemies (turrets etc.) may have
no exit at all — they just scroll off with the tile.

- **Nodes** own *state*: a position, optionally a **dwell behavior** (§3)
  and/or a **branch condition** (§5).
- **Edges** own *transition*: a single **movement behavior** (§2)
  describing travel from one node to the next.
- Both nodes and edges can independently carry an **attack payload** (§6)
  — attacking is a parallel track, not owned by the path.

The goal: the vast majority of enemies need only a sprite reference, a
node/edge layout, and movement/attack/scaling params in the editor
(`specs/shmup-editor.todo.md`'s E2) — no new code.

## Entrance (spawn-time presentation, not a movement behavior)

- The enemy simply **appears** at its entrance node position.
- Some enemies have **no appear animation** (a tank rolling out of a
  factory door — the factory art itself sells it).
- Some have a **short appear animation** (bubbles/shadow before a
  submarine surfaces; a shrinking shadow-then-landing beat for a
  paratrooper).
- Authored per-enemy as an animation/timing property. If the entrance
  node's first outgoing edge exists, the appear animation plays first,
  then the edge begins.
- Lateral off-screen entry (flying in from the side/top) is just
  `straightLine` or `wave` (§2) used on the first edge — not a separate
  entrance type.

## 2. Movement behaviors (edges)

Four primitives, each edge uses exactly one, parameterized:

1. **`straightLine`** — point A to point B. Params: speed, optional
   accel/decel curve (covers "starts slow then charges" and
   boomerang-style out-and-back via negative velocity after reaching a
   point). A turn-rate/curve param also covers curving paths; **homing is
   `straightLine` with turn-rate dialed toward "aim continuously at
   player,"** not a separate movement type.
2. **`wave`** — oscillates perpendicular to a base path A→B. Params:
   amplitude, frequency, phase offset, `waveform` (smooth / triangle /
   square).
3. **`spiral`** — a center point travels A→B; the enemy orbits that
   center. Params: radius, angular speed, radius growth/decay (constant
   orbit vs. tightening/widening corkscrew).
4. **`teleport`** — vanish at A, reappear at B after a delay. Params:
   delay, `telegraphAtDestination` toggle (shimmer/warning at B before
   reappearing — ties into `spawn-and-warnings.spec.todo.md`'s L6 #188).

An enemy's full path is a **chain** of these across multiple nodes (e.g.
`straightLine` in → `wave` across the middle → `straightLine` out).

## 3. Node dwell behaviors

What a node does *while occupying it* (as opposed to moving between
nodes):

- **`wait`** — hold position. Toggle: `scrollLocked` (drifts with
  scrolling terrain — a ground unit standing still) vs. `screenLocked`
  (actively holds screen position against scroll — a hovering
  helicopter).
- **`orbit`** — spiral-in-place (radius/speed params, same scroll/screen
  lock toggle). This is `spiral` (§2) with start = end point, used as a
  dwell rather than a transit.

## 4. Exit

Three exit types, on the final node of a graph (static/scroll-off enemies
don't need one):

1. **`leave`** — travels off in an authored direction (mirrors
   entrance-adjacent `straightLine`/`wave` movement out of frame).
2. **`vanish`** — disappears in place (submarine dive, teleport-out).
3. **`ram`** — homes toward the player's position and continues
   through/off-screen if it misses. Composes with attack payloads: a ram
   enemy with no attack is a pure collision threat; paired with an
   `onDeath` burst (§6), it's a suicide bomber.

## 5. Branch conditions (generalizes "flee at low HP")

Any node or edge can carry an optional **branch condition**: if the
enemy's current HP crosses a defined threshold, OR elapsed time in the
encounter crosses a threshold, the graph jumps to a different node
instead of continuing normally. One mechanism covers:

- Flee-when-low (jump to an exit node)
- Enrage (jump to a node with a faster/stronger attack payload)
- Phase changes (jump to a node with a different movement/attack combo
  per HP tier)
- "Patience" enemies (start passive, branch to aggressive once damaged or
  once the player enters proximity — see §6's `onProximity` trigger)
- **Boss bail-out** (L8, elapsed-time-based, not HP-based): if the player
  takes too long, the boss (or any enemy) leaves via this same jump
  mechanism. **No kill rewards (XP/coins) are granted** when an enemy
  leaves this way — a real cost for playing too slowly, not a soft
  fail-state.

## 6. Attack behaviors (parallel track)

Independent of the movement graph — flagged active during any node or
edge, as an on/off + config toggle on that graph segment. Three
orthogonal axes:

- **Pattern shape**: `single`, `arc` (fan/spread), `radialBurst` (full
  circle), `beam` (sustained line, requires a telegraph phase — see
  `spawn-and-warnings.spec.todo.md`'s L6 #188).
- **Aim mode**: `fixed` (set direction), `aimed` (tracks or snapshots
  player position), `rotating` (sweeps over time — covers "spiral,
  shooting as it spins," independent of whether the enemy itself moves in
  a spiral).
- **Trigger**: `continuous` (fires on interval while active), `onDeath`
  (fires once on death — cluster-bomb case), `onTrigger`
  (telegraph-then-fire, e.g. beam wind-up), `onProximity` (fires once the
  player enters a defined radius/region — ambush-style enemies otherwise
  passive).

## 7. Bullets are enemies, structurally (L4)

Rather than a separate bullet-behavior system, **a bullet is a minimal
enemy**: it has a position, a movement using the same `straightLine`/
`wave`/`spiral` vocabulary and params (§2 — turn-rate, accel/decel)
without needing entrance/exit concepts (spawn = entrance, expire/collide
= exit), and it can optionally carry its **own nested attack payload**
(§6), reused wholesale.

This gets splitting/bloom/homing/curving/boomerang bullets for free:

- "Splitting bullet" = a bullet with a `radialBurst`/`arc` attack payload
  triggered `onTimer`/`onProximity`/`onExpire`.
- "Boomerang bullet" = `straightLine` with a decel-then-negative-velocity
  curve.
- "Homing bullet" = `straightLine` with turn-rate dialed toward
  continuous aim-at-player.
- **Recursion is free**: a bullet's attack payload can itself spawn
  bullets with their own payloads, so splitting-bullets-that-spawn-
  splitting-bullets requires no special-case code — it falls out of
  reusing the same data structure at a smaller scale.

**Fairness default**: bullet-level params (speed, turn rate, split count)
default to `flat` scaling curves rather than budget-scaling — same
reasoning as enemy movement speed
(`spawn-and-warnings.spec.todo.md`'s fairness default): a bullet that
homes or curves harder as difficulty rises risks becoming unreadable
faster than "more bullets" does. Enemy-level params (fire rate, count,
damage) stay the primary scaling lever.

## 8. Boss tiles + first hand-coded boss (L8)

A boss tile (`levels-and-tiles.spec.todo.md`) is a tile with **no open top
edge** — a dead end by construction, terminating a frontier. Unlike
regular enemies:

- Bosses are **hand-coded**, hooking into §2/§6's primitives where
  convenient, but with bespoke phase scripting beyond what §5's generic
  branch-condition mechanism comfortably expresses.
- Bosses reuse the §5 elapsed-time bail-out mechanism — if the player
  takes too long, the boss flees and the encounter ends without kill
  rewards. This is the same mechanism any enemy uses, not boss-specific
  code.
- Multi-part bosses, core-shield mechanics, and other structurally
  distinct boss patterns are explicitly out of scope for this data-driven
  system (see Epic 5 #181's deferred list) — build them as needed,
  per-boss.

## Explicitly deferred (post-MVP, do not build now)

- **Enemy-to-enemy relationships**: buffs, shields, heals, jammers,
  spotter/artillery pairs, formation-leader-death-causes-scatter. These
  require enemies to reference each other's state, which nothing here
  supports. Worth a follow-up "link/aura" layer once the base system is
  solid.
- **Unique/bespoke multi-part bosses** beyond the first hand-coded boss
  (L8) — intentionally hand-coded per-boss, not data-driven.

## Related

- [`levels-and-tiles.spec.todo.md`](levels-and-tiles.spec.todo.md) — tile
  model and boss-tile placement (L1/L2/L7)
- [`spawn-and-warnings.spec.todo.md`](spawn-and-warnings.spec.todo.md) —
  the difficulty-budget system that scales this spec's numeric params, and
  the warning-indicator system that reads `telegraphAtDestination`/beam
  telegraph timing
- [`run-structure.spec.md`](run-structure.spec.md) — `D`, the scalar these
  enemies' stats ultimately derive from
- [`weapons.spec.todo.md`](weapons.spec.todo.md) — the separate player
  weapon/effect-composition system this spec does not touch
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
