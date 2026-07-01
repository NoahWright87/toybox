# Shmup — Economy Spec

> Issue: **F9 #137**. Status: implemented. Code lives in
> `games/shmup/src/systems/economy/`, integrated into
> `games/shmup/src/scenes/{PlayScene,ResolveScene,LevelUpScene,ShopScene}.ts`.
> Numbers are placeholders for the balance pass — see `tuning.spec.todo.md`
> (`TUNING.economy`/`TUNING.offers`). Remaining follow-on work is tracked in
> `economy.spec.todo.md`.

## The hard rule: level-ups never interrupt play

`systems/economy/exp.ts`'s `applyExpGain(progress, gained)` is pure curve
math — EXP accrues every kill (`PlayScene.gainExp()`, no collection step)
and rolls over as many level-ups as the gain covers, but nothing about a
level-up is resolved there. `ResolveScene` is the only place the rollover
actually happens: it calls `applyExpGain` once, at episode end, then hands
the resulting `levelsGained` to `LevelUpScene` via `routeAfterResolve()`.
`LevelUpScene` resolves picks **one at a time, in sequence** — `scene.restart()`
re-enters with `picksRemaining` decremented — so N levels gained mid-episode
means N sequential picks at the break, never a queue drained mid-play.

Each pick offers `TUNING.economy.levelUpOfferCount` (4) MAIN stats only
(`systems/economy/levelUpStats.ts`'s `rollLevelUpOffers()`, uniform random —
no Luck/Ratings/brand weighting, that's the item/weapon offer system below)
with reroll. A pick grants a flat `StatModifier` sized by
`TUNING.economy.mainStatPickAmount[stat]`; `CareerState.statPicks` tracks a
running count per stat, and `statPickMods()` flattens that into the
persistent mods every `resolveLoadout()` call folds in alongside weapons/items.

## Three currencies, three time-horizons

| Resource | Horizon | Nature | Code |
|---|---|---|---|
| **EXP → Levels** | permanent | earned automatically; the build skeleton | `systems/economy/exp.ts` |
| **Gold → Shop** | permanent, bankable | earns interest; deliberate power | `systems/economy/gold.ts` |
| **Hype → Ratings** | ephemeral → career | performance | `hype-and-ratings.spec.md` |

`CareerState` (`systems/career/types.ts`) persists `level`/`exp`/`gold`/
`items`/`statPicks` exactly like it already persisted `weapons` — appended
to at `ResolveScene`/`LevelUpScene`/`ShopScene`, never mid-episode
(`PlayScene` only ever computes `goldCollected`/`expGained` deltas and hands
them off, same discipline as its Ratings delta).

## Gold — physical, skill-gated

`PlayScene.damageEnemy()` spawns a pooled `Coin` (`entities/Coin.ts`) at every
kill, worth `TUNING.economy.coinValueBase * rewardCurve(D)` (the same
"harder = richer" curve difficulty already exposed). A coin isn't an inert
drop — it **pops** (Twin Bee bell-style): `Coin.spawn()` gives it always-up
velocity plus random horizontal velocity (equally likely left/right,
`coinPopSpeedYMin/Max`/`coinPopSpeedXMax`), then `coinGravity` arcs it back
down via Arcade Physics gravity. `Coin.bounceOffSideWalls()` (a manual check
in `preUpdate`, not Arcade's `setCollideWorldBounds` — that flag is
all-or-nothing across every edge and gated by a World-level setting shared
with the player's own on-screen containment, so it can't be limited to just
two sides for one body) reflects it off the left/right edges of the play
area so it's never lost off the sides, while the top and bottom are left
completely unconstrained: it's free to sail above the top of the play area
on the way up, and falling off the bottom (`preUpdate`'s existing
`y > GAME_HEIGHT + 32` check) is a real, permanent loss — this arc-and-bounce
is what makes catching a coin a positioning/timing skill rather than a
guaranteed pickup, per the design intent.
`PlayScene.updateCoins()` runs every frame: a coin within the player's
**Magnet Radius** stat locks on (`Coin.startHoming()` hands off from the
pop/gravity/bounce arc to direct-position homing at `coinMagnetSpeed`,
mid-arc if the player gets there first) and flies straight at them; within
`coinCollectRadius` it's caught, banked via `coinValue(base, creditScore)`
(`systems/economy/gold.ts` — Credit Score boosts fresh gold gain); otherwise
it despawns after `coinLifespanSec` unclaimed. "At high Hype the crowd tips"
is `rollsTip(hypeFrac)` — above `tipsHypeThreshold`, a kill has a
`tipsChance` shot at also throwing a bonus coin (`tipsValueMult`x) onto the
field. Gold caught up to a death still banks (`ResolveScene` adds
`goldCollected` to `career.gold` regardless of clear/death, same as the
build persisting through a loss).

### Interest

`ShopScene.create()` applies interest **exactly once per shop visit**, the
moment the shop opens — `interestEarned(bankedGold, creditScore)`
(`systems/economy/gold.ts`), rate scaled by Credit Score, cap
(`TUNING.economy.goldCap`) set absurdly high per spec so it's effectively
off. Every other in-shop mutation (buy/upgrade/reroll) re-renders in place
rather than restarting the scene, so interest is never double-applied within
one visit.

## Shop — two cadences, one engine

`ShopScene` (`scenes/ShopScene.ts`) serves both cadences the spec calls for,
differing only in slot count (`TUNING.economy.shopBaselineSlots` vs
`shopNodeSlots`) and context:

- **Baseline**: `ResolveScene.routeAfterResolve()` sends every combat episode
  (`outcome !== "special"`) here after any level-ups resolve — the small
  shop shown at every inter-level break.
- **Node**: a `shop`-type map node (`MapScene`/`ResolveScene`'s `outcome:
  "special"` path) launches the bigger dedicated-node variant instead.

Stock is `systems/economy/shop.ts`'s `generateShopStock()`: weapons
(`content/weapons.ts`'s `ALL_WEAPONS`) and passive items
(`content/items.ts`'s `ALL_ITEMS`) drawn through the same offer-weighting
engine as level-ups' stat picks are *not* — see below. Weapon offers vanish
entirely once all `MAX_WEAPON_SLOTS` (6) are filled; an item at its
`maxStacks` cap stops being offered. `ShopScene` also renders a **"YOUR
WEAPONS"** section — click-to-upgrade any owned weapon at
`weaponUpgradeCost(tier, brandCount)` (`weapons.spec.todo.md`'s exponential
curve, already implemented by F4).

### Rerolls

`systems/economy/rerolls.ts`: `nextRerollCost(rerollsUsedThisVisit,
ratingsRank)` costs `rerollCost(paidIndex)` (an increasing curve) once the
free allowance for the player's current Ratings tier
(`TUNING.economy.freeRerollsByRatingsRank`) is used up. Both `LevelUpScene`
(per pick) and `ShopScene` (per visit) track their own reroll counter and
spend gold identically — Hype is never spent as currency, per spec.

## Offer weighting — Luck × Ratings × brand affinity

`systems/economy/offers.ts` implements the three-stage weighted draw from
`items-and-brands.spec.todo.md`, consumed by `shop.ts`'s
`generateShopStock()` (level-up picks don't use this — they're uniform, see
above):

```
Stage 1 (Ratings/sponsor): tierRankRange(ratingsRank) -> {min, max} tier ceiling/floor
                            (TUNING.offers.maxTierRankByRatingsRank / minTierRankByRatingsRank)
Stage 2 (Luck + Difficulty): rollTier(rarityLuck, ratingsRank) weighted by
                            baseWeight_tier * (1 + rarityLuck)^tierRank
Stage 3 (brand affinity): pickItemInTier() weighted by
                            baseItemWeight * min(cap, 1 + kBrand * ownedCount(brand))
```

`generateOffers()` draws N slots without replacement, falling back to the
nearest non-dry tier if a roll lands on one with no stock. Item/weapon
rarity tiers (`systems/economy/rarity.ts`'s `RarityId`: common/uncommon/
rare/epic) are optional on `WeaponDef`/`ItemDef` (default common) so
pre-F9 fixtures didn't need updating. `ownedBrandCounts()`
(`systems/economy/shop.ts`) counts distinct owned weapon slots + item stack
counts per brand — "not upgrade tiers," per spec.

## Related

- [`items-and-brands.spec.todo.md`](items-and-brands.spec.todo.md) — the
  offer-weighting math this spec implements, and the item/brand catalog
  (still growing, C3 #142/C4 #143)
- [`stats.spec.md`](stats.spec.md) — the 16 MAIN stats level-ups draw from
- [`weapons.spec.todo.md`](weapons.spec.todo.md) — the weapon-upgrade cost
  curve `ShopScene`'s "YOUR WEAPONS" section spends gold against
- [`hype-and-ratings.spec.md`](hype-and-ratings.spec.md) — Ratings tier rank,
  which gates both the offer-weighting ceiling and free rerolls
- [`run-structure.spec.md`](run-structure.spec.md) — the episode flow this
  spec now extends: `Map -> Play -> Resolve -> [LevelUp] -> Shop -> Map`
- [`tuning.spec.todo.md`](tuning.spec.todo.md) — every numeric constant
  referenced here (`TUNING.economy`, `TUNING.offers`)
- [`economy.spec.todo.md`](economy.spec.todo.md) — remaining follow-on work
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
