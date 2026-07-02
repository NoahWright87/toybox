# Shmup — Chassis TODO

> Issues: **F10 #138** (framework — implemented, see `chassis.spec.md`),
> **C7 #146** (Ikaruga), **C8 #147** (more chassis). Status: framework
> shipped; content is Epic 2.

## Remaining work (Epic 2 content)

- **C7 #146 — Ikaruga polarity chassis.** `chassis.spec.md`'s "Validating
  extensibility" section already confirms the framework needs no new
  subsystem: a polarity input remaps onto the shared `grazeMultiplier` stat,
  current polarity gates damage via a toggled `transientMods` set (recomputed
  on flip, same pattern as `Player.setFocus()`). Building it is sprite +
  input mapping + the actual numbers, not new engine code.
- **C8 #147 — more chassis.** Vary slot count, hitbox size, stat weighting,
  and quirks — the same way Brotato characters differ. All expressed as
  `ChassisDef` data through the existing engines; no new fields expected to
  be needed based on C7's validation above, but revisit if a future chassis
  idea genuinely can't be expressed with the current shape.
- **Chassis selection.** `Player` always flies `DEFAULT_CHASSIS` today
  (`chassis.spec.md`). Once a second chassis exists (C7), `CareerState` needs
  a persisted chassis choice (a `chassisId` field, same id-indirection
  convention as `OwnedWeaponRef`/`OwnedItemRef`) and a selection UI —
  intentionally deferred until there's more than one option to choose from.
- **At least one weapon should actually declare `focusedMods`** once C1/C2
  grow the weapon roster, so the focused-fire variant described in
  `chassis.spec.md` is player-visible rather than only unit-tested.

## Related

- [`chassis.spec.md`](chassis.spec.md) — the shipped framework + default
  chassis this TODO extends
- [`weapons.spec.todo.md`](weapons.spec.todo.md) — weapon roster growth (C1
  #140, C2 #141) that Focus-mode weapon variety depends on
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
