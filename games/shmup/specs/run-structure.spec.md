# Shmup — Run Structure Spec (career, map, death, persistence)

> Issues: **F8 #136** (map/seasons), **F11 #139** (death/persistence). Status: framing locked.

## Career = Seasons

- A **career** = ~5 **Seasons** (tunable). Each Season is a node map (FTL/StS style) capped by a **Season Finale boss**. The last Season ends in the **Series Finale (final boss)**.
- Beat the Series Finale → record **Finale score** → optionally continue into **Syndication** (endless, escalating). Get Cancelled there → record **Syndication score**.
- **Season always advances** — even if you lose the Finale boss or run out of **airtime**. Losing/timing-out just costs Ratings and forfeits boss gold/items.
- **Standard-node difficulty climbs every Season regardless of Ratings.** Falling behind on bosses → can't keep up → Cancelled.

## Node map

- Choose among nearby nodes; full info on adjacent, partial further out (a radar item reveals more).
- **Ratings unlocks MORE node options**, skewed toward **special nodes** (shop / treasure / challenge / bonus — safer/weirder/more rewarding). **Luck also biases special-node odds.** Neither changes standard-node difficulty.
- Node types: standard combat, elite, shop, event (text risk/reward), treasure, Season Finale boss.

## The airtime / escalation clock

The FTL-style encroaching danger is the **broadcast clock**: episodes/bosses carry time pressure ("we're running out of airtime"); producers escalate the longer you linger. **Player Speed** buys margin against it (`combat.spec.md`).

## Death (no hull lives)

- **One death = the episode ends.** Returned to the Season map.
- `RatingsLoss = BasePenalty × (1 − stageProgress) × embarrassmentMod`; plus the episode's would-be RatingsGain doesn't bank, and boss gold/items are forfeited. Early/embarrassing deaths hurt most.
- **Build persists** — weapons, items, levels, gold. The gut-punch is lost rewards + Ratings, not a reset.

## Career loss

- **Cancelled = cumulative Ratings < 0**, any time (you start at Nobody ≈ 0). Ends the career → results screen (`audience-and-score.spec.md`). No meta-progression between careers.

## Persistence (CLAUDE.md reload rule)

- Career state — build, gold, Ratings, current Season, map position — saved to the virtual FS at the **map level** (between episodes). Reload mid-episode resumes at the **pre-episode map state** (death sends you there anyway).
- Pattern: stable `*_STATE_ID` + `SAVE.DAT` in both `seed.ts` and `migrate()`; validate shape/version; write at map/episode boundaries, not per frame. Finalize on Cancelled and on Series Finale completion.
