# Shmup — Run Structure Spec (career, map, difficulty, episode flow)

> Issue: **F8 #136**. Status: implemented. Code lives in
> `games/shmup/src/systems/{difficulty,map,career}/`, `games/shmup/src/scenes/{MapScene,PlayScene,ResolveScene}.ts`.
> Numbers are placeholders for the balance pass — see `tuning.spec.todo.md`.
> Death/audience-reaction polish beyond what's described here is **F11
> #139**'s job; see `run-structure.spec.todo.md`.

## Career = Seasons

A **career** = `TUNING.difficulty.seasonCount` (5) **Seasons**. Each Season is
a node map (FTL/StS style) capped by a **Season Finale boss**; the last
Season's boss is the **Series Finale**. Beating or losing the Series Finale
records a **Finale score** (`CareerState.finaleScore`, a Ratings snapshot)
and moves the career into **Syndication** — an endless mode of standard
episodes at ever-rising Difficulty (`systems/career/types.ts`'s
`CareerPhase`). Getting Cancelled during Syndication records a **Syndication
score** the same way.

**Season always advances, win or lose** — `systems/career/careerState.ts`'s
`advanceToNextSeason()` runs after a Season Finale resolves either way, in
`ResolveScene.resolveCareer()`. Losing forfeits the episode's would-be
Ratings gain (`ratingsLossOnDeath` applies instead) but the Season number
still increments and a fresh map generates.

## Difficulty (D) — the master escalation scalar

`systems/difficulty/difficulty.ts`'s `computeDifficulty(ctx)` implements the
escalation formula exactly:

```
D = seasonBase(season) + episodeRamp*episodeIndex + stageOffset
  + itemModifiers + deadlinePenalty*mapLag
```

- `TUNING.difficulty.seasonBase` is a 5-entry table (index = season-1,
  clamped); `episodeRamp` multiplies against `episodeIndex`
  (`CareerState.visitedNodeIds.length` at the moment a node is entered —
  climbs through a Season regardless of node type).
- `stageOffset` comes from the node itself (`MapNode.difficultyOffset`,
  authored per node type in `TUNING.map`: shop/event/treasure run flat-to-negative,
  elite runs positive). `itemModifiers` is reserved for risk items
  (items-and-brands.spec.todo.md) and defaults to 0 — not wired up yet.
- `mapLag` is computed once on episode entry via `systems/map/deadline.ts`'s
  `mapLagFor(deadlinePosition, node.col)` — 0 while the player's column is
  still ahead of (or at) the deadline marker.
- D is **independent of Ratings** — nothing in `systems/difficulty/` reads
  Ratings or the career's tier.

### Per-stat curves (`systems/difficulty/curves.ts`)

One input, non-uniform response: `hpCurve(D)` ramps fast (linear + quadratic
term), `dmgCurve(D)` ramps slow (sqrt), `speedCurve`/`fireRateCurve` are
linear, `densityCurve(D)` shrinks spawn interval toward a floor
(`densityCurveMaxReduction`), `rewardCurve(D)` grows `scoreValue` payouts,
and `rarityLuck(luck, D) = luck + luckFromD*D` is exposed for (and consumed
by) the F9 #137 offer system (`economy.spec.md`, `systems/economy/offers.ts`).

### Per-archetype emphasis + composition thresholds (`systems/difficulty/archetypes.ts`)

Two enemy archetypes exist today, each with its own emphasis weights against
the shared curves (`ARCHETYPE_EMPHASIS`):

| Archetype | Lean | Notes |
|---|---|---|
| `drone` | baseline (1/1/1/1) | The swarmer — its lean is spawn density, not per-enemy stats |
| `elite` | HP 1.6, damage 1.3, speed 0.6, fire-rate 0.5 | The bruiser |
| `boss` | HP 1.1 + a flat `bossHpMult` (3x), damage 1.15 | Season/Series Finale only |

`eliteUnlocked(D)`/`eliteChance(D)` gate composition: elites are impossible
below `eliteUnlockD`, then their per-spawn odds ramp linearly to
`eliteChanceMax` by `eliteChanceMaxD`. An **elite node** forces every spawn
to roll `elite` regardless of D (`PlayScene.spawnEnemy()`); a **standard**
node rolls per spawn via `rollSpawnArchetype(D)`. `scaledEnemyStats()`
combines a base config (`TUNING.enemies.<archetype>`) with the curves and
this table to produce the numbers `Enemy.spawn()` actually uses — Enemy
itself has no D/curve math.

## The overworld deadline

`systems/map/deadline.ts`:

- `advanceDeadline(position, playerSpeed)` — the deadline moves forward by
  `deadlineAdvancePerNode` each time a node resolves, reduced by
  `deadlineSlackPerSpeed * playerSpeed` (Player Speed is an overworld-only
  effect here; in-episode Player Speed is pure movement), floored at
  `deadlineMinAdvance` so it always creeps. `ResolveScene` calls this after
  every non-boss node resolution, using the resolved build's Player Speed
  stat (`resolveLoadout({ weapons: career.weapons })`).
- `mapLagFor(deadlinePosition, playerColumn)` — `max(0, deadline - column)`,
  fed into `computeDifficulty` on episode entry (see above). Falling behind
  on purpose to farm extra nodes is a valid, harder-road play.
- The deadline resets to 0 at the start of every Season
  (`advanceToNextSeason`) — each Season is its own pursuit.

## Node map

`systems/map/generateMap.ts`'s `generateSeasonMap(season, ratingsRank, seed)`
is a deterministic (mulberry32-seeded) DAG generator:

- `TUNING.map.columnsPerSeason` regular columns funnel into a single boss
  column. Every node in column *c+1* has at least one incoming edge from
  column *c* (no orphans); the last regular column connects entirely to the
  boss node.
- Node types: `standard`, `elite`, `shop`, `event`, `treasure`,
  `bossFinale` (`systems/map/types.ts`'s `NodeType`). Per-node counts and the
  special-node (`shop`/`event`/`treasure`) odds rise with **Ratings rank**
  (`TUNING.map.specialNodeBaseChance` + `specialNodeChancePerRatingsRank *
  rank`, capped) — **Ratings never appears in `systems/difficulty/`,** only
  here, gating node count/skew as designed. Elite-node odds are flat,
  independent of Ratings.
- `systems/map/visibility.ts`'s `nodeVisibility()` implements the fog: BFS
  depth from the currently-available nodes — depth 0 (available) and
  already-visited nodes are `"full"`, depth 1 is `"partial"` (category-only
  color, no label), depth 2+ is `"hidden"` (a `"?"` pip). A future radar item
  extending this is noted in `run-structure.spec.todo.md`.
- `MapScene` renders the graph bottom-to-top (column 0 near the bottom of
  the portrait canvas, the boss column near the top) with the deadline drawn
  as a horizontal marker, edges from the current position highlighted, and a
  live Difficulty (`D{n}`) readout under every visible combat node.

## Episode flow

`Boot -> Map -> Play -> Resolve -> Map -> ...`, driven entirely by
`scenes/sceneData.ts`'s `EpisodeLaunchData`/`ResolveLaunchData` payloads:

1. **Map**: the player taps an available node. `standard`/`elite`/`bossFinale`
   compute D and launch `PlayScene` with `{ nodeId, nodeType, season, D,
   ratings, weapons, isSeriesFinale }`. `shop`/`event`/`treasure` skip Play
   entirely and launch `ResolveScene` directly with `outcome: "special"` and
   a flat Ratings bonus (`TUNING.map.<type>RatingsBonus` — shop's is 0;
   `ResolveScene` instead routes a shop node on to the dedicated-node
   `ShopScene`, `economy.spec.md`, F9 #137).
2. **Play** (F6's loop): runs the existing survive-a-timer clear condition
   for `standard`/`elite`; a `bossFinale` node spawns one boss
   (`PlayScene.spawnBoss()`) instead of the regular spawner, and clears when
   the boss's HP reaches 0. PlayScene reads `ratings` for HUD display only —
   **it never persists Ratings or any career state itself.** On clear/death
   it computes the Hype-inflated `ratingsGainOnClear`/`ratingsLossOnDeath`
   delta and hands off to `ResolveScene` via `scene.start()`.
3. **Resolve**: the only place a career mutation is saved
   (`systems/career/persistence.ts`'s `saveCareer`). Loads the current
   career fresh, applies the Ratings delta
   (`applyRatingsDelta`), and branches:
   - **Cancelled** (`ratings < 0`): shows the Cancelled screen, replaces the
     saved career with `createNewCareer()` — no meta-progression carries
     over. If this happened during Syndication, the pre-cancel Ratings is
     shown as the Syndication score.
   - **bossFinale, not the Series Finale**: `advanceToNextSeason()`, save,
     show the Season Finale flavor screen.
   - **bossFinale, the Series Finale**: records `finaleScore`, flips
     `phase` to `"syndication"`, save, show the Series Finale + Syndication
     flavor screens.
   - **any other node**: appends to `visitedNodeIds`, sets `currentNodeId`,
     advances the deadline, save, show the plain clear/death screen.
   - **Syndication phase**: same Ratings-delta handling, but increments
     `syndicationEpisodeIndex` instead of touching `seasonMap`.
   "Continue" always returns to `MapScene`, which re-reads the just-saved
   career from scratch.

## Death (no hull lives)

Unchanged from `hype-and-ratings.spec.md` (F7 #135): one death ends the
episode, `RatingsLoss = BasePenalty * (1 - stageProgress) * embarrassmentMod`,
the episode's would-be gain doesn't bank, boss rewards are forfeited. On a
`bossFinale` node, `stageProgress` is how much of the boss's HP got chewed
through instead of elapsed time — a truer measure of how close the fight
was. **Build persists** — `CareerState.weapons` (currently just the one
placeholder weapon, `weaponById()`) survives every episode, win or lose,
rehydrated into `Player`'s loadout by `PlayScene.create()`.

## Career loss

**Cancelled = cumulative Ratings < 0**, any time. Ends the career; a fresh
one starts from Season 1 with no carried-over Ratings, map, or deadline —
`weapons` also resets to the starting build via `createNewCareer()`.

## Persistence (CLAUDE.md reload rule)

`systems/career/persistence.ts`'s `loadCareer()`/`saveCareer()` go through
the `SaveStore` port (`save.spec.md`), key `"career"` (`CAREER.DAT` under
`C:\Programs\Games\SHMUP\Saves\`). `isValidCareerState()` checks the version
tag and every top-level field before trusting a save; a corrupt or
stale-shape save falls back to a fresh career rather than crashing. A
one-time migration reads the pre-F8 `shmup_ratings_v1` localStorage key (now
otherwise dead — `systems/hype/persistence.ts` was removed) into a fresh
career's starting Ratings so existing players don't lose progress.

Because only `MapScene`/`ResolveScene` ever call `saveCareer()` — never
`PlayScene` — a reload mid-episode always resumes at the **pre-episode map
state**, exactly as the reload rule requires: there is nothing to resume
mid-episode, just the map the player was standing on before tapping the node.

## Related

- [`hype-and-ratings.spec.md`](hype-and-ratings.spec.md) — Hype/Score/Ratings
  formulas this spec's episode flow cashes in via `ResolveScene`
- [`save.spec.md`](save.spec.md) — the `SaveStore` port `systems/career/persistence.ts` is built on
- [`tuning.spec.todo.md`](tuning.spec.todo.md) — every numeric constant referenced here (`TUNING.difficulty`, `TUNING.map`, `TUNING.enemies`)
- [`stats.spec.md`](stats.spec.md) — Player Speed, the stat the overworld deadline reads
- [`run-structure.spec.todo.md`](run-structure.spec.todo.md) — remaining future work (radar item, shop economy tie-in, F11's death/audience polish)
- [`levels-and-tiles.spec.todo.md`](levels-and-tiles.spec.todo.md) — Epic 5 #181's data-driven level content generated inside each node's Play scene; adds no field to this system at all (biome is tag-emergent, see its §5)
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
