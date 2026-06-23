# Shmup — Tuning Spec ("tuning is an asset")

> The home of every numeric lever. Status: structure locked; values are placeholders for the balance pass.

## Principle

Parallel to "copy is an asset": **all balance constants live in one typed tuning module**, separate from systems logic. Systems read values by key; nobody hard-codes a magic number. The balance pass (and Noah) tweak here without touching engines. The debug overlay (C12 #151) reads the same module so changes are observable.

This file enumerates levers by group; the module is the source of truth.

## Stats / combat (`stats.spec.md`, `combat.spec.todo.md`)
- Base values: `critChance=0.01`, `critDamage=0.50`, `evasion=0.01`.
- Hyperbolic constants: `armorK`, `evasionK`, `reflexBulletK`, `reflexMoveK`.
- Reflexes caps: `bulletSlowCap≈0.80`, `moveSlowCap≈0.50`.
- Flat-stat clamps (hitbox floor, etc.).

## Hype & Ratings (`hype-and-ratings.spec.todo.md`)
- Hype: `hypeBase`, `crowdSize→HypeMax` mapping, `k_idle`, `k_level`, `baseDecay`, `M` (ScoreMult depth).
- Graze rings: `[{frac,mult}]` table.
- Ratings: `CrowdConversion`, `BasePenalty`, `embarrassmentMod` table, tier thresholds, `Cancelled = Ratings < 0`.

## Economy (`economy.spec.todo.md`)
- XP-per-level curve; level-up offer count (4); coin/tip values; Magnet catch-radius mapping.
- Interest: base rate, Credit-Score scaling, cap (set huge).
- Reroll cost curve; free-reroll allowance by Ratings tier.

## Offers (`items-and-brands.spec.todo.md`)
- Tier `baseWeight` table; rarity skew `(1 + rarityLuck)^rank`, `rarityLuck = Luck + luckFromD × D`.
- `luckFromD`; `k_brand`; brand affinity cap (≈5×).
- `Ratings → maxTier / minTier` mapping; offer slot count `N`.

## Weapon upgrades (`weapons.spec.todo.md`)
- Per-weapon `perLevel` bonus tables (fractional allowed).
- `costBase`, `costGrowth`; brand discount `d`, discount cap `0.40`.

## Passives (`items-and-brands.spec.todo.md`)
- Per-item `maxStacks`.

## Difficulty & escalation (`run-structure.spec.todo.md`)
- `seasonBase(season)` table; `episodeRamp`; `stageOffset` per stage type; risk-item D modifiers.
- **Overworld deadline:** `deadlineAdvancePerNode` (how fast the marker creeps), `playerSpeed → deadlineSlack` mapping (Player Speed slows it), `deadlinePenalty` (D per unit of `mapLag`).
- **Per-stat curves:** `hpCurve(D)`, `dmgCurve(D)`, `densityCurve(D)`, speed/fire-rate/bullet-count curves.
- **Per-archetype emphasis** weights.
- **Composition thresholds:** D values that unlock elites / formations / patterns.
- **Reward scaling:** gold/EXP multiplier vs D.
- Season count (≈5). Difficulty settings: starting `seasonBase` + ramp-slope presets.

## Map (`run-structure.spec.todo.md`)
- Node counts per Ratings tier; Luck → special-node bias; special-node negative D offset.
