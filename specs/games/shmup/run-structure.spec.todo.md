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

- **Shop**: currently a flavor-only stop (`TUNING.map.shopRatingsBonus = 0`)
  — needs the gold-sink economy (`economy.spec.todo.md`, F9 #137) before it
  can sell anything.
- **Event**: currently a flat Ratings nudge — could branch into real
  choices/outcomes once there's content to hang them on.
- **Treasure**: currently a flat Ratings nudge — should hand out real
  items/gold once F4/F9 exist.

## Difficulty — composition depth

- Only two enemy archetypes exist (`drone`, `elite`) plus a single boss
  config — "denser formations, nastier patterns" beyond spawn-interval
  density (`densityCurve`) is unexplored: multi-enemy formations, elite
  attack patterns distinct from drone's, additional archetypes leaning into
  speed/count (the swarmer's actual "more of them" lean, today only
  expressed via spawn density, not e.g. simultaneous multi-spawns).
- `itemModifiers` in the D formula is plumbed through
  (`DifficultyContext.itemModifiers`) but nothing ever sets it — risk items
  are items-and-brands.spec.todo.md's job.

## Build persistence beyond the stub

- `CareerState.weapons` persists across episodes but there's no way to grow
  it yet (no shop, no level-up offers, no gold) — C1 #140 (base weapon
  roster) and F9 (economy) unblock this.
