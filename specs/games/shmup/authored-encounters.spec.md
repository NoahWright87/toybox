# Shmup — Authored Encounters Spec (playing `/shmup-editor` content in the engine)

> **Status:** scrolling playback of a single Encounter **and** of a whole
> Connection Viewer level, launched from the editor — **implemented**. See
> "Not built yet" at the bottom for what's left.
> Related: `../../shmup-editor.md` (the authoring tool),
> `levels-and-tiles.spec.todo.md` (L1/L2, the generator this feeds),
> `enemies-and-bullets.spec.todo.md` (L3/L4, the model the editor authors).

## What this is

`/shmup-editor` authors tiles, Units and Encounters. This spec covers the
other half of that loop: **the game loading that content and playing it**,
with the real ship, real weapons, real Hype and real coins — not a preview
of them.

**The entry points live in the editor, not the game.** Testing content
belongs next to the content, and a picker inside the game would mean
navigating a menu to find something you already have open:

| Where | Button | What it plays |
|---|---|---|
| Encounter editor (canvas corner) | ▶ | Saves the encounter, then plays *that* one, on its own tile, at the preview's own Difficulty |
| Connection Viewer (toolbar) | ▶ Play Test Level | Saves the assembled layout, then plays the whole thing with a weighted-random Encounter per tile |

Both are a real page navigation into `/shmup/` with the request in the
query string (`playtestRequest.ts`), the same crossing `SHMUP.EXE` already
makes from NS-TOS. The game skips its title card and menus entirely on a
playtest launch and drops straight into the episode; when the run ends it
offers "play again" (a reload, so it picks up anything saved since) and
"back to editor".

## How content gets from the editor to the game

**No export step.** The `shmup-editor.todo.md` E5 plan assumed a JSON
export a human commits into `games/shmup/src/`. That turned out to be the
wrong shape for the thing Noah actually asked for ("put together a level
and play the whole thing"): a commit-and-rebuild round trip between every
edit and every playtest is the opposite of a tight loop.

Instead the game reads the editor's saved files directly:

| | |
|---|---|
| Editor writes | `C:\Programs\Accessories\Shmup Editor\TILES.DAT` / `UNITS.DAT` via `fsStore` |
| Game reads | the same `ns97_fs_v1` localStorage blob, by stable node id |
| Where | `games/shmup/src/systems/encounters/authoredContent.ts` |

Both apps are same-origin (`/shmup-editor` in the Doors bundle, `/shmup/`
as its own bundle), so this is the same precedent `sprites/fsOverride.ts`
(read-only art overrides) and `save/doorsFsSaveStore.ts` (read-write saves)
already set. Authored art loads the same way — straight off
`/shmup-editor/...`, with custom uploads already being data URLs in the
saved record (`sprites/editorArt.ts`).

It also means authored content stays **hackable** exactly like the rest of
Doors 97: `TILES.DAT` is plaintext JSON, editable in Notebook, and the
game picks up the edit on the next scene start.

**The two packages share almost no runtime code** (`shmup-editor.todo.md`'s
standing rule). The data *shapes* are mirrored — `authoredTypes.ts` mirrors
the editor's `types.ts`/`unitTypes.ts`/`encounterTypes.ts`, `editorArt.ts`
mirrors its art tables. The single deliberate exception is
`scrollModel.ts`, which the editor imports outright; see the next section
for why that one couldn't be mirrored.

### Save-version coupling

`AUTHORED_TILES_VERSION` / `AUTHORED_UNITS_VERSION` must track the
editor's `tileStore.ts` / `unitStore.ts` `SAVE_VERSION` (both 9 today). A
mismatch reads as "nothing authored," deliberately — a pre-v9 save's
Action/step shape is not something to half-read. **Bump both sides
together.**

Individual records are validated one at a time, though: a mangled Unit
drops that Unit, not the library. These files are meant to be hand-edited.

## The scroll model — the one thing both packages share

Everywhere else the two packages share only data shapes. `scrollModel.ts`
is the deliberate exception, imported directly by
`src/experiences/ShmupEditor/*`, because these two numbers decide *what an
authored encounter looks like when played*. Two copies means the editor
showing you one thing and the game doing another, silently, forever — which
had already happened once with the tile size.

| | |
|---|---|
| `TILE_UNIT` = 720 | One footprint column. Deliberately `GAME_WIDTH`, so a 1x1 tile is exactly one screen wide and an authored pixel is a game pixel. |
| `LEVEL_SCROLL_SPEED` = 180 px/s | How fast the level scrolls past. Raising it makes levels faster and gives every encounter less room. |

These two are the reason they aren't in `TUNING`: that's a large game-only
object the editor has no business importing. `scrollModel.ts` is their
tuning home.

### How it's anchored

A shmup level scrolls **down**: the player advances north, terrain moves
south across the screen, new tiles arrive at the top just before they're
needed. Tiles are ordered by **depth** — depth 0 is the first one met.

The clock is anchored so that **at a tile's own time zero the tile is
entirely off the top of the screen, with its south edge exactly on the
screen's top edge**. Nothing on it is visible yet; it scrolls down into
view from there.

That last part is the whole point. An enemy authored above its tile
genuinely spawns off-screen and flies in, the way a shmup's content
arrives — rather than popping into existence mid-screen the instant the
tile loads, which is what an earlier north-edge anchoring did.

**Air units do not ride the terrain.** Every authored position resolves through
the tile frame, and that frame slides down the screen as the level scrolls — so
everything on a tile moved with it, which is right for a turret bolted to the
ground and wrong for an aircraft, which the terrain should pass beneath. Keyed
off `UnitDef.layer` (`isScrollLocked`, `EncounterRunner.ts`), this is the
scroll-locked/time-locked reference-frame split `shmup-editor.todo.md` had
deferred. **The editor has since caught up** — its Ground/Air authoring
frames (`airFrame.ts`) mirror the rule below rather than deriving their own,
so what you draw is what plays; see `specs/shmup-editor.md`'s "Authoring
frames: Ground vs Air":

- **Ground and doodad stay scroll-locked**, resolving against the live frame
  forever.
- **Air is time-locked, but not from spawn.** The tile's north edge is a full
  `TILE_UNIT` above the screen at tile-clock zero, so a unit authored at the top
  of its tile spawns at screen Y −720; pinning its frame there would strand it
  off-screen forever instead of letting it fly in. An air unit tracks the
  scrolling frame exactly as a ground unit does **until it is first genuinely on
  screen**, and pins the frame origin at that moment (`pinnedOriginY`). It
  therefore still enters on cue where the author drew it, and from then on the
  only thing that moves it is its own authored path. Pinning the *current*
  origin makes the handover positionally continuous — nothing jumps on the frame
  it decouples.
- **The pin deliberately uses a different visibility test from culling.** Culling
  uses the generous `despawnMarginPx` so a path looping just off the edge isn't
  deleted mid-manoeuvre; the pin needs true viewport containment, because keying
  it off the margin decoupled air units 220px *above* the top edge, where they
  held station off screen and never appeared at all.

Measured in the engine with a turret and a helicopter authored side by side on
one tile: both descend together from y −515 to −28 as the tile scrolls in, then
at the moment the helicopter crosses the top edge it pins at y 5 and holds while
the turret carries on down (63 → 751) and off the bottom with its terrain.

**A known consequence:** an air unit whose authored path leaves it parked on
screen no longer scrolls away, so it is still there when its tile retires
(`tileFullyOffScreen`, ~11.1s) and gets recycled where it stands. Air units with
a real flight path fly themselves off and never hit this; a parked one pops. If
that becomes visible in practice the fix is ownership hand-off at tile retire,
not re-coupling air to the ground.

**A placed instance is therefore never culled until it has actually been on
screen at least once** (`shouldCull`, `EncounterRunner.ts`). The rule used to
be "off screen AND its authored path is over", which is fine for something
that flies a long path and wrong for everything else: a stationary or
single-step unit — a Turret, whose one step sits at time 0 — has its path
"over" on its very first frame, so every scaling slot that happened to start
outside the viewport was recycled immediately, before the scroll could bring
it into view. That silently ate most of a group: a `maxCount: 30` turret ring
put four on the field. It also explains the confusing workaround — adding a
spawn delay appeared to fix it, because staggering meant each slot was already
on screen by the time it spawned, not because the delay changed how many
instances the budget resolved to. The rule is now "has been seen, is off screen
now, and its path is over", with `placedUnseenLifespanSec` as a backstop so a
slot the scroll genuinely never reaches can't hold a pool slot all episode.

The anchoring collapses the whole mapping to one depth-independent line:

    screenY = localY - TILE_UNIT + LEVEL_SCROLL_SPEED * t

Everything else follows from it:

- A tile hands over to the next after `TILE_UNIT / speed` = **4s**, and the
  handover is seamless: tile *d*'s south edge lands on the screen top at
  the same moment tile *d-1*'s north edge does.
- A tile lasts `(TILE_UNIT + GAME_HEIGHT) / speed` = **~11.1s** from
  engaging to fully scrolled away. That, not the 4s handover, is the window
  an encounter gets.
- Consecutive tiles overlap, so ~1.8 tiles are visible at once.
- The player's position *in tile-local coordinates* moves: the ship starts
  a screen-height below the tile and climbs through it as the tile scrolls
  past.

A single-tile playtest is therefore not a special case at all — it's a
level of one, and looks exactly like that same tile played as depth 7.

Because every authored position resolves through its tile's frame at the
instant it touches a sprite, everything on a tile scrolls with it for free
— which is what a turret bolted to the ground requires. Spawned
projectiles are the deliberate exception: they're placed in screen space
when fired and fly under their own power, because a bullet in the air isn't
bolted to the ground.

### The editor shows the scroll

`computeCameraBoundsRect` and the player-reference marker both take a time
now and read their geometry from the shared model. Scrubbing the timeline
moves the dotted camera box up the tile and the player marker through it —
where before both were static rectangles that quietly implied the tile just
sits there. Fixing the width fell out of the same change: the camera is
always one screen across, and no longer stretches to a 3-wide tile.

The editor's **Air** authoring frame is the same geometry read the other way
round: it holds the camera box still and slides the tile through it, which is
what an aircraft actually experiences. Air units are drawn riding the terrain
until their pin moment and holding station after, matching `pinnedOriginY`
above exactly.

## Display size vs. hitbox size

Authored data pins **collision** size (`UnitDef.size`, a radius) and never
display size — the editor's encounter canvas draws fixed touch-target icons
and says so. So display size is derived: `size * TUNING.encounters.artToHitboxRatio`
(3). That preserves the relative sizes an author gave their roster and
keeps the shmup-standard "hitbox comfortably smaller than the ship"
relationship consistent, instead of varying with whatever PNG canvas the
art arrived on.

Part offsets are authored against `PartPositionEditor.tsx`'s 150px body
box, so they scale by `displaySize / 150` and rotate with the hull's
facing — the battleship's four turrets land on its four barbettes at any
size. Art is drawn facing **north**; `facingToRotation` bridges that to the
0 = +x / 90 = +y angle convention used everywhere else.

## What the runner does

`EncounterRunner` drives everything off the encounter's **one shared
clock** — the same clock the editor's timeline scrubber shows.

- **Placed instances** appear when the clock reaches their first step and
  walk their authored bezier path. A step's `time` is already derived from
  arc length and speed at authoring time and persisted, so the runner
  interpolates against those stored times rather than re-deriving them —
  playback can't drift from the timeline the author scrubbed. A dwell (a
  step at its predecessor's position) and a final step both hold in place.
- **Actions** resolve to movement, facing (`fixed` / `faceMovement` /
  `facePlayer`), an invincibility state derived by walking `setsInvincible`
  forward, and optionally an attack.
- **Attacks** are edge-triggered: `dueShots(attack, from, to)` answers
  "what crossed the wire since last frame," so each shot becomes exactly
  one entity. Burst `k` fires at `telegraphMs + k * burstIntervalMs`, shot
  `i` within it at `+ i * perShotDelayMs`, sweep sampled once per burst.
  Switching Action restarts the schedule, so a wind-up is relative to its
  own Action and reads the same wherever it's placed.
- **A projectile is a Unit.** Firing spawns another full live instance —
  own stats, art, Parts, Actions — so a bullet that splits, homes
  (`facePlayer` on a spawned Unit *is* homing), or shoots back needs no
  special case.
- **Parts** ride the hull with their offsets rotated by its facing, and run
  their own independent Action tracks from the encounter's Part-action
  placements. A hand-placed hull with no placements for a Part leaves it
  idle, exactly as the editor timeline shows; a *dynamically spawned* Unit
  has no placement track at all, so its Parts fall back to their own first
  Action — the same rule `defaultActionId` exists for on the base Unit.
- **Scaling** resolves each placement's slots up front from the incoming
  Difficulty (`resolveScaling` + shape geometry + ping-pong), staggered by
  `spawnDelayMs`. Every duplicate replays the whole authored sequence
  anchored to its own slot.

## Levels

The Connection Viewer can now **autogenerate** one (`generateLayout.ts`):
one press grows the layout north by 8 tiles from whatever is already
placed, picking a random starting tile if nothing is. Press it again for a
longer level — the button *is* the length control, which is why there's no
separate length field. Every placement goes through
`candidatesForAddPoint`, the same matcher the manual "+ Add" uses, so a
generated level is legal by identical rules and stays fully hand-editable
(rotate, delete, extend) rather than being an opaque blob. It stops early
at a dead end, and the partial level it leaves is the diagnostic.

This is an authoring aid built on the viewer's own rules, *not* the game's
L1 frontier generator (`systems/levels/generateLevel.ts`). That one streams
forward from a single open edge with per-branch difficulty budgets, in its
own coordinate model, with no notion of the free-form 2D grid the viewer
builds in. The two should converge on the game's model when runtime
generation lands.

The Connection Viewer builds a real (row, col) grid but used to keep it in
local component state, so there was nothing for the game to read.
`levelStore.ts` now saves it to `LEVEL.DAT` next to `TILES.DAT` — a thin
list of tile **ids** plus where and how each sits, so everything else about
a tile is resolved fresh at play time and editing a tile shows through in a
layout saved earlier instead of being frozen into it.

`layoutFromGrid` converts the editor's rows (which grow **south**) into
play order: `depth = maxRow - row`, since the southernmost tile is where
you fly in. Columns are normalised and the level is centred on the camera.

Each tile rolls its own Encounter by `weight` when the level starts — the
tile model's "a random one is picked when the tile spawns in a level."
The Encounter editor's own Play Test pins that roll instead, since the
whole point there is to see *that* encounter.

### Orientation

A tile may be rotated or flipped in the layout, and its authored encounter
comes with it: step positions are transformed once up front, `fixed`
facings are transformed as they're read, and a flip additionally reverses
arc handedness so a spread authored to fan left fans right on the mirrored
copy. The transform is **exact**, not approximate, because 90°/270° are
only ever offered to footprint-1 (square) tiles — the same rule
`systems/levels/orientation.ts` applies to edge tags, for the same reason.

Scaling slots are resolved in *unoriented* space and each resulting
position oriented afterwards. Doing it in that order keeps the transform
exact for every shape; orienting a shape's own handles instead would have
to swap a grid's width and depth on a quarter turn and get a ring's
handedness right on a flip.

### Difficulty is never zero by accident

`resolveScaling` floors an instance's count at **zero** — an instance whose
`minCostPerInstance` exceeds the incoming Difficulty simply doesn't spawn.
That's the mechanism that gates an "elite" placement out of low-D runs, and
it means a playtest at Difficulty 0 correctly spawns *nothing at all*. The
picker therefore defaults to 10 and exposes -/+ controls; seeing a swarm
appear as you dial up is most of what makes an authored scaling curve
testable.

## Collision

A flat collision group on each attack (`enemy` / `friendly` /
`enemyProjectile` / `friendlyProjectile`) plus two Phaser groups reproduces
"same group never checks itself, the two projectile groups never check each
other" with no spawner-lineage tracking:

| Overlap | Effect |
|---|---|
| player bullets ↔ authored hostiles | damage, through the existing pierce/fork/blast pipeline |
| authored hostiles ↔ player | contact damage; a projectile is spent, a placed enemy is not |
| authored friendlies ↔ authored hostiles | contact damage to the hostile |

`PlayerTarget` (`entities/types.ts`) is what lets one damage path serve
both built-in `Enemy` and `AuthoredUnit`. `applyDamage` returns *whatever
died*, which is not always what was hit: an authored Part with a hitbox but
no health passes damage through to its hull, so score, EXP and the coin
drop land on the hull rather than the turret. Invincible units aren't "hit
for zero" — they aren't hit at all, so they never consume a pierce charge.

Authored enemy projectiles graze exactly like built-in ones. The shared
`entities/spawnId.ts` counter is what lets both feed one `GrazeTracker`
without their ids colliding.

## Playtest flow

A playtest episode is a real episode — same `PlayScene`, same ship, HUD,
Hype, coins — with two differences: the ambient spawner and survival timer
are off (the level *is* the content), and the run returns to
`PlaytestResultScene` instead of `ResolveScene`. That second one matters:
Resolve applies Ratings, gold and EXP to the **persisted career**, and
trying out content you're mid-authoring must not be able to cost or pay a
real run.

A tile is done when **either** its authored content is spent (every
authored moment passed, the grace period for in-flight shots over, nothing
hand-placed left alive) **or** the tile has scrolled entirely off the
bottom of the screen — whichever comes first. The second half is what stops
an authored unit that parks itself on screen, or one the player can't kill,
from stalling a level: the ground moves on regardless. The level as a whole
ends when every tile is done, or when the last one has scrolled away.

**A tile with no Encounter is ordinary terrain, not an instantly finished
tile.** It has nothing to spend, so only the scrolled-off half applies — it
draws and scrolls past like any other. Two things follow from that, and
both were bugs before it was written down:

- Its art has to be preloaded from the **layout**, not from a walk over
  (tile, encounter) pairs. Collecting tile art inside the encounter walk
  meant an encounter-less tile contributed nothing, its texture never
  loaded, and it rendered as a hole in the level — which autogeneration
  hits constantly, since it draws from the whole tile library.
- Treating "no encounter" as "already complete" retired it the instant it
  engaged, and since the level ends when every tile is done, could end a
  level while its last stretch of ground was still on screen.

## Not built yet

- **Runtime generation.** Autogeneration lives in the editor; a real
  episode still needs the game to generate its own level from the node's
  Difficulty. `authoredToGeneratorTile()` already projects an authored tile
  into the shape `systems/levels`' generator consumes, and `LevelRunner`
  needs no changes — a generated `LevelLayout` is the same shape as a saved
  one. The open question is whether the editor's generator then folds into
  the game's, or stays a separate authoring convenience.
- **Difficulty doesn't drive level length.** It's the per-tile scaling
  budget, which is what `D` means in the authored model; the number of
  tiles is a press count. If longer-at-higher-D is wanted, that's a design
  decision to make explicitly rather than a coincidence to lean on.
- **JIT streaming.** Every tile in a level is built up front. Fine for a
  hand-assembled playtest, wrong for a long generated one —
  `levels-and-tiles.spec.todo.md` §3 is the real design.
- **Camera bounds for multi-column tiles.** A footprint-2/3 tile, or a
  multi-column level, is wider than the screen; it's centred and overflows.
  The easing playable-bounds box is §4's L2 work.
- **`power` has no effect.** It's threaded from each instance down to what
  it spawns, per the authored model, but nothing consumes it yet — that
  lands as a data change when the per-stat scaling curves are designed.
- **Warning indicators** for off-screen units moving toward the play area
  (`spawn-and-warnings.spec.todo.md` §3's revised framing).
- **Sound.** Authored encounters are silent, like the rest of the game.
