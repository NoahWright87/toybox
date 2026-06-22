# Shmup — Stats Spec

> Ground truth for all systems. Issue: **F3 #131**. Status: framing locked; constants TBD.

## The one composition grammar

Every derived value in the game is computed the same way:

```
value = (Base + Σ flat adds) × Π_categories (1 + Σ %bonuses in that category) × special(crit, DR)
```

- **Flat adds** pile onto the base.
- **Within a category**, percentages add (two "+50% vs ground" → +100% vs ground).
- **Across categories**, they multiply (`+50% vs ground × +25% grazing = ×1.5 × ×1.25`).

Every stat declares exactly one role: *flat add to X*, *% in category C of X*, or *hyperbolic*. The schema defines this grammar once; all content obeys it.

## Three stat archetypes

1. **Unbounded multiplicative** — damage, attack speed, max HP, graze multiplier, gold/EXP gain. Additive within, multiplies across. Infinite-in-spirit; balanced by exponential acquisition cost + escalation.
2. **Hyperbolic / soft-capped** — crit chance, evasion, armor, Reflexes channels. `effective = x / (x + K)`, approaches a cap, never reaches it. `K` per stat is the tuning knob.
3. **Additive flat, geometry-capped** — graze radius, hitbox size, magnet radius, player speed (capped by world/screen geometry).

## The 16 MAIN stats

Level-ups (`economy.spec.md`) only ever offer these:

> **Offense:** Damage, Attack Speed, Crit Chance, Crit Damage
> **Defense:** Max HP, Armor, Evasion, Max Shield, HP Regen, Lifesteal
> **Mobility:** Player Speed, Reflexes
> **Economy:** Luck, Credit Score, EXP Gain, Magnet Radius

**Exotic stats** — pierce %, bounce, fork, chain, blast radius, homing strength — never appear in level-ups. They come only from weapons/items/shop, keeping the level pick legible and exotic builds intentional.

## StatDef shape

```ts
StatDef = {
  id, archetype,            // 'unboundedMult' | 'hyperbolic' | 'flat'
  base, K?, min?, max?,     // K for hyperbolic; clamps for flat
  unit, display,            // formatter: %, ×, flat, px
}
```

Weapons/items declare `scalesWith: StatId[]` so the Brotato-style explicit display can show exactly what each thing keys off (no guessing).

## computeStats — two modifier layers

```ts
computeStats(base, persistentMods, transientMods)
```

- **Persistent** — items, chassis, level-up picks. Recomputed and **cached** only when something changes (pickup, upgrade).
- **Transient/conditional** — "while grazing" effects, polarity state, etc. Layered on top of the cache, toggled by condition flips.

The hot loop reads the cached effective stats; recompute happens on change, never per frame. Pure and deterministic (unit-tested). Pipeline order is fixed: **flat adds → sum additive % → multiply categories → hyperbolic transform → clamp.**

## Defaults / resolved decisions

- Base Crit Chance **1%**, base Crit Damage **50%**, base Evasion **1%**.
- Stacking model = the hybrid grammar above (resolved).
- Graze rings = fractions of the radius stat, separate multiplier stat, **innermost ring only** (see `hype-and-ratings.spec.md`).
- Projectile speed is **not** a player stat — it's a per-weapon authored property (`weapons.spec.md`).
