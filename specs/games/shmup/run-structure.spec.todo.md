# Shmup — Run Structure Spec (career, map, difficulty, death, persistence)

> Issues: **F8 #136** (map/seasons/difficulty), **F11 #139** (death/persistence). Status: framing locked. Numbers in `tuning.spec.todo.md`.

## Career = Seasons

- A **career** = ~5 **Seasons** (tunable). Each Season is a node map (FTL/StS style) capped by a **Season Finale boss**. The last Season ends in the **Series Finale (final boss)**.
- Beat the Series Finale → record **Finale score** → optionally continue into **Syndication** (endless). Cancelled there → record **Syndication score**.
- **Season always advances** — even if you lose the Finale boss. Losing just costs Ratings and forfeits boss gold/items.

## The overworld deadline (FTL-style)

**Stages auto-scroll, so there is no in-episode timer.** The time pressure is **between episodes**:
- A **deadline marker** creeps across the overworld map (left→right) as you take nodes — like FTL's pursuing fleet.
- If the deadline has advanced **past** the episode you attempt, that episode runs at elevated Difficulty; the further behind you are, the harder (see the D formula). 
- **Deliberately falling behind to farm extra nodes is a valid high-risk/high-reward play** — amass resources, but face a hard road.
- **Player Speed** slows the deadline's advance (overworld-only effect; see `combat.spec.todo.md`), buying slack to take more nodes safely.

## Difficulty (D) — the master escalation scalar

A single number drives all escalation. **Most enemy stats key off D** through **per-stat curves** (HP fast, damage slow, etc.) defined in `tuning.spec.todo.md` — one input, non-uniform response. Plus:
- **Per-archetype emphasis:** each enemy type leans into certain stats as D rises (bruiser → HP/damage, swarmer → count/speed).
- **Composition thresholds:** higher D unlocks more elites, denser formations, nastier patterns.

D also **scales rewards** (gold/EXP — harder = richer) and gives a **Luck-like rarity boost** to offers (`rarityLuck = Luck + luckFromD × D`). D stays **independent of Ratings** (which gates *access*). Special nodes may carry a **negative D offset** (safer).

### Escalation formula

```
D = seasonBase(season)              # persistent: each Season starts harder
  + episodeRamp × episodeIndex      # persistent: climbs through a Season
  + stageOffset + itemModifiers     # bonus-hard stages / risk items add flat D
  + deadlinePenalty × mapLag        # mapLag = how far the overworld deadline has passed you
```

- `mapLag` is a **between-episodes / overworld** quantity (0 while you're ahead of the deadline). It is computed when you enter an episode — **not** an in-episode clock.
- **Difficulty settings** change `seasonBase` start + ramp slopes (one place). Optional visible **"Threat Level"** readout.

## Node map

- Choose among nearby nodes; full info on adjacent, partial further out (radar item reveals more).
- **Ratings unlocks MORE node options**, skewed toward **special nodes** (shop/treasure/challenge/bonus). **Luck biases special-node odds.** Neither changes D.
- Node types: standard combat, elite, shop, event, treasure, Season Finale boss.

## Death (no hull lives)

- **One death = the episode ends.** Returned to the map.
- `RatingsLoss = BasePenalty × (1 − stageProgress) × embarrassmentMod`; the episode's would-be RatingsGain doesn't bank; boss rewards forfeited. Early/embarrassing deaths hurt most.
- **Build persists** — weapons, items, levels, gold.

## Career loss

- **Cancelled = cumulative Ratings < 0**, any time (start at Nobody ≈ 0). Ends the career → results screen. No meta-progression between careers.

## Persistence (CLAUDE.md reload rule)

- Career state — build, gold, Ratings, Season, map position, deadline position — saved to the virtual FS at the **map level**. Reload mid-episode resumes the **pre-episode map state**.
- Pattern: stable `*_STATE_ID` + `SAVE.DAT` in both `seed.ts` and `migrate()`; validate shape/version; write at boundaries, not per frame. Finalize on Cancelled and Series Finale.
