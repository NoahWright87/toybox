# Shmup — Hype & Ratings Spec

> Issue: **F7 #135**. Status: implemented (Model 1). Code lives in
> `games/shmup/src/systems/hype/`, integrated into
> `games/shmup/src/scenes/PlayScene.ts`. The episode->map transition (real
> node graph, Ratings gating, career persistence) is now implemented by
> **F8 #136** — see `run-structure.spec.md`. The survival-timer stage-end
> condition for standard/elite nodes described below is still F6's original
> vertical-slice mechanic (a `bossFinale` node clears on boss defeat instead,
> per `run-structure.spec.md`).

## Grazing

Detection runs every frame in `PlayScene.updateGrazeAndHype()`: for each
active `EnemyBullet`, the distance to the player is compared against
concentric rings, fractions of the player's `grazeRadius` stat
(`TUNING.graze.rings`, `grazeRingAt()` in `systems/hype/grazeRings.ts`):

```
rings = [{frac:1.0, mult:1}, {frac:0.55, mult:2}, {frac:0.25, mult:4}]
```

- A bullet grazes ring `r` when `distance <= grazeRadius × r.frac`. Rings are
  evaluated smallest-`frac`-first so a bullet inside multiple rings only ever
  pays out its **innermost** match — no stacking. Point-blank grazing is the
  deliberate high-skill, high-reward act.
- `grazeMultiplier` is a separate stat (`EXOTIC_STAT_IDS`) applied on top of
  the matched ring's `mult` at the point of use.
- Identity across frames is tracked by `EnemyBullet.spawnId` (a static
  incrementing counter, not object reference), since Arcade Physics pools and
  recycles bullet sprites. `GrazeTracker` (`systems/hype/grazeTracker.ts`)
  diffs this frame's graze map against last frame's to emit `start`/`end`
  events with a live streak count, and re-grazing a recycled `spawnId` after
  an `end` is treated as a brand-new `start`.
- The graze event API is documented in `systems/hype/types.ts`'s
  `ShmupEventMap` (`grazeStart`, `grazeEnd`, plus `hypeChanged`,
  `ratingsChanged`, `scoreEvent`) and delivered over `ShmupEventBus`
  (`systems/hype/eventBus.ts`). PlayScene is currently both the sole emitter
  and the sole subscriber (HUD + debug overlay); items (F4), the audience
  service (T10 #161), and Score (C14 #163) subscribe once they exist.

## Hype — in-episode performance meter

Starts at 0 each episode (`PlayScene.create()` resets `hypeState` on every
`scene.restart()`, since Phaser doesn't rerun the constructor). Rendered as a
gold bar in the HUD beneath HP/Shield.

```
HypeMax = base × crowdSize × itemMods
gain:    Hype += eventValue × hypeGainMods       # clamp to HypeMax; idleTime -> 0
decay:   d = baseDecay × (1 + k_idle·idleTime) × (1 + k_level·Hype/HypeMax)
         Hype = max(0, Hype - d·dt)              # super-linear: idle = rapid crash, top is slippery
reward:  ScoreMult = 1 + (Hype/HypeMax)·M
```

Implemented in `systems/hype/hype.ts` (`hypeMax`, `gainHype`, `decayHype`,
`scoreMult`), constants in `TUNING.hype`:

- `base = 100`, `crowdSizeDefault = 1` (stand-in until the audience service,
  T10 #161, supplies a real crowd size), `kIdle = 0.6`, `kLevel = 0.8`,
  `baseDecay = 6`, `scoreMultDepth = 2` (M — up to ×3 score at full Hype).
- `grazeGainPerSecond = 18` — Hype/s while grazing at ring `mult` 1 and
  `grazeMultiplier` 1, scaled by both at the point of use. **Grazing is the
  only Hype source this slice wires up** — kill/trick/elite sources (and
  Hype-reshaping items like Masochist) are future item-driven additions, not
  implemented here.
- `gainHype`/`decayHype` both guard `hypeMaxValue <= 0` to avoid a
  divide-by-zero; `scoreMult` does the same, returning `1`.

`PlayScene.updateGrazeAndHype()` recomputes `hypeMaxValue` every frame,
applies `gainHype` while `grazeResult.totalMult > 0` (continuous per-second
accrual: `grazeGainPerSecond × totalMult × grazeMultiplier stat × dt` as the
`eventValue`), otherwise applies `decayHype`, then derives `currentScoreMult`
from the resulting Hype and emits `hypeChanged`.

## Score — ScoreMult applied exactly once

`PlayScene.gainScore(baseAmount, source)` is the single place score is added:
`amount = baseAmount × currentScoreMult`. Every kill (`damageEnemy()`) routes
through it, and it emits `scoreEvent` (`{ source, baseAmount, scoreMult,
amount }`) on the event bus. **No other code path adds to `this.score`** —
this is what keeps Ratings' conversion from double-counting Hype (see below).

## Ratings — persistent career tier

Earned by converting the episode's (Hype-inflated) Score at episode end.
`PlayScene` only ever computes the Ratings *delta* — it never persists
Ratings itself. `ResolveScene` is the sole place a Ratings change is applied
and saved, as part of the full `CareerState` (`systems/career/persistence.ts`,
key `"career"`, via the `SaveStore` port — see `save.spec.md` and
`run-structure.spec.md`). The old standalone `shmup_ratings_v1` localStorage
key this section originally described is gone; `systems/career/persistence.ts`
reads it once as a migration into a fresh career's starting Ratings.

```
# Model 1 -- Hype is rewarded ONCE, via ScoreMult. Do NOT apply a second Hype multiplier.
on clear:  RatingsGain = EpisodeScore × CrowdConversion × ratingsMods
           # EpisodeScore is already Hype-inflated, so "average Hype" is baked in via the integral
on death:  RatingsLoss = BasePenalty × (1 - stageProgress) × embarrassmentMod
           # + forfeit the episode's would-be RatingsGain (nothing banks)
cancelled: cumulative Ratings < 0
```

Implemented in `systems/hype/ratings.ts` (`ratingsGainOnClear`,
`ratingsLossOnDeath`, `applyRatingsDelta`), constants in `TUNING.ratings`:

- `crowdConversion = 0.02`, `deathBasePenalty = 40`,
  `deathEmbarrassmentMod = 1`.
- `episodeClearDurationSec = 90` — the survival-timer clear condition for
  `standard`/`elite` nodes; a `bossFinale` node clears on boss defeat
  instead (`run-structure.spec.md`). Also the denominator for `stageProgress`
  on an early death (`elapsedEpisodeSec / episodeClearDurationSec`, clamped
  into `[0, 1]` by `ratingsLossOnDeath`) — except on a `bossFinale` node,
  where `stageProgress` is how much of the boss's HP got depleted instead.

`applyRatingsDelta(current, delta)` returns the new value plus a `cancelled`
flag (`ratings < 0`). `PlayScene` only computes the delta (`ratingsGainOnClear`
on clear, `-ratingsLossOnDeath(...)` on death) and hands off to
`ResolveScene` (`run-structure.spec.md`'s episode flow) — `ResolveScene` is
the one place `applyRatingsDelta` actually runs and the result gets saved
into `CareerState`, cancelled or not.

- **Gates ACCESS, not difficulty:** more node options skewed toward special
  nodes (`run-structure.spec.md`) — wired up via `systems/map/generateMap.ts`'s
  `ratingsRank` input; D itself never reads Ratings.
- **Tier ladder** (`content/ratings.ts`'s `RATINGS_LADDER`, looked up via
  `ratingsTierForScore`/`ratingsTierName` in `content/accessors.ts`): Nobody
  -> Has-Been -> Cult Following -> Local Legend -> Up-and-Comer -> Household
  Name -> Radical -> Kevin Bacon, at thresholds 0/100/500/1500/4000/10000/
  25000/60000. Displayed live in the HUD (`play.ratings` copy key,
  top-right) and in the debug overlay.

## Why Model 1

Current Hype multiplies score live; accumulating that Hype-inflated score
across the episode *is* a time-average of your Hype, weighted by activity.
So a separate average/peak-Hype settlement multiplier would double-count.
Hype is rewarded exactly once, continuously, via `ScoreMult` in
`gainScore()` — `ratingsGainOnClear`/`ratingsLossOnDeath` never re-apply it.

## Related

- [`stats.spec.md`](stats.spec.md) — `grazeRadius`/`grazeMultiplier` exotic
  stats (F3 #131) that grazing reads
- [`combat.spec.todo.md`](combat.spec.todo.md) — `EnemyBullet.spawnId`,
  pooled-entity identity pattern shared with grazing's `GrazeTracker`
- [`run-structure.spec.md`](run-structure.spec.md) — F8 #136's real
  episode->map transition, boss stage-end condition, and Ratings-gated node
  access (this spec's `episodeClearDurationSec` and cash-in flow are
  integrated, not superseded, there)
- [`tuning.spec.todo.md`](tuning.spec.todo.md) — owns every numeric constant
  referenced here (`TUNING.graze`, `TUNING.hype`, `TUNING.ratings`)
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
