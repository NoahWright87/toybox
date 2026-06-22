# Shmup — Weapons Spec

> Issues: **F4 #132** (engine), **C1 #140** (base weapons), **C2 #141** (modifiers). Status: framing locked.

## Effect-composition engine

Weapons, attack modifiers, and items are **data** run through one generic engine — not bespoke per-item code. Adding content is a data change.

A **weapon** is data:
- a base type + base damage + **per-weapon projectile speed** (authored, see `combat.spec.md`),
- **firing arc** (forward / behind / sides — some exist to cover blind spots),
- **target type** (ground-only / air-only / both — gates which weapons matter),
- optional **focused-fire mode** (e.g. wide spray → concentrated stream when focusing),
- `scalesWith: StatId[]` for the explicit-stat display.

## Slots

**6 weapon slots per chassis** (bullet-heaven default + a hard performance ceiling that bounds worst-case concurrent projectiles even with stacked modifiers).

## Attack-behavior modifiers (freeform, generic)

Modifiers attach to *whatever is firing*, not to specific weapons — synergies emerge from the math, never from authored "weapon A + B = C" recipes.

- **Pierce** — expressed as **% retained damage** (e.g. 325% = full damage through 3 enemies, 25% to a 4th).
- **Bounce** — damage retained per bounce.
- **Fork / split** on impact.
- **Chain** to nearby enemies on hit.
- **Blast radius** on impact.

These compose: pierce + fork means every shot splits and each half keeps tunneling. They feed `AvgTargetsHit` in the DPS formula, not `HIT`.

## Upgrades

Weapons upgrade in tiers with **exponentially scaling cost** (the practical stand-in for "infinite"). Bought with gold in the shop (`economy.spec.md`).

## Acceptance reference

A new weapon or modifier is purely a data addition consumed by this engine; representative stacks (pierce+fork, chain+blast) are unit-tested for deterministic composition. Reads exclusively from the `stats.spec.md` schema.
