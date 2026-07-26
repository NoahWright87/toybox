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

The clock is anchored so that **at a tile's own time zero, that tile's
north edge sits exactly on the top edge of the screen**. So an encounter
starts with its tile filling the top of the view and scrolling down out of
it: no dead time waiting for content to arrive, and identical whether the
tile is played alone or as depth 7 of a level. A single-tile playtest is
therefore not a special case at all — it's a level of one.

That anchoring collapses the whole mapping to one depth-independent line:

    screenY = localY + LEVEL_SCROLL_SPEED * t

Everything else follows from it:

- A tile hands over to the next after `TILE_UNIT / speed` = **4s**.
- A tile stays on screen for `GAME_HEIGHT / speed` = **~7.1s** from
  engaging. That, not the 4s handover, is the window an encounter gets.
- Consecutive tiles overlap, so ~1.8 tiles are visible at once.
- The player's position *in tile-local coordinates* moves: the ship starts
  below the tile and climbs through it as the tile scrolls past.

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

A tile's encounter ends when **either** its authored content is spent
(every authored moment passed, the grace period for in-flight shots over,
nothing hand-placed left alive) **or** the tile has scrolled entirely off
the bottom of the screen — whichever comes first. The second half is what
stops an authored unit that parks itself on screen, or one the player
can't kill, from stalling a level: the ground moves on regardless. The
level as a whole ends when every tile is finished, or when the last one
has scrolled away.

## Not built yet

- **Generated levels.** Today a level is hand-assembled in the Connection
  Viewer. The next step Noah wants is "pick the starting tile, give it a
  Difficulty, and it builds one for you" — which is exactly
  `systems/levels`' existing frontier generator.
  `authoredToGeneratorTile()` already projects an authored tile down to the
  shape that generator consumes, so the remaining work is running it over
  the authored library and feeding the result to `LevelRunner` in place of
  a saved layout. `LevelRunner` needs no changes for it: a generated
  `LevelLayout` is the same shape as a saved one.
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
