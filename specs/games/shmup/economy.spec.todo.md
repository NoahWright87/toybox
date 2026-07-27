# Shmup — Economy Spec (remaining work)

> Issue: **F9 #137** — implemented, see `economy.spec.md`. This file now
> only tracks what's left.

## Balance pass

All numbers in `TUNING.economy`/`TUNING.offers` (curve growth rates, coin
values, reroll costs, tier weights, mainStatPickAmount per stat) are
placeholders pending the real balance pass — shape is locked, values aren't.

## Content growth

- The weapon roster (`content/weapons.ts`) is a minimal 3-weapon starter set
  — C1 #140 owns growing it into the real base-weapon roster.
- The item catalog (`content/items.ts`) is a 15-item starter set spanning
  both brands + unbranded, across all four tiers — C3 #142/C4 #143 own
  growing it (including the "while grazing" conditional items
  `items-and-brands.spec.todo.md` describes, which need the transient-mod
  layer wired up, not just the persistent one `statPickMods()`/item mods use).

## Shop UI polish

- `ShopScene`'s "YOUR WEAPONS" + "STOCK" sections are a fixed vertical list,
  sized to just clear the footer at the current maximum (6 weapons + a
  5-slot node shop) — no scrolling. Growing `MAX_WEAPON_SLOTS`,
  `shopNodeSlots`, or the row content (e.g. showing full stat previews
  instead of just the pick amount) will need real scrolling.
- Weapon "buy" offers always add a brand-new slot instance rather than
  offering to upgrade an already-owned copy in place — intentional per spec
  ("you may buy the same weapon into two slots for redundancy"), but a
  future pass could let the shop suggest upgrading an existing slot instead
  when a rolled weapon is already owned.

## Risk items / D tie-in

- `generateShopStock`'s offer context always passes `D: 0` for shop
  visits (Difficulty isn't meaningful outside an episode) — `rarityLuck`
  there is Luck-only. A future risk-item mechanic
  (`run-structure.spec.todo.md`'s `itemModifiers` in the D formula) could
  reintroduce a D term once such items exist.
