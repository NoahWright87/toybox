# Shmup Level & Enemy Editor — TODOs (PRD)

> Epic: **[Shmup Editor] Epic 6 #182**. Issues: **E1 #191** (tile editor —
> partially shipped, see `shmup-editor.md`), **E2 #192** (Unit +
> Encounter editor — shipped minus layers and per-param scaling curves,
> see `shmup-editor.md`), **E3 #193** (per-instance scaling — shipped minus
> the same per-param scaling-curve retrofit, see `shmup-editor.md`'s
> "Per-instance scaling (E3)" section), **E4 #194** (preview/playtest),
> **E5 #195** (export/import pipeline). Source: design handoff docs
> (Claude Chat → Claude Code), 2026-07-04 and 2026-07-11.

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
- ~~Attach spawn variants to a tile~~ — resolved, and confirmed (2026-07-25,
  Noah): `TileDef.encounters` *is* the spawn-variant mechanism, full stop —
  "different words, same idea." Not a naming coincidence to double-check
  later: `EncounterDef` (E2) already is a tile variant (its own
  weighted-random-pick doc comment), and per-instance duplication (E3) is a
  property of a hand-placed `EncounterUnit` within that encounter, not a
  separate variant-attachment concept. See `shmup-editor.md`'s
  "Per-instance scaling (E3)" section. No further verification needed here.
- ~~In-editor sketching of tile art~~ — **not a real requirement, removed.**
  This was never actually asked for; it crept into an earlier revision of
  this doc without a real ask behind it (Noah, 2026-07-25: "that got
  hallucinated, and it can be removed entirely"). NS Art already covers
  image creation from scratch — upload (`imageUpload.ts`) is this tool's
  only intended art-input path, and stays that way on purpose.
- ~~The tile-edit form's in-progress draft only persists on explicit
  Save~~ — **stale, not an actual gap (verified 2026-07-25).**
  `TileEditorForm.tsx` already calls `onDraftChange(draft)` in a
  `useEffect` after every change (including the initial mount), and
  `ShmupEditor.tsx`'s `handleTileDraftChange` already writes that straight
  to `TILE-DRAFT.DAT` via `saveTileSession()` — this has been in place
  since the E2 #192 pass, this doc's note just never got updated after.
  Confirmed live in a real browser: typed a name into a brand-new tile,
  reloaded mid-edit, the name (and by the same code path, a freshly-
  uploaded `customImage`, since the whole `draft` object round-trips
  identically either way) was still there. No fix needed.
- (Side quest, not scoped yet) Some way to soften visibly-mismatched art
  seams between adjacent AI-generated tiles at the actual seam — this is
  a `games/shmup` runtime-rendering concern (a feathered edge-blend
  between whichever two tiles end up adjacent at generation time), not
  something the editor's static previews can address, since the editor
  never renders two *different* tiles touching except in the Connection
  Viewer's single-column stack.

### E2 — Unit + Encounter editor (#192) — shipped, minus per-param scaling curves

**Revised six times.** The first pass put a full movement/dwell/attack
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
(`speed`/`turnRate`). A fifth pass cut Actions entirely (`EncounterStep`
carried a plain `visible: boolean`, no Action buffet). **A sixth pass
reversed that cut — Actions are back**, reconciled against design-handoff
v3 and real usage of the shipped Action-less editor: an `ActionDef` is now
a fused movement%/facing/invincibility-toggle/optional-attack bundle,
`WeaponDef` is gone (folded into `ActionDef.attack`), Layers/
`defaultActionId`/`CollisionGroup`/per-Part hitboxes all shipped alongside
it, and the Unit/Part/Action edit forms picked up the same tab+Dial
treatment the Encounter editor got in the mobile-UX pass. See
`shmup-editor.md`'s "Unit + Encounter editor (E2)" section for the full
current design; this entry describes what actually shipped.

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
- ~~Actions cut entirely~~ — **reversed.** After building with the
  Action-less editor for a while, Noah's call was that a plain step/attack
  model was missing too much (reusable named behaviors, facing/rotation, a
  reason for a bullet to be more than a straight line) to be worth
  avoiding the indirection: "They seemed unnecessary before, but after
  using the editor I realize they were just missing too much. So yeah,
  Actions are back, baby!" The Action that came back is not the one
  described above, though — it's a fused movement%/facing/invincibility-
  toggle/optional-attack bundle, and it also absorbed `WeaponDef` entirely
  (see the Parts/Weapon-track pass below) and gained Layers/per-Part
  hitboxes/CollisionGroup at the same time. See `shmup-editor.md`'s
  "Unit + Encounter editor (E2)" section (current, canonical) for the full
  shape — the "Scope decisions"/"Remaining" bullets below that mention
  Layers or per-Part hitboxes as deferred are stale as of this reversal.

**Scope decisions**:
- **Branch conditions remain cut entirely** — no conditional jump exists
  anywhere in the step list. `requiresInvincible` (an Action precondition,
  added when Actions came back) is a narrow, orthogonal gate, not a branch.
- ~~Layers (Ground/Air/Doodad) and reference frames (scroll-locked/
  time-locked) are deferred~~ — **Layers shipped** when Actions came back:
  `UnitDef.layer: "ground" | "air" | "doodad"`, chosen once per Unit, shown
  as a filter in the Encounter editor's "+ Add" picker. Scroll-locked/
  time-locked reference frames are still not a concept *in the editor*, but
  they now exist **at runtime**, derived from the layer rather than authored
  separately: ground/doodad ride the scrolling tile frame, air decouples from
  it once on screen so the terrain passes beneath it (see
  `games/shmup/authored-encounters.spec.md`). The editor canvas is tile-local
  and static, so it shows the authored layout either way — it does not yet
  visualise that an air unit will stop tracking the terrain. What the game
  does with layers when picking which Encounters combine on a tile spawn
  is a separate runtime concern this editor doesn't need to know about.
  **Deliberate departure from v3 §6's model, confirmed by Noah, not an
  oversight**: v3 describes layer as an *Encounter*-level concept (an
  Encounter "can define up to 3 layers... and places one or more Unit
  instances into each layer it defines," with a same-tile-spawn selection
  algorithm that excludes other Encounters sharing an already-covered
  layer). What shipped instead puts layer on the *Unit definition* — Noah:
  "Layer is a Unit definition. In the editor, when adding a Unit you
  choose which layer you're adding to." This means v3 §6's selection
  algorithm (steps 1-4, picking one Encounter then excluding others by
  shared layer) has no literal Encounter-level layer to key off anymore —
  it needs re-deriving against "which layers do this Encounter's placed
  Units happen to use" instead, or a different algorithm entirely. Not an
  editor concern per Noah ("None of that is relevant to the editor... a
  separate concern") but flagged here since it's real, unresolved
  game-runtime design debt v3 as written doesn't actually cover anymore.
- **Rendered Part sprites shipped in a follow-up UX pass (Noah's "a lot
  of numbers, zero defaults, nothing visual" feedback) — rotating/
  facing-mode Part sprites are still deferred.** A Part now has its own
  `spriteId`/`customSprite`, positioned visually (`PartPositionEditor.tsx`
  — drag over a dimmed reference of the Unit's body, or arrow-nudge) and
  rendered as its actual sprite on the encounter canvas's attack markers.
  What's still not built is the design doc's §5.4 **facing modes** as a
  *visual rotation* of the sprite itself — a Part's Action does carry a
  logical `facing` (`fixed`/`faceMovement`/`facePlayer`, used for its
  attack's aim) as of the Actions-are-back reversal, but the Part's
  *sprite* still renders statically at its authored offset with no
  rotation transform tracking that facing; see Remaining below.
- ~~Per-Part hitboxes are reserved for hand-coded bosses only~~ —
  **reversed, now general.** `UnitPart` gained `hasHitbox`/`hasHealth`/
  `hp`/`damageMultiplier` when Actions came back — Noah: "we're 80% of the
  way there with sprites and positions, let's just go for it." Hittability
  cascades top-down only (AND-logic against the parent Unit's own
  invincible state) — see `shmup-editor.md`'s "Invincibility" section.
- **The recursive conserved-budget scaling system (§4.2) is deferred** —
  `ActionAttack.spawnScale` (formerly `WeaponDef.spawnScale`) is a plain
  flat multiplier, not budget-derived; no Scaling panel, no
  count-range/power-split/spawn-delay/positioning-shape UI exists at the
  Action-attack level (E3's per-*instance* Scaling tab, unrelated, does
  exist — see `shmup-editor.md`'s "Per-instance scaling (E3)"). Weight is
  still a plain flat number.

**Remaining:**
- **Air units are placed/scheduled exactly like ground units today — real
  design gap, not yet resolved.** A ground Unit's `pos`/steps are naturally
  tile-relative (it's driving/walking over the tile's own terrain); an air
  Unit conceptually shouldn't be — Noah: "their positions are relative to
  the camera, not the tile." The editor doesn't distinguish the two yet:
  every instance's steps place/schedule against the same tile-relative
  world space regardless of `UnitDef.layer`. Needs its own design pass
  (does an air Unit's step `pos` become camera/viewport-relative instead of
  tile-relative? does its clock run against scroll position rather than
  the shared encounter `time`? how does that interact with the timeline
  scrubber and E4's hitbox preview, both of which currently assume one
  tile-relative coordinate space for everything) before it's built — flagged
  here so it isn't lost, not attempted as part of the Actions-are-back pass.
  **This is v3's §6 "Reference frame" concept** (`scrollLocked` for Ground,
  `timeLocked` for Air) — v3 already names the two behaviors this needs;
  what's missing is deciding how `timeLocked` interacts with this editor's
  shared encounter clock and the timeline scrubber before building it.
- ~~A Unit can't be authored with zero Parts, contradicting v3 §4~~ —
  **resolved.** v3 §4: "A Unit does not require Parts... the simplest
  case... is a Unit with zero Parts and a single Final Action on the Unit
  itself." `UnitStatsForm.tsx`'s `validate()` no longer requires
  `parts.length >= 1`, and the last Part can be deleted like any other —
  the base Unit's own `actions` buffet already worked standalone, this was
  just a leftover validation rule from before Actions came back. Fixed a
  real bug found while verifying this: deleting a Part didn't visually
  update the Parts list until navigating away and back (`onDeletePart`
  only updated the parent `ShmupEditor.tsx`'s `editingUnit`, never
  `UnitStatsForm`'s own separately-held `draft` state) — `deletePart()` now
  updates both.
- ~~Clone doesn't exist anywhere~~ — **shipped (2026-07-25).** A Unit
  already had Duplicate (`UnitList.tsx`'s "Duplicate" button →
  `handleDuplicateUnit` in `ShmupEditor.tsx`) from earlier work; Action and
  Part rows were the actual gap. Both now have a "Clone" button —
  `cloneAction()`/`clonePart()` (`unitTypes.ts`) do a fresh-id shallow copy
  (`"<name> copy"`, and for a Part, its own Action buffet cloned too, each
  with fresh ids) wired into `UnitStatsForm.tsx`'s Actions/Parts tabs and
  `PartEditor.tsx`'s Actions tab. This is v3 §8.1's "**Clone** should be a
  first-class operation here" — both `unitTypes.ts`'s doc comments and the
  in-app Help modal already told an author to "Clone the Action" to get a
  fixed-angle/differently-tuned variant instead of a per-placement
  override (the whole justification for cutting per-placement aim
  overrides and per-step speed multipliers when Actions came back), so this
  closes a real gap several other design decisions were already leaning on.
- ~~No minimum-duration placement validation (v3 §8.2)~~ — **shipped
  (2026-07-25), as a warning, not a hard block.** New `attackValidation.ts`
  (unit-tested, `attackValidation.test.ts`) walks a Part-track's placements
  (`partActionsForPart`) to find the one immediately preceding the
  placement being edited, and — if that preceding Action's own attack has
  a computable finite duration (`computeAttackDurationMs`) that the current
  placement's `time` lands inside — surfaces how many seconds too early it
  is. An indefinite-repeat preceding attack (`computeAttackDurationMs`
  returns `null`) warns unconditionally, since there's no end to land
  after. `AttackPanel.tsx` renders it below the Time Dial via a new
  `.shmup-warning` style (amber, distinct from `.shmup-error`'s red —
  deliberately non-blocking: duration is only ever an estimate, and an
  author may have a real reason to want two bursts to overlap, so nothing
  clamps or disables Save).
- ~~No color-coding by Action category on the timeline (v3 §8.2)~~ —
  **shipped (2026-07-25).** New `actionCategory.ts` (unit-tested,
  `actionCategory.test.ts`) derives movement/attack/state from an Action's
  own `attack`/`movementPercent` fields — attack takes priority over
  movement, movement over state — and maps each to a distinct fill/border
  color, movement keeping the existing orange so the common case looks
  unchanged. `EncounterTimeline.tsx`'s step diamonds and Part-track
  attack markers both resolve their referenced Action and apply that
  color inline (falls back to the existing `--selected` border so
  selection stays visible). An invincible-setting Action (`setsInvincible
  !== null`) gets a `filter: brightness(0.6)` modifier class — "a darker
  variant of whatever category color applies," literally, rather than a
  second hand-picked color triple per category.
- **No dedicated Unit/Part Action mini-timeline (v3 §8.1) — confirmed
  intentional scope cut, not a gap.** Noah, during the Actions-are-back
  design pass: "Let's talk about this in more detail... we don't need a
  full timeline." Actions are authored via a flat list + inline form
  (`ActionForm.tsx`) instead of v3's proposed nested piano-roll editor.
  Revisit only if/when a Unit's own Actions need to be sequenced against
  each other rather than referenced individually by encounter placements.
- **Weapon strength doesn't pass down to spawned Units via the difficulty
  system (v3 §4.2, §5.5).** `ActionAttack.spawnScale` is a flat multiplier
  only — a spawned bullet Unit's stats don't scale with whatever
  difficulty/power value produced the Action that fired it. Same root
  cause as the "per-param scaling curves" item below: no per-param
  difficulty-scaling-curve system exists yet for *any* Unit/Action stat,
  weapon-spawned or not.
- **No `Destroyed` Action auto-added when a Part's `hasHealth` is enabled
  (v3 §4.1).** v3: "a `Destroyed` Action is automatically added to that
  Part's buffet, used to set the corpse/wreck sprite once the Part's HP
  reaches zero." Correctly out of scope for now — there's no animation/
  alternate-sprite system to hang a corpse sprite on yet (same reason
  invincible currently just hides the sprite as a documented stand-in) —
  revisit once real sprite-swapping exists.
- **Per-param scaling curves** (flat vs. scales-with-difficulty) —
  deferred. `enemies-and-bullets.spec.todo.md` never defines a curve shape
  beyond "flat" as one option, so there was nothing concrete to build
  against yet. Every numeric param is a plain flat number today.
- **Encounter difficulty-range gating** — Noah floated this alongside
  weight ("super rare treasure event, extra hard bosses, vs boring normal
  enemies"); weight shipped (plain number, default 1), but gating an
  encounter to a difficulty-budget range depends on the difficulty-budget
  system (`spawn-and-warnings.spec.todo.md`), which doesn't exist yet.
- **Built-in sprites**: a growing set of single-pose vehicle/turret/
  projectile art (see `public/shmup-editor/enemies/README.md` and
  `public/shmup-editor/projectiles/README.md`) — every built-in today is
  a static idle-pose sprite, no multi-frame sheets in the mix. Custom
  upload also works for authoring any other Unit today.
- **Animation preview is deferred.** There's no per-Unit concept of
  alternate frames (moving/attacking/dying) yet, and no player/preview UI
  to flip through them — the editor only ever shows a static sprite. Real,
  moderate-sized follow-up work if/when animated built-in art shows up:
  (a) a data-model decision for how frame sets attach to a sprite (a
  built-in vs. a custom upload have very different provenance for this),
  (b) a background-removal step for the extra frames, and (c) a small
  animation-player component. Reasonable to fold into E4 (Preview/playtest
  mode) rather than block E2 on it.
- ~~Unit variants aren't attachable to a tile yet~~ — resolved: a Unit
  instance is placed via `EncounterUnit` (E2) inside an `EncounterDef`
  exactly as before; E3 (per-instance scaling) added procedural
  duplication of that instance, not a new attachment mechanism.
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

### E3 — Per-instance scaling (#193) — shipped, minus per-param scaling curves

See `shmup-editor.md`'s "Per-instance scaling (E3)" section for the full
design.

**Corrected mid-flight.** A first pass built this as a standalone
"spawn node" concept (`SpawnNodeDef`) parallel to `EncounterUnit`, with its
own origin/marker/picker on the canvas and a `flat`/`linear`/`capped`/
`stepped` curve-type picker. Both were wrong reads of the original "Design
Handoff v2" doc's actual §6/§4.2 (Noah's correction: place a Unit and
author it via the *existing* timeline exactly as before; Scaling is a tab
on that instance, not a new kind of thing; one scaling mechanism, not a
curve-type picker). The standalone code (`spawnTypes.ts`, `spawnShapes.ts`,
`spawnNodes.ts`, `difficultyCurve.ts`, `CurveField.tsx`, `SpawnNodePanel.tsx`,
`SpawnScalingPreview.tsx`) was deleted outright, not kept around unused —
see git history. **Done/Remaining below describe what actually shipped
after the correction.**

**Done**:
- **`EncounterUnit` gained `scaling: UnitScaling`** (`unitScaling.ts`) —
  every instance has one; `maxCount: 1` (the default) is a no-op, so an
  instance behaves exactly as it did before E3 until scaling is opened and
  raised. A duplicate replays the instance's *entire* step/attack sequence
  independently, anchored to its own slot — no per-individual authoring.
- **One scaling algorithm** (`resolveScaling()`): a single incoming
  Difficulty value spreads evenly, not split by a separate weighting field.
  `count = min(floor(D / minCostPerInstance), maxCount)` (floored at 0 —
  an unaffordable instance simply doesn't spawn, doubling as elite/late-
  game gating with no separate system needed), then
  `power = floor(D / count)` — the *whole* remaining Difficulty divided
  evenly across however many instances actually spawned, not each
  instance's own cost. Rounds in the player's favor (floor, never up). No
  `minCount` (true floor is zero) and no `powerSplit` (an earlier version
  of this formula split budget between count and power as separate
  currencies before conserving it across `maxCount` saturation — dropped
  after worked examples showed it silently discarded budget once the
  count cap bound). No curve shape to pick anywhere.
- **Real draggable canvas handles per positioning shape**
  (`unitScalingShapes.ts`'s `resolveScalingSlots`, pure/unit-tested):
  Curve (variable-point polyline), V (fixed apex at the instance's own
  position + draggable tip + width field), Grid (two draggable width/depth
  handles), Ring (draggable center + draggable radius handle). All handle
  fields are offsets from the instance's own position, same convention as
  `EncounterStep.handleIn`/`handleOut`.
- **Canvas integration** (`EncounterEditor.tsx`): a 5th control button, ⚖️
  (top-center — the 4 corners are already move/add/attack/delete), on an
  instance's first step opens/closes its Scaling tab, selecting that
  shape's handles on canvas and swapping `StepPanel`/`AttackPanel` for
  `UnitScalingPanel` below. A ⚖️ badge marks any instance with
  `maxCount > 1` even when the tab is closed.
- **`UnitScalingPanel.tsx`**: max count and min cost/instance as
  FL-Studio-style vertical-drag `Dial` controls (`src/components/Dial/`,
  new reusable component — right-click/long-press to reset, tap-to-type,
  optional nudge buttons), spawn delay, shape + its numeric fields,
  ping-pong, and a **preview Difficulty slider** (0-100, editor-preview-
  only) whose live count/power readout ("N instances, N Difficulty passed
  to whatever each one spawns") also drives the canvas's ghost-slot dots
  (`resolveScalingSlots`/`applyPingPong`) in the same frame — the closest
  E3 gets to §8.3's difficulty-preview slider, scoped per-instance rather
  than encounter-wide (see Remaining).
- Saves as part of the owning `EncounterUnit` in `TILES.DAT`; a **required**
  field, validated strictly (not purely-additive) — `tileStore.ts`'s
  `SAVE_VERSION` (6→7) and `unitStore.ts`'s `TILE_SESSION_VERSION` (5→6)
  both bumped, same precedent as the Parts/attack-track pass. Rides along
  in the existing `TILE-DRAFT.DAT` session for free.

**Scope decisions**:
- **Per-param scaling-curve retrofit onto Unit/Weapon stats is
  deliberately NOT built** — §1's broader vision (flat/linear/capped/
  stepped curves attachable to HP, fire rate, damage...) would mean
  reopening E2's already-shipped `UnitStatsForm`/`WeaponForm`, a materially
  larger, separate piece of work, and isn't what §6's actual Scaling panel
  calls for. `resolveScaling()`'s `power` is the Difficulty value handed
  down to whatever the instance itself spawns — a representative preview
  number only for now, not wired to any real Unit/Weapon stat.
- **Spawn-node-level concepts from the reverted first pass (origin
  point/region/shape-with-span, distribution, direction, mirror-as-a-
  standalone-field, timing delay/interval/count-mode) do not exist** —
  those were properties of the wrong data model. What ships instead:
  ping-pong mirroring (a Scaling-shape feature, per spec) and the four
  positioning shapes above; there's no "region scatter" or "point origin"
  concept anymore since duplicates always originate from the instance's
  own already-authored position.
- **The preview-budget slider is per-instance, not a single encounter-wide
  slider** — §8.3 describes one slider previewing every scaled instance at
  once; E3 shipped one slider per open Scaling tab instead (simpler, no
  new state threading across instances). See Remaining.

**Remaining:**
- **Encounter-wide difficulty-preview slider** (§8.3) — one slider driving
  every scaled instance's ghost preview simultaneously, replacing the
  current per-instance-tab slider. Needed to sanity-check a whole
  encounter's readability at once ("does a full-count line still fit the
  tile *and* still read clearly alongside the other scaled instances").
- **Per-param scaling curves on Unit/Weapon stats** (see Scope decisions) —
  the eventual home for §1's broader curve-type vision, if/when there's
  appetite to reopen E2's stat forms.
- ~~Spawn delay affects the E4 hitbox preview but not `EncounterTimeline.tsx`
  itself~~ — **shipped (2026-07-25).** `EncounterEditor.tsx`'s hitbox-preview
  computation already mapped each duplicate slot's own local clock forward
  by `slotIndex * spawnDelayMs`; that formula moved into a new pure,
  unit-tested helper (`unitScaling.ts`'s `spawnDelayOffsetsSec`) so
  `EncounterTimeline.tsx` uses the identical math rather than a second
  hand-copied one. When `maxCount > 1` and `spawnDelayMs > 0`, the ruler
  now draws a faded, non-interactive "ghost" copy of every step diamond and
  Part-track attack marker for each duplicate slot beyond the base
  instance, shifted right by that slot's own offset — visually the same
  "trailing echoes" effect the hitbox preview already showed, just legible
  on the timeline without scrubbing/playing. Ghosts use the same
  category-derived colors as the real markers (`actionCategory.ts`) at
  reduced opacity, and aren't selectable — they're a preview of where a
  duplicate's copy lands, not a distinct authored object.
- **Encounter difficulty-range gating** (carried over from E2's Remaining
  list) — still blocked on nothing concrete left to build against beyond
  what shipped here; `EncounterDef.weight` remains the only
  difficulty-adjacent authored field.

### E4 — Preview/playtest mode (#194)

Preview a tile or a short generated sequence in-browser without a full
game import round-trip — validates readability/fairness (warning lead
times, bullet density) before export.

**Status: low-fi hitbox/boundary preview shipped; multi-tile chaining and
warning-indicator surfacing not started.** `hitboxPreview.ts` +
`EncounterEditor.tsx`'s "Hitbox preview" toggle is editor-side timeline
playback layered on the scrubber that already existed for E2/E3 (`scrubTime`/
`playing`) — not a separate playback engine, and not real Phaser.

**What shipped**:
- Toggling "Hitbox preview" swaps the canvas's big touch-friendly authoring
  icons for real-scale reference geometry at the current scrub position:
  red boxes for enemies (and their scaled duplicates, per E3) at their
  authored `UnitDef.size`, red dots for bullets in flight (reusing
  `weaponPreview.ts`'s per-shot math — arc offsets, sweep, travel speed/
  life — via a new `computeAttackBullets` that fires an attack exactly as
  authored instead of looping forever the way the standalone
  `WeaponForm.tsx` preview does for demo purposes), a static green
  reference circle standing in for the player's own hitbox (radius 6,
  documented against `games/shmup`'s real `TUNING.combat.hitboxRadiusNormal`
  — no live player exists at authoring time, same approximation the rest
  of the editor already accepts for `turnRate`/`trackPlayer`), a thick
  yellow border for the tile's real bounds, and a dotted border for a
  static "how much of the tile is visible on screen at once" reference
  rectangle (`computeCameraBoundsRect` — width matches the tile's own
  width per `levels-and-tiles.spec.todo.md` §4's "camera shows more/less
  active width" framing, height derived from `games/shmup`'s real 720x1280
  aspect ratio, centered on the tile; does **not** animate/ease between
  sections the way the real playable-bounds box does — a static
  approximation, not a simulation).
- **Ships the previously-deferred "encounter-wide difficulty-preview
  slider"** (§8.3, listed above as E3 Remaining) as the toggle's own
  Difficulty slider — every scaled instance's duplicate count/positions in
  the preview resolve against this one shared value, not the per-instance
  Scaling-tab slider (which still exists separately, driving only that
  tab's own static ghost-slot dots while open).
- A `"player"`-aimed weapon's bullets aim at the reference player marker in
  this preview — a real improvement over `WeaponForm.tsx`'s isolated
  preview, which has no reference point available at all while just
  browsing the picker.

**Explicitly not built**:
- **Multi-tile chaining** (§'s "optionally chain a few tiles via L1's
  edge-matcher") — this preview is scoped to one encounter at a time,
  matching where `EncounterEditor.tsx` already lives; chaining tiles
  together would need the L2 JIT-streaming/edge-matching system
  (`levels-and-tiles.spec.todo.md`) to exist first.
- **Warning-indicator lead-time surfacing** (L6 #188,
  `spawn-and-warnings.spec.todo.md` §3) — **confirmed out of scope for this
  editor, not a gap in this preview** (Noah, 2026-07-25): warning
  indicators are a `games/shmup` runtime concern, not something for this
  editor to surface. The real remaining work is broader than "wire up L6's
  spawn-triggered warnings" too — it needs to be a **generic system for
  anything currently off-screen, especially something moving toward the
  play area**, not narrowly triggered off scripted spawn timing the way §3
  currently describes it. See `spawn-and-warnings.spec.todo.md` §3's
  updated framing. Nothing for this editor's preview mode to build toward
  until that runtime system exists.
- **A literal camera simulation** — the dotted bounds rectangle is static
  (see above), not an animated/scrolling camera tracking a moving
  reference point.

### E5 — Export/import pipeline (#195) — **superseded: there is no export**

The original plan was a versioned JSON export a human commits into
`games/shmup/src/` as static content. **Dropped (2026-07-25.)** It is the
wrong shape for what this tool is for: a commit-and-rebuild round trip
between every edit and every playtest is the opposite of a tight authoring
loop, and Noah's actual ask ("put together a level and play the whole
thing") wants the loop, not the artifact.

The game now reads the editor's own saved files directly. Both apps are
same-origin (`/shmup-editor` in the Doors bundle, `/shmup/` as its own
bundle) and share the `ns97_fs_v1` localStorage blob, so
`games/shmup/src/systems/encounters/authoredContent.ts` reads `TILES.DAT` /
`UNITS.DAT` by their stable node ids — the same precedent
`sprites/fsOverride.ts` and `save/doorsFsSaveStore.ts` already set. Art
resolves straight off `/shmup-editor/...`, and a custom upload is already a
data URL in the saved record. Authored content also stays hackable in
Notebook, like every other `*.DAT` in the OS. See
`games/shmup/authored-encounters.spec.md`.

**Playtesting is the loop this bought.** Two buttons, both in the editor
rather than the game (testing content belongs next to the content):
the Encounter editor's canvas-corner ▶ saves the encounter and plays *that*
one; the Connection Viewer's "▶ Play Test Level" saves the assembled layout
(`levelStore.ts` -> `LEVEL.DAT`) and plays the whole thing with a
weighted-random Encounter per tile, and "⚄ Autogenerate" builds that layout
for you. Both play buttons navigate to `/shmup/` with the request in the
query string; the game skips its menus and drops straight into the episode.

**What survives from E5, and is still worth building:**

- **In-editor referential validation** — an `EncounterUnit`'s `unitDefId`
  must resolve, a step's `actionId` must exist on the owning Unit, a Part
  placement's `partId` must exist. The runtime is defensive about all of
  these (a dangling reference drops that one instance), but failing loudly
  in the editor is still better than silently playing less content than
  you authored.
- **Save-version lockstep.** `AUTHORED_TILES_VERSION` /
  `AUTHORED_UNITS_VERSION` in the game mirror `tileStore.ts` /
  `unitStore.ts`'s `SAVE_VERSION`. A mismatch means the game sees *no*
  authored content — deliberate, but easy to forget. Bump both together.

## Open questions

~~Exact landing directory + filename convention inside `games/shmup/src/`
for exported tiles/enemies/spawn-nodes.~~ — **moot: nothing lands there,
see E5 above.**

~~Whether tile/enemy art in the editor reuses the shmup sprite-registry
manifest convention (`content-and-assets.spec.md`) directly, or needs its
own lighter-weight asset-reference scheme.~~ — **resolved: neither.** The
editor keeps its own id-to-path tables and the game mirrors them
(`games/shmup/src/sprites/editorArt.ts`), loading authored art by absolute
URL off the main app. The manifest convention stays for the game's *own*
bundled art, where placeholder-primitive fallback matters; authored art
doesn't need it.

~~Level assembly — the Connection Viewer keeps its grid in local component
state, so the game has nothing to read.~~ — **done:** `levelStore.ts` saves
it to `LEVEL.DAT` and "▶ Play Test Level" plays it.

~~Generated levels — pick a starting tile and have the tool build one
rather than assembling it by hand.~~ — **done, in the editor:**
`generateLayout.ts` + the Connection Viewer's "⚄ Autogenerate" grows the
layout north from whatever is placed (random starting tile if nothing is),
through the viewer's own `candidatesForAddPoint` matcher so the result is
legal by identical rules and stays hand-editable. Press again to extend.

- **Runtime generation.** The editor generating a level is not the same as
  a real episode generating its own from the node's Difficulty. That's
  `games/shmup`'s L1 frontier generator
  (`systems/levels/generateLevel.ts`) run over the authored library —
  `authoredToGeneratorTile()` already projects an authored tile into the
  shape it consumes, and a generated `LevelLayout` is the same shape
  `LevelRunner` already plays. Whether the editor's generator then folds
  into that one, or stays a separate authoring convenience that can build
  the free-form 2D grids the viewer allows, is the open question.

~~Whether this tool ever gets a Doors 97 window/Taskbar entry... or stays
standalone-only indefinitely~~ — **resolved (2026-07-25): it gets one.**
Registered per the full `NsDoors97/CLAUDE.md` checklist — a new **Game
Dev** Start Menu category (`Taskbar.tsx`'s `GAME_DEV_ITEMS`, sibling to
Games/Tools) launches it as a real Window (`"shmup-editor"` in
`AppAction`/`APP_REGISTRY`/`WindowContent`/`openWindow`/the window render
block, all in `NsDoors97.tsx`), and the existing `C:\Programs\Accessories\
Shmup Editor` data folder (`TILES.DAT`/`UNITS.DAT`/the two `*-DRAFT.DAT`
files) picked up a `Shmup Editor.exe` (`SHMUP_EDITOR_EXE_ID`) so
double-clicking it from the file browser opens the same window. The
standalone `/shmup-editor` route is unaffected — both paths render the
same `ShmupEditor.tsx`, which already handled being hosted in a Doors 97
Window (`useWindowMenus`) even before this, it just wasn't reachable that
way yet. Hell Map Editor remains standalone-only; this was scoped to
Shmup Editor only, not a decision to also register Hell Map Editor.

## Related

- [`games/shmup/levels-and-tiles.spec.todo.md`](games/shmup/levels-and-tiles.spec.todo.md)
- [`games/shmup/enemies-and-bullets.spec.todo.md`](games/shmup/enemies-and-bullets.spec.todo.md)
- [`games/shmup/spawn-and-warnings.spec.todo.md`](games/shmup/spawn-and-warnings.spec.todo.md)
- [`games/shmup/overview.spec.todo.md`](games/shmup/overview.spec.todo.md) — spec map for the game this tool authors content for
- `src/experiences/Hellzone/HellMapEditor.tsx` — closest existing in-repo editor precedent (different game/data model)

## Reminders

- `shmup-editor.md` now tracks current (partial-E1, E2, E3) behavior; keep
  promoting sections here into it as E1's remaining gaps and E4-E5 ship.
