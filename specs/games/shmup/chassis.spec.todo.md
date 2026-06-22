# Shmup — Chassis Spec

> Issues: **F10 #138** (framework), **C7 #146** (Ikaruga), **C8 #147** (more chassis). Status: framing locked.

## Framework

A chassis is **data**, defining:
- weapon-slot config (default cap **6**),
- hitbox size (distinct from sprite size),
- stat weightings,
- 1–2 identity **quirks** that *reinterpret existing stats* (Brotato-character model), composed through the effect engine — **no bespoke per-chassis subsystems**.

Ship the **default chassis** in the framework issue; additional chassis are content.

## Focus (lives on the chassis)

Focus is an action, not a stat:
- **Base (universal):** hold to move slower for precise dodging. No automatic hitbox shrink.
- **Weapon-defined:** a weapon may switch to a focused-fire mode (wide → concentrated).
- **Chassis-defined perks:** hitbox shrink, a focus shield, etc. — identity, not a universal rule.

## Flagship example — Ikaruga polarity chassis

Instead of grazing, a **polarity switch**: same-color absorption feeds the **same underlying graze-multiplier stat**, repurposed as absorb-meter gain rate; current polarity gates which enemies take full damage. This must slot into the framework by **remapping an input onto an existing stat and gating damage by state** — validating that the framework needs no new subsystem for such a chassis.

## Variety axes for future chassis

Vary slot count, hitbox size, stat weighting, and quirks — the same way Brotato characters differ. All expressed as data through existing engines.
