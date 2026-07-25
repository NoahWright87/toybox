# Shmup — Authored Encounters Spec (playing `/shmup-editor` content in the engine)

> **Status:** single-tile encounter playback **implemented**. Multi-tile
> level assembly is the next slice — see "Not built yet" at the bottom.
> Related: `../../shmup-editor.md` (the authoring tool),
> `levels-and-tiles.spec.todo.md` (L1/L2, the generator this feeds),
> `enemies-and-bullets.spec.todo.md` (L3/L4, the model the editor authors).

## What this is

`/shmup-editor` authors tiles, Units and Encounters. This spec covers the
other half of that loop: **the game loading that content and playing it**,
with the real ship, real weapons, real Hype and real coins — not a preview
of them.

The entry point today is **Main Menu → TEST ENCOUNTER**: pick an authored
tile, pick one of its Encounters, set a Difficulty, and play it through.

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

**The two packages still share no runtime code** (`shmup-editor.todo.md`'s
standing rule). The data *shapes* are mirrored — `authoredTypes.ts`
mirrors the editor's `types.ts`/`unitTypes.ts`/`encounterTypes.ts`,
`editorArt.ts` mirrors its art tables, `frame.ts`'s `TILE_UNIT` mirrors
`editorScale.ts` — in the same direction the editor already mirrors the
game (its `hitboxPreview.ts` re-declares the game's aspect ratio and
player hitbox radius rather than importing them).

### Save-version coupling

`AUTHORED_TILES_VERSION` / `AUTHORED_UNITS_VERSION` must track the
editor's `tileStore.ts` / `unitStore.ts` `SAVE_VERSION` (both 9 today). A
mismatch reads as "nothing authored," deliberately — a pre-v9 save's
Action/step shape is not something to half-read. **Bump both sides
together.**

Individual records are validated one at a time, though: a mangled Unit
drops that Unit, not the library. These files are meant to be hand-edited.

## Coordinates: the editor canvas is the game frame

Authored positions are **tile-local** — the tile's north-west corner is
(0,0), +x east, +y south, one footprint column is `TILE_UNIT` (720) across.
`frame.ts` is the only place that becomes screen pixels.

- **Scale is 1:1.** `TILE_UNIT` is deliberately `GAME_WIDTH`, so a 1x1 tile
  is exactly one screen wide and an authored pixel is a game pixel.
- **Vertically the frame is pinned by the player reference marker**, not by
  the tile's edges. The editor draws a player stand-in 85% down the tile;
  `t = 0` puts that marker exactly where the ship sits. The editor's static
  canvas and the game's opening frame therefore agree pixel for pixel.
- A tile is 720 tall against a 1280 screen, so it occupies the lower ~56%
  and an entrance authored above the tile (negative local y, where the
  editor's own default first step sits) lands on the upper part of the
  screen — off the tile, on screen.

A single-encounter playtest **holds this frame still**. Scrolling it is
what turns this into a level; because every position resolves through the
frame at the moment it touches a sprite, giving `originY` a velocity moves
everything authored with its tile for free.

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
are off (the encounter *is* the content, and it clears when it has played
through), and the run returns to the picker instead of `ResolveScene`.
That second one matters: Resolve applies Ratings, gold and EXP to the
**persisted career**, and trying out an encounter you're mid-authoring must
not be able to cost or pay a real run.

"Played through" means every authored moment has passed, the grace period
for in-flight shots is over, and nothing hand-placed is left on the field.
A placed instance whose final step parks it on screen keeps the encounter
open on purpose — clearing the field is what playing one *through* means.
The debug overlay's advance-stage control is the escape hatch when an
authored unit can't be removed (an invincible one, say).

## Not built yet

- **Multi-tile levels.** The Connection Viewer's grid is local component
  state today — it isn't persisted, so there's nothing for the game to
  read. The next slice is: persist an assembled layout, add a scroll
  velocity to `TileFrame`, and stream tile frames as the camera advances.
  `authoredToGeneratorTile()` already projects an authored tile down to
  `systems/levels`' generator shape, so a *generated* (rather than
  hand-assembled) level of authored tiles is the same seam.
- **Camera bounds for multi-column tiles.** A footprint-2/3 tile is wider
  than the screen; it's centred and overflows. The easing playable-bounds
  box is `levels-and-tiles.spec.todo.md` §4's L2 work.
- **`power` has no effect.** It's threaded from each instance down to what
  it spawns, per the authored model, but nothing consumes it yet — that
  lands as a data change when the per-stat scaling curves are designed.
- **Warning indicators** for off-screen units moving toward the play area
  (`spawn-and-warnings.spec.todo.md` §3's revised framing).
- **Sound.** Authored encounters are silent, like the rest of the game.
