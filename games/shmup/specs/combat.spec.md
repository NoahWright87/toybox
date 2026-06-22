# Shmup — Combat Spec (damage, defense, mobility)

> Issues: **F3 #131**, **F6 #134**. Status: formulas locked; constants TBD.

## Damage (per hit)

```
HIT = (Base + Flat) × DamageMult × CritFactor × ConditionalMult
```

- **Base** — weapon/enemy base damage. **Flat** — additive flat damage adds.
- **DamageMult** = `1 + Σ %damage` (one additive pool).
- **ConditionalMult** — each *conditional type* is its own multiplier; within a type bonuses add, across types they multiply. E.g. "+50% vs ground" and "+25% while grazing" → `×1.5 × ×1.25`. Two "+50% vs ground" items → `×2.0` (one category).

### Crits (the explosive axis)

```
NumCrits   = floor(CritChance) + (rand() < frac(CritChance) ? 1 : 0)
CritFactor = (1 + CritDamage) ^ NumCrits
```

Crit chance is **uncapped**: 100% = guaranteed; 250% = 2 guaranteed crits + 50% chance of a 3rd. With CritDamage 100% (×2/crit): 250% → ×4, half the time ×8.

For the debug/DPS overlay use the **expected** factor: `(1+CritDamage)^floor(C) × (1 + frac(C)·CritDamage)`.

### Throughput (NOT inside HIT)

Attack speed and projectile count scale *how often / how many*, applied outside the per-hit number:

```
DPS = HIT × ShotsPerSecond × ProjectileCount × AvgTargetsHit
```

`AvgTargetsHit` is driven by pierce/fork/chain (`weapons.spec.md`). Keeping these out of `HIT` prevents the wrong layers multiplying each other.

## Defense pipeline (incoming hit; no hull lives)

```
1. EVASION  chance = Evasion/(Evasion+Kₑ)  → dodged ⇒ 0 damage (base evasion 1%)
2. SHIELD   absorbs at FULL value, armor IGNORED:  shield −= HIT
3. OVERFLOW past shield continues ↓
4. ARMOR    mitigates overflow only:  toHP = overflow × (1 − Armor/(Armor+Kₐ))
5. HP       −= toHP   → HP ≤ 0 ends the episode (run-structure.spec.md)
```

- **Shield** = soft burst-soak (armor does nothing for it); auto-refills after `ShieldDelay` seconds without being hit, at `ShieldRegen`/sec. Taking a hit resets the delay timer.
- **HP** = armored core; no self-regen except the **HP Regen** stat (base 0).
- **Lifesteal** restores **HP only** (shields already self-heal).
- Armor & Evasion are hyperbolic (`x/(x+K)`) — stack infinitely, asymptote, never 100%.

## Mobility

- **Player Speed** — triple duty: (1) dodge & positioning; (2) **sets node scroll speed** → faster = denser waves = more loot/Hype per second; (3) buys margin against the airtime/escalation clock. Risk/reward: more throughput, less reaction time.
- **Reflexes** — one stat slowing the *enemy world*, two clamped channels:
  - enemy **bullets** floor at ~20% speed (generous — feeds grazing/Hype),
  - enemy **movement** floors ~50% (keep them threatening).
  Each hyperbolic toward its own cap.
- **Focus** — an action (hold), not a stat: base effect is slower movement for precision (Touhou-style). Weapons may define a focused-fire mode; chassis may add perks (hitbox shrink, etc.). See `chassis.spec.md`.
- **Projectile speed** — per-weapon authored property, not a player stat.
