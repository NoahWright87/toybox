# Shmup — Run Structure Spec (career, map, difficulty, death, persistence)

> Issues: **F8 #136** (map/seasons/difficulty), **F11 #139** (death/persistence). Status: framing locked. Numbers in `tuning.spec.md`.

## Career = Seasons

- A **career** = ~5 **Seasons** (tunable). Each Season is a node map (FTL/StS style) capped by a **Season Finale boss**. The last Season ends in the **Series Finale (final boss)**.
- Beat the Series Finale → record **Finale score** → optionally continue into **Syndication** (endless). Cancelled there → record **Syndication score**.
- **Season always advances** — even if you lose the Finale boss or blow the deadline. Losing just costs Ratings and forfeits boss gold/items.

## Difficulty (D) — the master escalation scalar

A single number drives all escalation. **Most enemy stats key off D**, but through **per-stat curves** (HP fast, damage slow, etc.) defined once in `tuning.spec.md` — one input, non-uniform response. Two cheap enrichments keep it from feeling flat:
- **Per-archetype emphasis:** each enemy type declares which stats it leans into as D rises (bruiser → HP/damage, swarmer → count/speed) — same D, in-character escalation.
- **Composition thresholds:** higher D unlocks more elites, denser formations, nastier patterns — qualitative, not just bigger numbers.

D also:
- **Scales rewards** (gold/EXP) — harder = richer. D is the universal *stakes* dial.
- **Gives a Luck-like rarity boost** to offers: `rarityLuck = Luck + luckFromD × D` (see `items-and-brands.spec.md`). Even a Luck-free build sees rarer gear the deeper it goes.
- Stays **independent of Ratings** (which gates *access*, not difficulty). Special nodes may carry a **negative D offset** (safer).

### Escalation formula

```
D = seasonBase(season)                 # persistent: each Season starts harder
  + episodeRamp × episodeIndex         # persistent: climbs through a Season
  + stageOffset + itemModifiers        # bonus-hard stages / risk items add flat D
  + deadlinePenalty × max(0, airtimeElapsed − deadline)   # the executive-punishment CLIFF
```

- **Deadline cliff:** each episode has a soft time budget. Under it, the airtime term is 0. **Cross it and D spikes and keeps accelerating** the longer you're over — "the executives make your life hell." Finish or bail.
- **Player Speed** earns its keep by keeping you ahead of the deadline.
- **Difficulty settings** (if any) just change `seasonBase` start + ramp slopes — one place.
- Optional visible **"Threat Level"** readout surfaces D thematically.

## Node map

- Choose among nearby nodes; full info on adjacent, partial further out (radar item reveals more).
- **Ratings unlocks MORE node options**, skewed toward **special nodes** (shop/treasure/challenge/bonus). **Luck also biases special-node odds.** Neither changes D.
- Node types: standard combat, elite, shop, event, treasure, Season Finale boss.

## Death (no hull lives)

- **One death = the episode ends.** Returned to the Season map.
- `RatingsLoss = BasePenalty × (1 − stageProgress) × embarrassmentMod`; the episode's would-be RatingsGain doesn't bank; boss gold/items forfeited. Early/embarrassing deaths hurt most.
- **Build persists** — weapons, items, levels, gold.

## Career loss

- **Cancelled = cumulative Ratings < 0**, any time (start at Nobody ≈ 0). Ends the career → results screen. No meta-progression between careers.

## Persistence (CLAUDE.md reload rule)

- Career state — build, gold, Ratings, Season, map position — saved to the virtual FS at the **map level** (between episodes). Reload mid-episode resumes the **pre-episode map state**.
- Pattern: stable `*_STATE_ID` + `SAVE.DAT` in both `seed.ts` and `migrate()`; validate shape/version; write at boundaries, not per frame. Finalize on Cancelled and Series Finale.
