# Shmup — Weapons Spec

> Issues: **F4 #132** (engine), **C1 #140** (base weapons), **C2 #141** (modifiers). Status: framing locked. All numbers live in the tuning module (`tuning.spec.md`).

## Effect-composition engine

Weapons, attack modifiers, and items are **data** run through one generic engine — not bespoke per-item code. Adding content is a data change.

A **weapon** is data:
- a base type + base stat values + **per-weapon projectile speed** (authored, see `combat.spec.md`),
- **firing arc** (forward / behind / sides — some exist to cover blind spots),
- **target type** (ground-only / air-only / both — gates which weapons matter),
- optional **focused-fire mode** (e.g. wide spray → concentrated stream when focusing),
- a **per-level bonus table** (see Upgrades),
- `scalesWith: StatId[]` for the explicit-stat display.

## Slots

**6 weapon slots per chassis** (bullet-heaven default + a hard performance ceiling that bounds worst-case concurrent projectiles). Each slot holds an **independent weapon instance with its own upgrade level** — you may buy the same weapon into two slots for redundancy *or* pour gold into one.

## Attack-behavior modifiers (freeform, generic)

Modifiers attach to *whatever is firing* — synergies emerge from the math, never from authored "weapon A + B = C" recipes.

- **Pierce** — % retained damage (325% = full damage through 3 enemies, 25% to a 4th).
- **Bounce** — damage retained per bounce.
- **Fork / split** on impact.
- **Chain** to nearby enemies.
- **Blast radius** on impact.

They compose (pierce + fork → every shot splits and each half tunnels) and feed `AvgTargetsHit` in the DPS formula, not `HIT`.

## Upgrades (gold-based, deterministic)

Click an owned weapon at any shop → spend gold → next tier. **No tier cap**; exponential cost is the practical ceiling.

```
# each weapon stat has a per-level increment; fractional amounts accumulate and round for effect/display
statValue(tier)  = base + perLevel × tier        # e.g. +0.5 projectiles/level → "+1" every other upgrade
cost(tier)       = costBase × costGrowth ^ tier × (1 − brandDiscount)
brandDiscount    = min(0.40, d × ownedCount(weapon.brand))   # brand commitment makes upgrades cheaper
```

No separate "milestone" mechanic — qualitative jumps (an extra projectile, etc.) emerge naturally from fractional per-level bonuses crossing an integer.

Passive items do **not** upgrade — they stack (`items-and-brands.spec.md`).

## Acceptance reference

A new weapon or modifier is purely a data addition; representative stacks (pierce+fork, chain+blast) are unit-tested. Reads from the `stats.spec.md` schema; all constants from `tuning.spec.md`.
