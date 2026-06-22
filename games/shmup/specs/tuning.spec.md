# Shmup — Tuning Spec ("tuning is an asset")

> The home of every numeric lever. Status: structure locked; values are placeholders for the balance pass.

## Principle

Exactly parallel to "copy is an asset": **all balance constants live in one typed tuning module**, separate from systems logic. Systems read values by key; nobody hard-codes a magic number. The balance pass (and Noah) tweak here without touching engines. A debug overlay (C12 #151) reads the same module so changes are observable.

This file enumerates the levers by group. Names are illustrative; the module is the source of truth.

## Stats / combat (`stats.spec.md`, `combat.spec.md`)
- Base values: `critChance=0.01`, `critDamage=0.50`, `evasion=0.01`.
- Hyperbolic constants: `armorK`, `evasionK`, `reflexBulletK`, `reflexMoveK`.
- Reflexes caps: `bulletSlowCap≈0.80`, `moveSlowCap≈0.50`.
- Soft caps / clamps for flat stats (hitbox floor, etc.).

## Hype & Ratings (`hype-and-ratings.spec.md`)
- Hype: `hypeBase`, `crowdSize→HypeMax` mapping, `k_idle`, `k_level`, `baseDecay`, `M` (ScoreMult depth).
- Graze rings: `[{frac,mult}]` table.
- Ratings: `CrowdConversion`, `BasePenalty`, `embarrassmentMod` table, tier thresholds (Nobody…Kevin Bacon), `Cancelled = Ratings < 0`.

## Economy (`economy.spec.md`)
- XP-per-level curve; level-up offer count (4); coin/tip values; Magnet catch radius mapping.
- Interest: base rate, Credit-Score scaling, cap (set huge).
- Reroll cost curve; free-reroll allowance by Ratings tier.

## Offers (`items-and-brands.spec.md`)
- Tier `baseWeight` table; Luck skew form `(1+Luck)^rank`.
- `k_brand`, brand affinity cap (≈5×).
- `Ratings → maxTier / minTier` mapping; offer slot count `N`.

## Weapon upgrades (`weapons.spec.md`)
- Per-weapon `perLevel` bonus tables (fractional allowed).
- `costBase`, `costGrowth`; brand discount `d`, discount cap `0.40`.

## Passives (`items-and-brands.spec.md`)
- Per-item `maxStacks`.

## Run structure / escalation (`run-structure.spec.md`)
- Season count (≈5); per-Season difficulty slope; airtime-clock duration & escalation rate.
- Node counts per Ratings tier; Luck → special-node bias.

> The **escalation curve** (per-Season difficulty + airtime clock) is the one formula still to be designed; its constants will land here.
