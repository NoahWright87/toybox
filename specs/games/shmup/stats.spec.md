# Shmup — Stats Spec

> Ground truth for all systems. Issue: **F3 #131**. Implemented in
> `games/shmup/src/systems/stats/`. Numeric constants are placeholders pending
> the balance pass — the schema and pipeline are locked.

## The one composition grammar

Every derived value in the game is computed the same way:

```
value = (Base + Σ flat adds) × Π_categories (1 + Σ %bonuses in that category) × special(crit, DR)
```

- **Flat adds** pile onto the base.
- **Within a category**, percentages add (two "+50% vs ground" → +100% vs ground).
- **Across categories**, they multiply (`+50% vs ground × +25% grazing = ×1.5 × ×1.25`).

Every stat declares exactly one role: *flat add to X*, *% in category C of X*, or *hyperbolic*. The schema defines this grammar once; all content obeys it. `special(crit, DR)` — the crit-count roll and the defense pipeline's evasion/shield/armor ordering — is applied downstream by combat (`combat.spec.todo.md`, F6 #134), not by `computeStats()` itself.

## Three stat archetypes

1. **Unbounded multiplicative** (`archetype: "unboundedMult"`) — damage, attack speed, max HP, gold/EXP gain, crit chance, crit damage, lifesteal, Reflexes, luck, credit score, and the pierce/homing exotics. Additive within a category, multiplies across categories. Infinite-in-spirit; balanced by exponential acquisition cost + escalation. Crit Chance is explicitly **uncapped** here (combat.spec.todo.md) — 250% is a valid effective value, not clamped to 100%.
2. **Hyperbolic / soft-capped** (`archetype: "hyperbolic"`) — evasion, armor. `effective = raw / (raw + K)`, approaches a cap, never reaches it. `K` per stat is the tuning knob (`TUNING.combat.evasionK` / `armorK`). Negative raw values floor to `0` before the transform.
3. **Additive flat, geometry-capped** (`archetype: "flat"`) — player speed, magnet radius, HP regen, max shield, and the blast-radius exotic. Optional `min`/`max` clamps; geometry caps (e.g. screen bounds) are enforced by the consuming scene, not asserted here unless a numeric cap is already known.

Reflexes is `unboundedMult` rather than `hyperbolic`: it's a single raw stat whose value feeds **two separate** hyperbolic channels (enemy bullet speed, enemy movement speed) with their own `K` and cap, applied downstream by combat (`TUNING.combat.reflexBulletK` / `reflexMoveK` / `reflexBulletSlowCap` / `reflexMoveSlowCap`). Combat reads the raw pre-transform value via `aggregateRaw("reflexes", ...)` rather than `computeStats()`'s output.

## The 16 MAIN stats

Level-ups (`economy.spec.todo.md`) only ever offer these (`MAIN_STAT_IDS` in `systems/stats/types.ts`):

> **Offense:** Damage, Attack Speed, Crit Chance, Crit Damage
> **Defense:** Max HP, Armor, Evasion, Max Shield, HP Regen, Lifesteal
> **Mobility:** Player Speed, Reflexes
> **Economy:** Luck, Credit Score, EXP Gain, Magnet Radius

**Exotic stats** (`EXOTIC_STAT_IDS`) — Pierce, Blast Radius, Homing Strength — never appear in level-ups. They come only from weapons/items/shop, keeping the level pick legible and exotic builds intentional. Pierce and Homing Strength are unbounded percentages; Blast Radius is a flat px value. Pierce used to be four separate stats (Pierce/Bounce/Fork/Chain) — they were behaviorally redundant, so they were consolidated into one unified Pierce stat with per-weapon `PierceDecay` driving the above-100% forking behavior (`weapons.spec.todo.md`).

Hype/graze-specific stats (graze radius, graze multiplier, hitbox size) are **not** part of this table yet — `hype-and-ratings.spec.todo.md` (F7 #135) adds them using the same `StatDef` shape when that system lands.

## StatDef shape

```ts
StatDef = {
  id, category,             // 'offense' | 'defense' | 'mobility' | 'economy' | 'exotic'
  archetype,                 // 'unboundedMult' | 'hyperbolic' | 'flat'
  base, K?, min?, max?,      // K required for hyperbolic; min/max are optional clamps
  unit, display,             // unit: 'percent' | 'multiplier' | 'flat' | 'px'; display: human label
}
```

`formatStatValue(def, value)` (`systems/stats/format.ts`) renders a value per its `unit` — the formatter referenced by the schema. Weapons/items declare their own `scalesWith: StatId[]` (using the `StatId` union exported here) so the Brotato-style explicit display can show exactly what each thing keys off — that field lives on weapon/item defs (`weapons.spec.todo.md`, F4 #132), not on `StatDef`.

## computeStats — two modifier layers

```ts
computeStats(base, persistentMods, transientMods): StatBlock
```

- `base` — optional per-stat overrides (e.g. a chassis with a different base Max HP); falls back to `StatDef.base` per stat.
- **Persistent** (`persistentMods`) — items, chassis, level-up picks. The caller recomputes and caches this only when something changes (pickup, upgrade).
- **Transient/conditional** (`transientMods`) — "while grazing" effects, polarity state, etc. Layered on top of the cache, toggled by condition flips.

Both layers are plain `StatModifier[]` (`{ kind: "flat", stat, amount }` or `{ kind: "percent", stat, category?, amount }`) — the persistent/transient distinction is a caching-cadence convention for the caller, not a difference in the math. The hot loop reads the cached effective stats; recompute happens on change, never per frame. Pure and deterministic (unit-tested in `computeStats.test.ts`). Pipeline order is fixed: **flat adds → sum additive % per category → multiply categories → archetype transform (hyperbolic, if applicable) → clamp.**

`aggregateRaw(statId, base, mods)` exposes the pre-archetype-transform value (steps 1–3) for systems that need the raw accumulated number rather than the fully-transformed stat — currently only Reflexes' two-channel application (see above).

## Defaults / resolved decisions

- Base Crit Chance **1%**, base Crit Damage **50%**, base Evasion **1%** (`TUNING.combat`).
- Stacking model = the hybrid grammar above (resolved).
- Graze rings = fractions of the radius stat, separate multiplier stat, **innermost ring only** (see `hype-and-ratings.spec.todo.md`) — not yet implemented; tracked there.
- Projectile speed is **not** a player stat — it's a per-weapon authored property (`weapons.spec.todo.md`).

## Related

- [`combat.spec.todo.md`](combat.spec.todo.md) — consumes these stats for the damage/defense/mobility pipeline (F6 #134)
- [`tuning.spec.todo.md`](tuning.spec.todo.md) — owns every numeric constant referenced here
- [`weapons.spec.todo.md`](weapons.spec.todo.md) — `scalesWith: StatId[]` on weapon/item defs (F4 #132)
- [`hype-and-ratings.spec.todo.md`](hype-and-ratings.spec.todo.md) — future graze-specific stats (F7 #135)
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
