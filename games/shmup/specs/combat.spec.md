# Shmup — Combat Spec (damage, defense, mobility)

> Issues: **F3 #131**, **F6 #134**. Status: formulas locked; constants TBD (`tuning.spec.md`).

## Damage (per hit)

```
HIT = (Base + Flat) × DamageMult × CritFactor × ConditionalMult
```

- **Base** — weapon/enemy base damage. **Flat** — additive flat damage adds.
- **DamageMult** = `1 + Σ %damage` (one additive pool).
- **ConditionalMult** — each *conditional type* is its own multiplier; within a type bonuses add, across types they multiply. "+50% vs ground" & "+25% while grazing" → `×1.5 × ×1.25`. Two "+50% vs ground" → `×2.0` (one category).

### Crits (the explosive axis)

```
NumCrits   = floor(CritChance) + (rand() < frac(CritChance) ? 1 : 0)
CritFactor = (1 + CritDamage) ^ NumCrits
```

Crit chance is **uncapped**: 100% guaranteed; 250% = 2 guaranteed + 50% chance of a 3rd. With CritDamage 100% (×2/crit): 250% → ×4, half the time ×8. Overlay uses the expected factor `(1+CritDamage)^floor(C) × (1 + frac(C)·CritDamage)`.

### Throughput (NOT inside HIT)

```
DPS = HIT × ShotsPerSecond × ProjectileCount × AvgTargetsHit
```

Attack speed & projectile count scale *how often / how many*; `AvgTargetsHit` is driven by pierce/fork/chain (`weapons.spec.md`). Kept outside `HIT` to stop the wrong layers multiplying.

## Defense pipeline (incoming hit; no hull lives)

```
1. EVASION  chance = Evasion/(Evasion+Kₑ)  → dodged ⇒ 0 damage (base evasion 1%)
2. SHIELD   absorbs at FULL value, armor IGNORED:  shield −= HIT
3. OVERFLOW past shield continues ↓
4. ARMOR    mitigates overflow only:  toHP = overflow × (1 − Armor/(Armor+Kₐ))
5. HP       −= toHP   → HP ≤ 0 ends the episode (run-structure.spec.md)
```

- **Shield** = soft burst-soak (armor ignored); auto-refills after `ShieldDelay` s without a hit, at `ShieldRegen`/s. A hit resets the delay.
- **HP** = armored core; no self-regen except the **HP Regen** stat (base 0).
- **Lifesteal** restores **HP only**.
- Armor & Evasion are hyperbolic (`x/(x+K)`) — stack infinitely, asymptote, never 100%.

## Mobility

> **The stage auto-scrolls** — episode length/pace is fixed. Player Speed never changes scroll or stage duration; it's pure in-screen movement.

- **Player Speed — two separate layers:**
  - **In-episode (movement):** dodging, aggressive positioning, **catching coins/tips** (economy is collection-based), and getting point-blank for high-multiplier grazes (Hype). Faster = you cover more of the screen.
  - **Overworld (deadline slack):** slows the rate the between-episode **deadline** advances across the map (`run-structure.spec.md`) — a meta-layer effect, totally separate from in-episode movement. More margin to take extra nodes before the executives' deadline catches you.
- **Reflexes** — one stat slowing the *enemy world*, two clamped channels: enemy **bullets** floor ~20% speed (feeds grazing/Hype), enemy **movement** floors ~50% (keep them threatening). Each hyperbolic toward its own cap.
- **Focus** — an action (hold), not a stat: base = slower movement for precision (Touhou-style). Weapons may add a focused-fire mode; chassis may add perks (`chassis.spec.md`).
- **Projectile speed** — per-weapon authored property, not a player stat.
