# Shmup — Weapons Spec

> Issues: **F4 #132** (engine), **C1 #140** (base weapons), **C2 #141** (modifiers). Status: framing locked. All numbers live in the tuning module (`tuning.spec.todo.md`).

## Effect-composition engine

Weapons, attack modifiers, and items are **data** run through one generic engine — not bespoke per-item code. Adding content is a data change.

A **weapon** is data:
- a base type + base stat values + **per-weapon projectile speed** (authored, see `combat.spec.todo.md`),
- **firing arc** (forward / behind / sides — some exist to cover blind spots),
- **target type** (ground-only / air-only / both — gates which weapons matter),
- optional **focused-fire mode** (`WeaponDef.focusedMods` — implemented, `chassis.spec.md`, F10 #138: e.g. wide spray → concentrated stream when focusing),
- a **per-level bonus table** (see Upgrades),
- optional **`pierceDecay`** (see Pierce, below) — defaults to `TUNING.weapons.defaultPierceDecay` when omitted,
- `scalesWith: StatId[]` for the explicit-stat display.

## Slots

**6 weapon slots per chassis** (bullet-heaven default + a hard performance ceiling that bounds worst-case concurrent projectiles) — the cap itself is owned by the equipped chassis (`ChassisDef.maxWeaponSlots`, `chassis.spec.md`, F10 #138), 6 just being the framework's default. Each slot holds an **independent weapon instance with its own upgrade level** — you may buy the same weapon into two slots for redundancy *or* pour gold into one.

## Attack-behavior modifiers (freeform, generic)

Modifiers attach to *whatever is firing* — synergies emerge from the math, never from authored "weapon A + B = C" recipes.

- **Pierce** — one unified stat covering what used to be four separate ones (pierce/bounce/fork/chain). See below for its behavior at and above 100%.
- **Blast radius** — splash on impact, untouched by the Pierce consolidation; stacks with Pierce (a piercing shot with blast radius is a piercing AOE shot).

They feed `AvgTargetsHit` in the DPS formula, not `HIT`.

### Pierce — unified decay/fork model

A single stat replaces the old pierce/bounce/fork/chain quartet — they were behaviorally redundant (bounce and chain were both "a smarter pierce that aims," fork was "a pierce that splits") and the four-stat "aggregate expected damage" math was both unpredictable for players and impossible to balance. Pierce now means:

- **At or below 100%:** each impact multiplies the projectile's *current* damage by the pierce ratio; the line ends once its damage fraction drops below a floor (≈1%). E.g. 50% Pierce → `100, 50, 25, 12.5, 6.25, 3.125, ~1.6, 0`.
- **Above 100%:** the line itself never decays — it keeps piercing forever at full damage — and the 100%-overflow **forks** into a new projectile carrying `(pierce − 100%) × PierceDecay`. That forked projectile resolves the same rule recursively (bounded by a hard, gameplay-irrelevant safety cap) until what's left is ≤ 100%, which becomes the one decaying tail.
- **`PierceDecay`** is a **per-weapon authored field** (not a stat-pool modifier) — defaults to `TUNING.weapons.defaultPierceDecay` (50%) and is always clamped below `TUNING.weapons.maxPierceDecay` (95%) so forking can't run away regardless of how high Pierce is stacked. Low values (a slug-throwing weapon) discourage forking and stay single-target/controlled-AOE; high values (chain lightning, a flak cannon) lean hard into forking across a crowd.
- Forked projectiles get a new random heading and inherit the firing projectile's hit-list (already-hit enemies, so a fork can't re-hit the same target) — that's real-world targeting/collision bookkeeping, owned by combat (F6), not by this engine. This spec's engine (F4) only computes the pure damage-decay math: how many full-damage forked lines result, and what the one remaining line's hit-fraction sequence looks like.
- Crit is resolved **once per shot fired**, baked into the base `HIT` upstream (`combat.spec.todo.md`) — it is never re-rolled per pierce impact or per fork, which is what keeps "100% Pierce + 100% Crit" from runaway-escalating.

## Firing & targeting

- **Auto-fire is the default** (bullet-heaven — no fire button); weapons fire on their own cadence (attack speed). This keeps the player's job to *movement/positioning*, which suits both the grazing-centric design and mobile controls.
- **Smart targeting (planned):** a weapon should only fire when a valid target is within its **range and firing arc** (and lead/aim at the nearest valid enemy for arced/homing types) instead of spraying into empty space. Until that lands, the placeholder fires on a fixed cadence regardless of targets.

## Upgrades (gold-based, deterministic)

Click an owned weapon at any shop → spend gold → next tier. **No tier cap**; exponential cost is the practical ceiling.

```
# each weapon stat has a per-level increment; fractional amounts accumulate and round for effect/display
statValue(tier)  = base + perLevel × tier        # e.g. +0.5 projectiles/level → "+1" every other upgrade
cost(tier)       = costBase × costGrowth ^ tier × (1 − brandDiscount)
brandDiscount    = min(0.40, d × ownedCount(weapon.brand))   # brand commitment makes upgrades cheaper
```

No separate "milestone" mechanic — qualitative jumps (an extra projectile, etc.) emerge naturally from fractional per-level bonuses crossing an integer.

Passive items do **not** upgrade — they stack (`items-and-brands.spec.todo.md`).

## Acceptance reference

A new weapon or modifier is purely a data addition; representative stacks (pierce above/below 100%, pierce+blast) are unit-tested. Reads from the `stats.spec.md` schema; all constants from `tuning.spec.todo.md`.
