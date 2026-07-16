# Shmup Level & Enemy Editor — TODOs (PRD)

> Epic: **[Shmup Editor] Epic 6 #182**. Issues: **E1 #191** (tile editor —
> partially shipped, see `shmup-editor.md`), **E2 #192** (Unit +
> Encounter editor — shipped minus layers and per-param scaling curves,
> see `shmup-editor.md`), **E3 #193** (spawn node editor — shipped minus
> the same per-param scaling-curve retrofit, see `shmup-editor.md`'s
> "Spawn nodes (E3)" section), **E4 #194** (preview/playtest), **E5 #195**
> (export/import pipeline). Source: design handoff docs (Claude Chat →
> Claude Code), 2026-07-04 and 2026-07-11.

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
- ~~Attach spawn variants to a tile~~ — resolved, not by building a new
  variant concept: `EncounterDef` (E2) already *is* a tile variant (its own
  weighted-random-pick doc comment), so E3 attached spawn nodes there
  instead. See `shmup-editor.md`'s "Spawn nodes (E3)" section.
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

### E2 — Unit + Encounter editor (#192) — shipped, minus scaling/layers

**Revised four times.** The first pass put a full movement/dwell/attack
node-graph directly on the enemy definition. That didn't match the
intended content model, so it was corrected to enemy-is-stats-only with
the graph moved onto the encounter. A second design pass (external
design-handoff doc, 2026-07) went further: enemies were renamed **Units**,
each owning a reusable buffet of named **Actions**, and encounters became a
**flat ordered step list** instead of a node/edge graph. A third pass added
the **timeline scrubber** and cut the step-level Trigger system in favor of
a plain `time` field once a real timeline existed to preview against. A
fourth pass replaced per-Action movement kinds (straightLine/wave/spiral)
with a single **bezier-curve** model driven by two plain Unit stats
(`speed`/`turnRate`) — see below. See `shmup-editor.md`'s "Unit + Encounter
editor (E2)" section for the full current design; this entry describes
what actually shipped.

**Done**:
- **Units** are sprite + stats (HP, contact damage, score value, base
  speed, hitbox size) **plus** a reusable `actions: ActionDef[]` buffet —
  `UnitStatsForm.tsx` (stats fields plus an Actions list, New/Edit/Delete,
  `ActionEditor.tsx` for the individual Action). `UnitList.tsx` is the same
  visual-checker sprite grid as the tile list. Every Unit is seeded with
  one mandatory idle Action; the last remaining Action can't be deleted.
- **Encounters** still belong to a tile (`TileDef.encounters`) and are
  still authored from inside the tile editor (Encounters section on
  `TileEditorForm.tsx`, New/Edit/Delete). Editing one opens
  `EncounterEditor.tsx`: a tap-driven canvas that can host multiple
  independent Unit instances (`EncounterUnit`), each walking a **flat
  ordered `steps: EncounterStep[]` list** — `{ pos, actionId, time,
  aimAngleOverride?, speedMultiplier? }` — instead of a node/edge graph.
  `encounterSteps.ts` replaces the old graph-CRUD module with plain array
  operations (`addStep`/`updateStep`/`moveStep`/`deleteStepsFrom`/
  `activeStepAt`). The tile's real footprint/edges still render as a
  read-only reference frame (`EncounterTileFrame.tsx`, unchanged) so step
  placement is meaningful relative to where the tile actually connects to
  its neighbors.
- **Dwell, Entrance/Exit, and Teleport all dissolved** into ordinary
  Actions/steps rather than surviving as dedicated types: dwell is an
  Action with `movement: null`; entrance/exit are just the first/last step
  in an instance's list; teleport is a `visible: false` Action (Disappear)
  followed by a differently-positioned `visible: true` Action (Reappear).
  `DwellForm.tsx`/`EntranceForm.tsx`/`ExitForm.tsx` and the `Teleport`
  movement primitive were deleted, not kept around unused.
- **Timeline scrubber + live motion preview** (`EncounterTimeline.tsx`,
  `movementPreview.ts`): the step-level `Trigger` system (four kinds:
  always/unitPosition/playerPosition/time) was cut entirely in favor of a
  plain `time: number` per step, once a real timeline scrubber existed to
  make the indirection pointless — `"always"` was just "whenever the
  previous step ends," and `"playerPosition"` was never actually
  previewable (depends on the live player, which doesn't exist at
  authoring time). Every unit instance's steps share **one clock for the
  whole encounter**, not a clock per instance, so units can be
  choreographed against each other. Play/scrubbing runs a live position
  preview on the canvas (a teal marker distinct from the authored orange
  waypoints), computed by re-deriving each movement primitive's formula
  over elapsed time — a step's `pos` is now a waypoint a unit travels
  *toward*, not a place it teleports between. `turnRate` (homing toward
  the player) isn't simulated in preview for the same no-live-player
  reason as the `playerPosition` cut — documented as a known
  approximation. `AttackPayload`'s `"onProximity"` trigger kind and
  `proximityRadius` field were cut in the same pass for the identical
  reason (a proximity-gated attack can't be previewed either).
- **Follow-up fix, same day: `time` is now mostly *derived*, not typed
  in** (`encounterTiming.ts`). The first cut of the scrubber let `time` be
  fully independent of the referenced Action's movement speed — a real bug
  once tested with a fast unit: it would sail straight past its next
  waypoint (or run forever past the last one) with no relationship to what
  the timeline showed. Now a step whose *predecessor's* Action moves gets
  its `time` computed from distance ÷ effective speed
  (`recomputeStepTimes`, re-run after every mutation); it's still
  manually authored for the first step of an instance (spawn delay) or a
  step following a stationary predecessor (no destination to derive from).
  Dragging a *derived* step on the timeline now solves for the
  *preceding* step's `speedMultiplier` instead of setting a raw time
  (`speedMultiplierForDuration`) — never the shared Action, preserving
  "encounters select pacing, they don't mutate the reusable buffet."
  `movementPreview.ts` also gained a proper clamp: a segment's preview
  position holds at the destination once reached instead of overshooting.
  `steps` arrays are no longer kept sorted-by-time as a drag-reordering
  mechanism — array index order is simply the authorial sequence order
  now, since a mostly-derived `time` isn't something you'd drag past a
  neighbor to reorder.
- **Second follow-up fix, same day: a step with no next waypoint no
  longer moves in the preview at all.** The first attempt at the above fix
  capped a terminal step's continued motion (it inherited the previous
  segment's heading) to a bounded `LAST_STEP_PREVIEW_WINDOW` — but that
  still read as the identical bug with a genuinely fast unit, since even a
  few seconds covers a lot of distance. There's no principled destination
  to head toward once a sequence ends, so the preview stopped guessing one:
  the last step in a sequence (or a lone step with no neighbors) now just
  holds at its own `pos`, full stop, regardless of elapsed scrub time or
  the Action's own movement. `LAST_STEP_PREVIEW_WINDOW` still exists but
  is now purely a timeline-ruler sizing constant (how far past the last
  step the ruler extends for layout), not a motion-preview cap.
- Attack payloads (pattern shape x aim mode x trigger) and nested bullet
  payloads were, at this point in the project's history, unchanged in
  shape from earlier passes, just relocated onto each Action instead of
  each node/edge — **superseded by the Parts/weapon-track pass below**,
  which replaced this entirely.
- **Movement is no longer an Action concept — it's bezier curves plus two
  Unit stats** (`bezier.ts`, `unitTypes.ts`). `ActionDef` dropped
  `movement` entirely: straightLine/wave/spiral as a per-Action choice is
  gone, replaced by `UnitDef.speed`/`turnRate` (renamed from the
  previously-unused `baseSpeed`) driving a single cubic bezier curve per
  segment. Each `EncounterStep` gained `handleIn`/`handleOut: Vec2 | null`
  — offsets from `pos`, editable as draggable teal handle dots on the
  canvas (in+out independent, shown only on the selected step, skipped on
  whichever end has no adjacent segment) — defaulting to a straight-line-
  equivalent placement when null, so an un-dragged sequence looks and
  behaves exactly like the old straight-line default. `turnRate` caps a
  handle's length as a multiple of its segment's straight-line length,
  enforced at *read* time (`resolveHandleIn`/`resolveHandleOut`) so
  lowering it after curves were authored tightens them consistently
  instead of leaving stale over-limit data. **Dwelling is simply a step at
  the same position as its predecessor** — no flag, since a zero-length
  segment has nothing to curve along; `encounterTiming.ts`'s
  derived-vs-manual `time` split now branches on that instead of "does the
  predecessor's Action have movement." Segment duration is arc length
  (numerically integrated, `cubicBezierLength`) ÷ effective speed — since
  duration is now *always* consistent with the curve's actual length for
  a moving segment (manual time only survives for dwelling, where there's
  no travel to overshoot), `movementPreview.ts`'s old distance-based
  overshoot clamp collapsed into a plain `u = elapsed/duration` clamped to
  `[0, 1]` — meaningfully simpler than the old per-movement-kind dispatch.
  `turnRate`'s old meaning (homing toward the player, never actually
  simulated) is gone along with it — no more approximation caveat needed
  there. Bullets were unaffected *at the time of this pass* —
  `BulletDef.movement` kept the original straightLine/wave/spiral system,
  since a fired bullet had no waypoints to curve between — but the
  Parts/weapon-track pass below deleted `BulletDef` entirely, so this is
  now historical.
- **Parts, independent per-part attack tracks, and a unified arc-range
  weapon model** (`unitTypes.ts`, `encounterAttacks.ts`, `WeaponForm.tsx`,
  `PartEditor.tsx`, `AttackPanel.tsx` — Noah's request, prompted by a
  re-read of the original "Design Handoff v2" doc's §5.5/§5.6 after noting
  a battleship-with-three-turrets use case). Attacks stopped being
  attributes of a movement Action: `ActionDef` dropped `attack` entirely
  (now purely `{name, animationState, visible}`), and `UnitDef` gained
  `parts: UnitPart[]` — named anchor points (`{id, name, offset,
  weapons}`) each owning their own reusable `WeaponDef[]` buffet, every
  Unit seeded with one default "Main" part so the common single-weapon
  case needs no extra authoring. `AttackPayload`'s three-axis
  shape×aim×trigger matrix was replaced by `WeaponDef`'s flat, orthogonal
  field set per the design doc: an aim (fixed angle, or the player —
  tracked or snapshotted), an arc range relative to that aim (subsumes
  fan/radial-burst/and a new gap-at-aim pattern the old matrix couldn't
  express), shot count/spacing/per-shot delay, an optional sweep (a
  nonzero sweep speed is what "rotating" aim reduces to now, not a
  separate mode), a fire interval, and what it spawns. **No trigger kind
  survives at all** — an attack-track placement's own `time` already says
  when it fires (the same "Trigger enum → explicit time" collapse the step
  system went through earlier), a repeating burst is just a nonzero fire
  interval, `onDeath` was cut outright (no time-based home for it under
  "everything is time-based"), and `beam` was cut too (fakeable with a
  rapid-fire long/thin projectile). **`BulletDef`/`MovementBehavior`
  deleted outright** — `WeaponDef.spawnUnitId` references a real `UnitDef`
  by id instead of an inline bullet struct (any Unit, including one with
  its own Parts/Weapons, so recursive/splitting fire is free with no
  nested-payload shape needed), plus a deliberately simple `spawnScale`
  flat multiplier. `EncounterUnit` gained a flat, **unordered**
  `attacks: EncounterAttack[]` (`{partId, weaponId, time, durationMs,
  aimAngleOverride}`, `encounterAttacks.ts`'s CRUD has no chronology
  invariant to maintain, unlike steps) — placed via a 🔫+ button on a
  selected step's control cluster (adds at that step's time; a small Part
  picker appears if the Unit has more than one Part), rendered as its own
  marker on canvas (anchored wherever the instance's bezier path puts it
  at the attack's own time, reusing `movementPreview.ts`'s
  `computeInstancePreview`) and its own lane on the timeline, one per Part
  with placed attacks. A fixed-aim attack gets a draggable aim handle
  (same `.shmup-handle-btn` pattern as bezier handles, but storing just an
  angle rather than a position offset, since the anchor itself moves).
- Saves as part of the owning tile in `TILES.DAT`; the in-progress
  tile-plus-encounter session survives reload/rotation via `TILE-DRAFT.DAT`
  and the unit-plus-action-plus-part session via `UNIT-DRAFT.DAT`, per root
  `CLAUDE.md`'s mandatory rule — resumed silently on mount into whichever
  of the five views (unit-edit, action-edit, part-edit, tile-edit,
  encounter-edit) the session was left in. The scrubber's playhead/
  play-state is deliberately NOT part of any saved draft (a viewing aid,
  not authored content).
- **Visual authoring pass** (`PartPositionEditor.tsx`, `WeaponPreview.tsx`,
  `weaponPreview.ts` — Noah's feedback that the editor was "a lot of
  numbers, zero defaults, nothing visual"). Three fixes: (1) a default
  "Bullet" Unit (`createDefaultBulletUnit`, a supplied glow sprite) now
  seeds automatically into any brand-new or reset library
  (`unitStore.ts`'s `loadUnits`), and a brand-new Weapon defaults to
  spawning it rather than `null`, so the editor is never a totally blank
  slate; (2) `UnitPart` gained its own `spriteId`/`customSprite`, set and
  positioned via a small draggable canvas (dimmed body sprite as a
  reference frame, drag the Part's sprite directly, or arrow-nudge) rather
  than typing raw offset numbers blind — the encounter canvas's attack
  markers switched from a generic 🔫 icon to the Part's actual sprite too;
  (3) `WeaponForm.tsx` gained a live animated bullet-pattern preview
  (shooter marker, sweeping arc boundaries, telegraph glow, bullet dots
  using the spawned Unit's real sprite) at the top of the form, split into
  pure/testable simulation functions (`weaponPreview.ts`) plus a
  `<canvas>`/`requestAnimationFrame` renderer, same architectural split as
  `movementPreview.ts`/`EncounterEditor.tsx`.
- **Actions cut entirely** (Noah's read: "is there a point to Actions
  anymore? You can pick an animation, but it's not like you can actually
  choose frames... I think we can scrap it"). Correct — `animationState`
  was fully inert (nothing ever read it, since the editor only ever
  renders a static idle sprite; real multi-frame animation is a separate,
  unbuilt future feature that'll need its own data-model decision anyway
  once frame sets have a home). `visible` was the only field that ever
  did anything, and a plain boolean has no reuse value worth a whole
  named, buffet-and-select indirection. `ActionDef`/`ActionEditor.tsx`/
  the Actions section of `UnitStatsForm.tsx`/the `action-edit` view/the
  `UnitEditSession.activeAction` session slot were all deleted outright.
  `EncounterStep` lost `actionId` and gained `visible: boolean` directly
  — the same field, just no longer behind an indirection. Every
  consumer that resolved a step's Action just to read `visible` now
  reads `step.visible` directly instead (`EncounterEditor.tsx`'s node/
  preview-dot rendering, `EncounterTimeline.tsx`'s hidden-step styling,
  `movementPreview.ts`'s `InstancePreview`). `unitStore.ts`'s
  `SAVE_VERSION` (7→8) and `TILE_SESSION_VERSION` (4→5), plus
  `tileStore.ts`'s `SAVE_VERSION` (5→6), all bumped — the usual "reset
  rather than silently carry a mismatched shape" reason.

**Scope decisions**:
- **Branch conditions remain cut entirely** — no conditional jump exists
  anywhere in the step list.
- **Layers (Ground/Air/Doodad) and reference frames (scroll-locked/
  time-locked) are deferred** — every step today is a plain canvas
  position with no layer or frame-of-reference concept.
- **Rendered Part sprites shipped in a follow-up UX pass (Noah's "a lot
  of numbers, zero defaults, nothing visual" feedback) — rotating/
  facing-mode Part sprites are still deferred.** A Part now has its own
  `spriteId`/`customSprite`, positioned visually (`PartPositionEditor.tsx`
  — drag over a dimmed reference of the Unit's body, or arrow-nudge) and
  rendered as its actual sprite on the encounter canvas's attack markers.
  What's still not built is the design doc's §5.4 **facing modes**
  (`fixedToBody`/`facePlayer`/`faceMovement`/`faceAttackTarget` — e.g. a
  tank's turret visually *rotating* to track its aim at runtime) — a
  Part's sprite renders statically at its authored offset, no rotation
  transform; see Remaining below.
- **The recursive conserved-budget scaling system (§4.2) is deferred** —
  `WeaponDef.spawnScale` is a plain flat multiplier, not budget-derived;
  no Scaling panel, no count-range/power-split/spawn-delay/positioning-
  shape UI exists. Weight is still a plain flat number.

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
  Custom upload also works for authoring any other Unit today.
- **Animation preview is deferred.** Each skull sheet actually has 16
  frames (4 states x 4 frames: idle/moving/attacking/dying —
  `scripts/assets/skull-sprites-source/README.md`), but the editor only
  ever shows a static idle sprite — there's no per-Unit concept of "the
  other 15 frames" yet, and no player/preview UI to flip through them.
  Real, moderate-sized follow-up work: (a) a data-model decision for how
  frame sets attach to a sprite (a built-in vs. a custom upload have very
  different provenance for this), (b) re-running the background-removal
  step from `prepare-skull-sprites.mjs` against the other 15 frames per
  sheet instead of just frame 1, and (c) a small animation-player
  component. Reasonable to fold into E4 (Preview/playtest mode) rather
  than block E2 on it.
- ~~Unit variants aren't attachable to a tile yet~~ — resolved by E3: a
  spawn node references a `UnitDef` and lives inside an `EncounterDef`,
  same as E1's tile-variant gap above.
- **Deferred: rotating/facing Part sprites (turret tracking its aim at
  runtime).** A Part now has its own sprite and a visually-authored
  position (shipped in the "visual authoring pass" follow-up — see
  `shmup-editor.md`'s section of that name) — what's still missing is
  *rotation*: a Part's sprite always renders at a fixed orientation, it
  doesn't turn to visually track its own Weapon's current aim direction
  the way a tank turret would. The design doc's §5.4 gives a concrete
  shape to build toward: a facing mode per Part (`fixedToBody` — rotates
  with the base sprite; `facePlayer` — a turret always oriented at the
  live player; `faceMovement` — oriented toward current travel direction;
  `faceAttackTarget` — oriented toward wherever its own Weapon is
  currently aiming, for a fixed/sweeping attack rather than an
  aimed-at-player one). Rendering-only — no independent HP/hitbox per
  Part, that stays reserved for genuine hand-coded boss decomposition.
- **Deferred: per-Unit "constant motion" (secondary offset movement) —
  the eventual home for wave/spiral/wobble.** Cutting straightLine/wave/
  spiral as per-Action movement kinds in favor of the bezier-curve model
  above (see Done, this section) means a Unit can no longer author "orbit
  in place" or "wobble side to side" directly — those effects came from
  the old `WaveMovement`/`SpiralMovement` primitives, which are now
  bullet-only (`BulletDef.movement`, unchanged). The eventual goal (not
  built, no data model exists yet) is a **Unit-level property** — a
  secondary offset the sprite/hitbox continuously orbits or oscillates
  around its *primary* bezier-path position, independent of the bezier
  curve itself and independent of `speed`/`turnRate`. Concretely: the
  Unit's rendered position would become `bezierPosition(t) +
  constantMotionOffset(t)` rather than just `bezierPosition(t)` — the
  encounter/bezier system stays exactly as shipped, this is purely
  additive. Use cases: a boat bobbing up and down while otherwise
  following a straight patrol path, a swarm of small enemies spiraling
  around a shared anchor point that itself moves along a bezier curve, a
  helicopter swaying side-to-side while hovering in place (a bezier
  segment with `pos` == predecessor's `pos`, i.e. dwelling, plus a nonzero
  constant-motion sway). Most Units won't need this at all, which is why
  it's a deferred opt-in property rather than something forced into the
  core movement model now. Open questions for whenever this is picked up:
  whether it's one more MovementBehavior-like kind-choice (reusing
  `WaveMovement`/`SpiralMovement`'s existing shape, now on `UnitDef`
  instead of `BulletDef`) or a more general parametric offset function;
  whether `movementPreview.ts`'s scrubber preview should visualize it
  (likely yes, for the same "see if the authored motion actually reads
  right" reason the bezier preview exists); and whether it needs its own
  per-Action or per-step override (e.g. "don't wobble while attacking").

### E3 — Spawn node editor (#193) — shipped, minus per-param scaling curves

See `shmup-editor.md`'s "Spawn nodes (E3)" section for the full design.

**Scope resolution going in**: the original framing ("attach one or more
spawn nodes to a tile variant") assumed a `variants` concept E1 never
built. It turned out not to be a gap — `EncounterDef` (E2) already *is*
`levels-and-tiles.spec.todo.md` §1's "tile variant" (its own doc comment:
"a random one \[encounter\] (weighted) is picked when the tile spawns in a
level" — exactly "mutually-exclusive spawn variants... picked at placement
time, optionally weighted"). So spawn nodes shipped as a new field
*inside* `EncounterDef` (`spawnNodes: SpawnNodeDef[]`), a second,
procedural way one encounter populates enemies alongside its hand-placed
`units` — not a new sibling list on `TileDef`.

**Done**:
- **`SpawnNodeDef`** (`spawnTypes.ts`): origin (`point`/`region`/`shape`,
  with `region`'s width/height and `shape`'s kind/span fields), free
  distribution, direction (rotates a `shape` origin only), mirror
  (reflects across the owning tile's own width, any origin type),
  timing (`delayMs`/`intervalMs`/`countMode`), and scaling (`minCount`/
  `maxCount`/`powerSplit`/`countCurve`) — referencing a `UnitDef` by id.
- **`spawnShapes.ts`**: pure, unit-tested geometry — `computeShapePositions`
  lays out a shape template's individuals with spacing *derived* from count
  (spec's "a count of 3 spaces widely, a count of 15 packs tightly, same
  shape either way"), `resolveSpawnPositions` applies rotation/anchor/
  mirror on top for any origin type.
- **`difficultyCurve.ts`**: the one piece of `spawn-and-warnings.spec.todo.md`
  §1's shared curve-type system (`flat`/`linear`/`capped`/`stepped`) this
  pass wires up, scoped to what §2 explicitly assigns a spawn node — see
  "Scope decisions" below for what's deliberately NOT included.
  `SpawnNodeDef.countCurve` resolves an incoming difficulty budget to an
  actual spawn count within `[minCount, maxCount]` ("spawn count" is one
  of §1's named curve-attachable params). `CurveField.tsx`/`CurveDef`/
  `resolveCurve` are kept generic (not spawn-node-specific) so a future
  per-param retrofit (see Remaining below) can reuse them.
- **Canvas integration** (`EncounterEditor.tsx`): a ◈ diamond marker per
  spawn node (drag ✥ to reposition the origin anchor, ✕ to delete
  immediately, no confirm step), a dashed reference box for a `region`
  origin, deterministic ghost-dot preview for a `shape` origin's layout.
  "+ Add Spawn Node" sits next to "+ Add Unit"; a spawn node can be added
  with no Unit reference yet ("Skip (pick Unit later)") since, unlike a
  Unit instance, it stays meaningful mid-configuration.
- **`SpawnNodePanel.tsx`** (mirrors `StepPanel.tsx`/`AttackPanel.tsx`):
  all fields except the origin's world-space anchor (a canvas drag).
  **`SpawnScalingPreview.tsx`**: a budget slider (0-100, editor-preview
  only) driving a live dot-bar readout of resolved count/power — same "a
  lot of numbers, zero defaults, nothing visual" motivation as E2's
  `WeaponPreview.tsx` follow-up pass.
- Saves as part of the owning `EncounterDef`/`TileDef` in `TILES.DAT`;
  purely-additive field, no `SAVE_VERSION`/`TILE_SESSION_VERSION` bump
  (backfilled to `[]` by a new `normalizeEncounter()` helper, same pattern
  as `customImage`) — the in-progress draft rides along inside the
  existing `TILE-DRAFT.DAT` session for free, no new stable FS id needed.

**Scope decisions**:
- **Per-param scaling-curve retrofit onto Unit/Weapon stats is
  deliberately NOT built** — §1's broader vision (a curve attachable to
  HP, fire rate, damage, arc width, spiral radius...) would mean reopening
  E2's already-shipped `UnitStatsForm`/`WeaponForm`, a materially larger,
  separate piece of work. `SpawnNodeDef.countCurve` is the one concrete
  consumer shipped now; `resolvePowerMultiplier()` is a representative
  preview number only, not wired to any real Unit stat.
- **A `region` origin's scatter is `Math.random()`, not seeded/
  deterministic** — a representative editor preview (and intentionally NOT
  ghost-dot-previewed on canvas, unlike `shape`, to avoid jittering on
  every unrelated re-render). The real game generator's own placement math
  (not built yet) is a separate, seeded system per
  `levels-and-tiles.spec.todo.md` §2.
- **Spawn-node timing isn't on the shared timeline yet** — `delayMs`/
  `intervalMs` are panel-only fields; `EncounterTimeline.tsx` still only
  has step/attack tracks (a spawn selection is narrowed away before
  reaching it). See Remaining below.
- **No movement authoring for procedurally-spawned individuals** — a spawn
  node has no per-individual step list to author (unlike an
  `EncounterUnit`); how such an individual moves at runtime is an open
  question left to the game implementation, same as a Weapon-spawned
  bullet Unit's movement already is (`enemies-and-bullets.spec.todo.md`'s
  Related note).

**Remaining:**
- **Spawn-node timing on the shared timeline** — a track/lane on
  `EncounterTimeline.tsx` visualizing `delayMs`/`intervalMs` the way step
  and attack tracks already do, instead of panel-only fields.
- **Per-param scaling curves on Unit/Weapon stats** (see Scope decisions) —
  the natural next consumer of `difficultyCurve.ts`/`CurveField.tsx` once
  there's appetite to reopen E2's stat forms.
- **Seeded/deterministic region scatter** — needed once there's a real
  preview/export round-trip (E4/E5) that has to reproduce the same layout
  twice, not just show a representative one.
- **Encounter difficulty-range gating** (carried over from E2's Remaining
  list) — still blocked on nothing concrete left to build against beyond
  what shipped here; `EncounterDef.weight` remains the only
  difficulty-adjacent authored field.

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

- `shmup-editor.md` now tracks current (partial-E1, E2, E3) behavior; keep
  promoting sections here into it as E1's remaining gaps and E4-E5 ship.
