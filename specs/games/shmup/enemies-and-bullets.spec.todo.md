# Shmup — Enemies & Bullets Spec (authoring shape, movement/attack vocab, bosses)

> Issues: **L3 #185** (enemy runtime model), **L4 #186** (bullets-as-
> minimal-enemies), **L8 #190** (boss tiles + first hand-coded boss). Part
> of **Epic 5 #181**. Status: design locked, not yet implemented. Source:
> design handoff doc (Claude Chat → Claude Code), 2026-07-04; **reconciled
> 2026-07-16 against Epic 6's shipped `/shmup-editor` authoring model**,
> which was designed and built after this spec's original node-graph draft
> and settled on a materially different content shape (see "What changed"
> below). L3/L4/L8 were never implemented against the original draft, so
> this reconciliation is a plan update, not a migration.
>
> **Stale as of 2026-07-21: the editor reversed its "cut Actions
> entirely" pass and reintroduced them in a new shape, which also folded
> `WeaponDef` into the reintroduced `ActionDef` and added Layers/
> CollisionGroup/per-Part hitboxes.** Every `WeaponDef`/`weapons: WeaponDef[]`
> reference below describes the editor's shape as of the 2026-07-16
> reconciliation, not its current one — see `shmup-editor.md`'s "Unit +
> Encounter editor (E2)" section (the canonical, current source) for the
> real shape: a Unit's/Part's `weapons` buffet is now `actions:
> ActionDef[]`, and what used to be `WeaponDef`'s fields now live under
> `ActionDef.attack`. Since L3/L4/L8 are still unimplemented, this is
> another plan update rather than a migration — the mechanics below (arc/
> count/spacing/sweep, a Weapon-spawns-a-Unit-by-id bullet model, per-Part
> attack tracks) are still substantively accurate, just relocated one
> level of indirection over.

## What changed since the original node-graph draft

The original version of this spec described an enemy as a **node/edge
graph** (nodes own state + dwell + branch condition, edges own one of four
movement primitives). That was the plan *before* `/shmup-editor` (Epic 6)
existed. Once the editor was actually designed and built, it went through
several revisions and landed on a different shape entirely — see
[`shmup-editor.md`](../../shmup-editor.md)'s "Unit + Encounter editor (E2)"
section for the full history. **The editor's shape is now the authoritative
content model**, since it's what actually exists and persists data today;
this spec is rewritten to match it rather than the other way around:

- **No node/edge graph.** An enemy instance walks a **flat ordered list of
  movement steps**, each one a waypoint on a **cubic bezier curve** (not a
  choice of `straightLine`/`wave`/`spiral`/`teleport` primitives).
- **No branch conditions anywhere.** Nothing reads HP or elapsed time to
  jump to a different point in an enemy's authored sequence. This is a
  real capability loss versus the original draft (flee-when-low, enrage,
  phase changes, patience enemies, and L8's non-boss-specific bail-out
  mechanism all depended on it) — see "Branch conditions" below for the
  open question this leaves.
- **Enemies are Units with Parts, not enemies-with-attached-payloads.** An
  enemy definition (`UnitDef`) owns one or more named **Parts** (anchor
  points, e.g. a turret), each with its own reusable **Weapon** buffet —
  not a single attack payload attached to the enemy or to individual
  graph nodes/edges.
- **A bullet is still structurally a minimal enemy** — this part of the
  original design held up. It's now expressed as a Weapon's `spawnUnitId`
  referencing a real `UnitDef` (instead of a nested `BulletDef`), which
  keeps the "recursion is free" property intact. See §7.
- **Everything is time-based; no trigger-kind vocabulary survives.** The
  editor's `continuous`/`onDeath`/`onTrigger`/`onProximity` trigger axis
  was cut entirely in favor of plain scheduled `time` values (a repeating
  attack is just a nonzero fire interval). `onDeath` in particular has no
  replacement — see §6.

**What this means for L3/L4/L8's remaining implementation work**: the job
is no longer "build a node-graph runner." It's "build a runtime that reads
an `EncounterUnit`'s `steps`/`attacks` arrays (already fully specified and
already being authored/persisted by the editor) and simulates bezier
motion + Weapon firing during actual gameplay." The editor's own
`movementPreview.ts`/`weaponPreview.ts` are an *authoring-time
approximation* of this, not the real runtime — see `shmup-editor.md`'s
Movement/Attacks sections for why (no live player at authoring time, fixed
preview bullet speed, etc.) — L3/L4 is where a real, physics-accurate
version of that simulation needs to exist.

## What does NOT change

- `systems/difficulty/difficulty.ts`'s `computeDifficulty()` (the `D`
  formula) is untouched. Numeric stats on Units/Weapons still receive
  their values from the difficulty-budget system
  (`spawn-and-warnings.spec.todo.md`, L5 #187), which generalizes but does
  not replace the *source* of difficulty. (`WeaponDef.spawnScale` is a
  flat multiplier in the editor today — see `shmup-editor.todo.md`'s
  Scope decisions for the deferred budget-scaling system this will
  eventually plug into.)
- The **player** weapon/effect-composition system
  (`systems/effects/projectileBehavior.ts` — pierce/fork/blast/homing,
  `weapons.spec.todo.md`) is completely untouched. L4's "bullets are
  enemies" reshapes only how *enemy* fire is authored; player bullets stay
  on their existing, separate system.

## 1. Enemy definition shape (L3)

An enemy is a **Unit** (`UnitDef`) — sprite + stats (HP, contact damage,
score value, `speed`, `turnRate`, hitbox size) plus `parts: UnitPart[]`, a
set of named anchor points (e.g. a turret), each owning its own reusable
`weapons: WeaponDef[]` buffet. A Unit is authored once and referenced (not
re-authored) from any number of encounter placements — see
`shmup-editor.md`'s "Unit + Encounter editor (E2)" for the exact field
shapes (`unitTypes.ts`).

An **encounter placement** (`EncounterUnit`) is where an enemy's actual
behavior for one specific tile lives:

- `steps: EncounterStep[]` — a **flat ordered list**, not a graph. Each
  step is `{ pos, visible, time, speedMultiplier?, handleIn?, handleOut? }`.
  Consecutive steps form one cubic bezier curve segment each, shaped by
  the steps' own handle offsets and paced by the Unit's `speed`; the
  segment's duration is (numerically integrated) arc length ÷ effective
  speed. `turnRate` caps how far a handle can bend the curve, as a
  multiple of the segment's straight-line length — a purely geometric
  authoring constraint, not a runtime physics simulation.
- `attacks: EncounterAttack[]` — an **unordered** set of `{partId,
  weaponId, time, durationMs, aimAngleOverride?}` placements, scheduled
  independently of the movement steps on the same shared encounter clock.
  A Part's attacks fire from wherever that Part's `offset` puts it on the
  Unit's current bezier position at the attack's own `time`.

The goal is unchanged from the original draft: the vast majority of
enemies need only a sprite reference, a step sequence, and a handful of
Weapon params in the editor (`shmup-editor.todo.md`'s E2) — no new code
for a new enemy. What's different is the concrete shape that authoring
produces.

## Entrance (spawn-time presentation, not a movement primitive)

Unchanged in spirit from the original draft, just re-expressed in step
terms:

- The enemy simply **appears** at its first step's position — there's no
  dedicated "entrance node," the first step in the list *is* the entrance.
- **No dedicated appear-animation vocabulary exists yet.** The original
  draft's "short appear animation" (bubbles before a submarine surfaces,
  a shrinking shadow before a paratrooper lands) has no data-model home
  today — the editor has no per-Unit animation-frame system at all yet
  (see `shmup-editor.todo.md`'s "Animation preview is deferred" item).
  Until that exists, an entrance effect would need to be faked visually
  (e.g. a `visible: false` → `visible: true` step pair at the same
  position, standing in for a "materializes here" beat) rather than
  authored as a real animation.
- Lateral off-screen entry (flying in from the side/top) is just an
  ordinary first step positioned off-tile followed by a second step
  on-screen — the bezier curve between them *is* the entry motion, no
  separate entrance type needed.

## 2. Movement (replaces the four edge primitives)

**There is no `straightLine`/`wave`/`spiral`/`teleport` choice per
segment.** Every segment between two steps is one cubic bezier curve,
shaped by each step's `handleIn`/`handleOut` and paced by the Unit's
`speed`, capped by `turnRate` — see `shmup-editor.md`'s "Movement" section
for the full mechanics. This covers what `straightLine` (including
curving) used to cover, plus arbitrary bulge shapes a single primitive
couldn't express, in one model instead of a per-segment kind choice.

What the old primitives covered that bezier curves alone do **not**:

- **`wave`/`spiral` (oscillation/orbit) are deferred, not ported.** A
  Unit today has no way to author "wobble side to side while otherwise
  advancing" or "orbit a moving anchor point" — those effects require a
  *secondary* offset layered on top of the primary bezier position, which
  doesn't exist as a data-model concept yet. `shmup-editor.todo.md`
  tracks this as a planned per-Unit "constant motion" property
  (`bezierPosition(t) + constantMotionOffset(t)`) — not built, no shape
  decided.
- **Homing (turn-rate toward a live player) is gone, not renamed.** The
  original draft's "`straightLine` with turn-rate dialed toward
  continuously aiming at the player" doesn't exist in the bezier model —
  `turnRate` today is a purely geometric authoring-time clamp on handle
  length, with no runtime player-tracking behavior at all. If a
  genuinely player-homing enemy is still wanted, it needs a new decision:
  either a per-step or per-Unit opt-in flag telling the *runtime* to bend
  the authored curve toward the live player's position (something the
  authoring-time preview can never show, same as the editor's other
  no-live-player approximations), or accept that homing enemies are
  hand-coded outside the data-driven system, same as bosses (§8).
- **`teleport` dissolved into two ordinary steps** — a `visible: false`
  step ("Disappear") followed by a later, differently-positioned
  `visible: true` step ("Reappear") composes to the same visible effect.
  There's no `delay` or `telegraphAtDestination` field distinct from just
  the gap between those two steps' `time` values and the warning-indicator
  system's own lead time (`spawn-and-warnings.spec.todo.md`'s
  `warningLead`).

## 3. Dwell (replaces node dwell behaviors)

**A step at the same position as its predecessor *is* dwell-in-place** —
no separate `wait`/`orbit` vocabulary, no dedicated dwell type. A
zero-length bezier segment has nothing to travel along, so
`shmup-editor.md`'s timing system already special-cases this (the step's
`time` stays manually authored rather than derived from a curve).

**The `scrollLocked`/`timeLocked` reference-frame distinction (holding
position against scroll vs. drifting with it) is still deferred, not
built — this is unaffected by Layers shipping.** `UnitDef.layer`
(Ground/Air/Doodad) shipped as an authored, Unit-level field — a fixed
property of the Unit definition itself, chosen once when authoring the
Unit, **not** an Encounter-level concept and **not** the same thing as the
reference-frame question. Every step today is still a plain tile-relative
canvas position regardless of which layer its Unit belongs to — there's no
`scrollLocked`/`timeLocked` concept anywhere yet, so a Ground Unit and an
Air Unit are scheduled identically even though an Air Unit's position
conceptually shouldn't be tile-relative. Until that lands, whether a
dwelling enemy holds screen position or scrolls with the terrain is
presumably a runtime-only decision (e.g. per enemy archetype) rather than
something the editor lets an author choose per-step. See
`shmup-editor.todo.md`'s E2 Remaining list for the tracked gap.

## 4. Exit

Two of the original draft's three exit types translate directly; the
third does not currently have an authorable equivalent:

1. **`leave`** (travels off in an authored direction) — just an ordinary
   last step positioned off-tile/off-screen; the bezier curve into it is
   the leave motion. No special case needed.
2. **`vanish`** (disappears in place) — a terminal step with `visible:
   false`.
3. **`ram`** (homes toward the player, continues through/off-screen if it
   misses) — **not currently authorable.** Like general homing (§2), this
   needs a live player position at runtime that the authored bezier path
   has no way to reference. A ram enemy would need either a runtime-level
   override (the game engine detects a "ram" flag and dynamically bends
   or replaces the authored final segment toward the live player) or
   hand-coded implementation outside the data-driven system. Composing
   with an `onDeath`-style suicide-bomber burst (old §6) has the
   additional problem that `onDeath` itself was cut — see §6.

## 5. Branch conditions — cut, open question for L3

**No conditional jump exists anywhere in the editor's data model.** The
original draft's single "any node/edge can carry an HP-threshold or
elapsed-time-threshold jump" mechanism doesn't exist; steps play in the
fixed order they're authored in, full stop
(`shmup-editor.md`/`shmup-editor.todo.md`: "Branch conditions remain cut
entirely"). This was a deliberate editor-side simplification (Noah's
"everything will just be time based, it's a shmup after all"), but it
removes the one mechanism the original draft used for:

- Flee-when-low (jump to an exit)
- Enrage (jump to a stronger attack)
- Phase changes (HP-tiered node)
- Patience enemies (passive → aggressive on proximity/damage)
- L8's elapsed-time boss bail-out (see §8)

**This is a genuinely open question, not yet decided**, for whenever L3
implementation starts: either (a) accept these effects are no longer
data-authorable and require hand-coded per-enemy logic same as bosses
(consistent with L8 already being hand-coded), or (b) reintroduce a
narrow, opt-in per-instance HP/time-threshold flag *without* going back to
a full graph (e.g. "past this HP%, add this Weapon" as a Unit/Part-level
property) — a much smaller feature than the original branch-condition
system, scoped to just the enrage/phase-change cases that seem most
worth keeping. No design work has been done on option (b) yet.

## 6. Attack behaviors (Weapons, replaces the shape×aim×trigger matrix)

Attacks are no longer attached to graph nodes/edges — they're independent
per-Part attack-track placements (`EncounterAttack`, §1) referencing a
`WeaponDef` from the firing Part's own buffet. `WeaponDef` replaced the
original three-axis matrix (`shape`: single/arc/radialBurst/beam, `aim`:
fixed/aimed/rotating, `trigger`: continuous/onDeath/onTrigger) with a
flat, orthogonal field set — see `shmup-editor.md`'s "Attacks" section for
the full field list. In summary:

- **Aim**: `fixed` (a base angle, overridable per placement) or `player`
  (tracked or snapshotted — not simulated at authoring time, same
  no-live-player caveat as movement homing above).
- **Arc range + count + spacing + per-shot delay** replaces `single`/`arc`/
  `radialBurst` with one primitive: a narrow arc with few shots is a fan,
  `0°/360°` is a full radial burst, and an asymmetric range (e.g.
  `5°/355°`) is new territory the old matrix couldn't express — a burst
  with a deliberate gap at the aim direction.
- **Sweep** (`sweepSpeedDeg`, `pingPong`) is what the old `rotating` aim
  mode collapses into — a nonzero sweep speed on an otherwise-static arc,
  not a separate mode.
- **No trigger kind survives.** A placement's own `time` already says
  *when* it fires (the old `onTrigger` collapsed into that); a repeating
  burst is just a nonzero `fireIntervalMs` (`continuous`'s replacement).
  **`onDeath` was cut outright, with no time-based replacement** —
  "everything is time-based" leaves no home for a death-triggered event.
  A cluster-bomb-on-death enemy is not currently authorable; if still
  wanted, this needs the same kind of decision as branch conditions (§5)
  — likely a small orthogonal "on-death" flag reintroduced deliberately
  rather than folding it back into a general trigger system.
  **`onProximity` was cut outright too** — no ambush-style
  "fires once the player enters a radius" attack is currently authorable,
  same no-live-player-at-authoring-time reasoning.
- **`beam` was cut, not ported.** A sustained damage line doesn't fit the
  arc/count primitive; the intended replacement is a rapid-fire long/thin
  projectile (a spawned bullet-Unit with a long, thin sprite and a short
  `fireIntervalMs`) rather than a first-class beam type. This also means
  the telegraph-then-fire wind-up beams used to imply is now whatever
  `telegraphMs` a rapid-fire Weapon is separately given, not a
  beam-specific mechanic.

## 7. Bullets are enemies, structurally (L4) — still true, re-expressed

**A bullet is still a minimal enemy, but the mechanism changed.** Rather
than a `BulletDef` nested inside an attack payload, a `WeaponDef` spawns
an actual `UnitDef` by id (`spawnUnitId`) with a flat size multiplier
(`spawnScale`). Since any `UnitDef` can itself have Parts with their own
Weapons, recursion (a bullet whose own fire spawns more bullets) is free
by construction — the same property the original draft wanted, just
falling out of "Weapons reference Units" instead of "attack payloads
nest."

This does raise a **runtime question the editor itself doesn't need to
answer, but L3/L4's implementation will**: an `EncounterUnit` placed
directly in an encounter gets an authored `steps` list to move along, but
a Unit spawned dynamically by a Weapon at runtime has no such authored
path — it only has the spawning Weapon's fire angle and its own `speed`/
`turnRate` stats. **Open question, not yet decided**: does a spawned
bullet-Unit simply travel in a straight line at its fire angle × `speed`
(the simplest reading, and consistent with "no live player to bend a
curve toward" elsewhere in this spec), or does it need its own smaller
authored-motion concept distinct from `EncounterStep`'s tile-relative
waypoints? Splitting/homing/curving bullets described in the original
draft would need this resolved first — "splitting bullet" (a Weapon whose
`spawnUnitId` points at a Unit that itself fires a radial-arc Weapon on
spawn) and "recursive splitting" both still work structurally regardless
of the answer, but "curving"/"homing" bullets depend on it the same way
enemy homing does (§2).

**Fairness default**: bullet-level params (speed, turn rate, shot count)
should still default to `flat` scaling curves rather than aggressive
budget-scaling — same reasoning as enemy movement speed
(`spawn-and-warnings.spec.todo.md`'s fairness default): a bullet that
homes or curves harder as difficulty rises risks becoming unreadable
faster than "more bullets" does. This is unchanged from the original
draft; only the data shape it applies to (`WeaponDef`/spawned `UnitDef`
stats, not `BulletDef` params) is different.

## 8. Boss tiles + first hand-coded boss (L8)

A boss tile (`levels-and-tiles.spec.todo.md`) is a tile with **no open top
edge** — a dead end by construction, terminating a frontier. Unchanged
from the original draft:

- Bosses are **hand-coded**, hooking into §2/§6's primitives where
  convenient, but with bespoke phase scripting beyond what a generic
  mechanism comfortably expresses.
- Multi-part bosses, core-shield mechanics, and other structurally
  distinct boss patterns are explicitly out of scope for this data-driven
  system (see Epic 5 #181's deferred list) — build them as needed,
  per-boss.

**One dependency changed**: the original draft had bosses reuse §5's
branch-condition mechanism for the elapsed-time bail-out ("if the player
takes too long, the boss flees, no kill rewards"). Since branch
conditions are cut (§5) and bosses are hand-coded anyway, this isn't
blocking — a hand-coded boss can just implement its own elapsed-time
check directly, same as everything else about a hand-coded boss. It's
only a loss for *non-boss* enemies that wanted the same bail-out pattern
without being fully hand-coded, which is folded into §5's open question.

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
  the warning-indicator system that reads teleport-style telegraph timing
- [`run-structure.spec.md`](run-structure.spec.md) — `D`, the scalar these
  enemies' stats ultimately derive from
- [`weapons.spec.todo.md`](weapons.spec.todo.md) — the separate player
  weapon/effect-composition system this spec does not touch
- [`../../shmup-editor.md`](../../shmup-editor.md) — the authoring tool
  (Epic 6) whose shipped `UnitDef`/`UnitPart`/`WeaponDef`/`EncounterUnit`
  shapes are now this spec's source of truth for content structure; see
  its "Unit + Encounter editor (E2)" section for the full field-by-field
  model
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
