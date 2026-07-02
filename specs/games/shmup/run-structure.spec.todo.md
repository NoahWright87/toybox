# Shmup — Run Structure Spec (remaining work)

> Issues: **F8 #136** (map/seasons/difficulty — implemented, see
> `run-structure.spec.md`), **F11 #139** (death/persistence polish). This
> file now only tracks what's left.

## F11 — death/audience polish

- Richer Cancelled/results screen: real audience reaction copy
  (`content/crowdComments.ts`'s `pickCrowdComment`) tagged to the death
  moment, not just the flat `cancelled.flavor` line.
- A real player-profile/name system — `ResolveScene`/copy currently hardcode
  `"Pilot"` for the `{playerName}` token.
- Score/results history — `finaleScore`/`syndicationScore` are shown once at
  the moment they're recorded but not kept anywhere after the career resets;
  a hall-of-fame / high-score list is `audience-and-score.spec.todo.md`'s job
  (T10 #161, C14 #163).

## Map — radar item and fog

- A **radar item** should reveal `"partial"`/`"hidden"` nodes further out
  (`systems/map/visibility.ts`'s `nodeVisibility` BFS depth cap) — not
  wired up; items-and-brands.spec.todo.md (F9 #137) owns the item itself.

## Special nodes need real mechanics

- **Shop**: now launches the dedicated-node `ShopScene` (`economy.spec.md`,
  F9 #137) after its (still flat, still 0) Ratings bonus resolves — real
  gold-sink shopping, no longer flavor-only.
- **Event**: currently a flat Ratings nudge — could branch into real
  choices/outcomes once there's content to hang them on.
- **Treasure**: currently a flat Ratings nudge — should hand out real
  items/gold directly (rather than requiring a shop stop) now that F9's
  gold/item plumbing exists.

## Difficulty — composition depth

- C5 #144 (batch 1) added `swarmer`/`turret` alongside `drone`/`elite`/`boss`,
  each with its own movement/fire pattern and a ground/air `domain` tag
  (`run-structure.spec.md`'s archetype table) — elite fires aimed shots
  distinct from drone's straight-down volleys, and the swarmer's "more of
  them" lean is partly expressed as motion (`sine` weave), but **simultaneous
  multi-spawns** ("denser formations" beyond spawn-interval density,
  `densityCurve`) are still unexplored — a future batch's job.
- `itemModifiers` in the D formula is plumbed through
  (`DifficultyContext.itemModifiers`) but nothing ever sets it — risk items
  are items-and-brands.spec.todo.md's job.
- Ground vs. air levels (`run-structure.spec.md`'s new section) are a flat
  per-episode coin flip today — tying the roll to node/map content instead
  is future work.

## Build persistence beyond the stub

- `CareerState.weapons`/`items`/`statPicks`/`gold` now grow via the shop and
  level-up breaks (F9 #137, `economy.spec.md`) — what's left is content
  depth, not plumbing: C1 #140 (base weapon roster) and C3 #142/C4 #143
  (item catalog) grow what there is to buy.
