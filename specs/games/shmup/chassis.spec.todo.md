# Shmup — Chassis TODO

> Issues: **F10 #138** (framework, implemented), **C7 #146** (Ikaruga,
> implemented — see `chassis.spec.md`), **C8 #147** (more chassis). Status:
> framework + flagship shipped; further chassis content is Epic 2.

## Remaining work (Epic 2 content)

- **C8 #147 — more chassis.** Vary slot count, hitbox size, stat weighting,
  and quirks — the same way Brotato characters differ. All expressed as
  `ChassisDef` data through the existing engines; Ikaruga's `polarity` hook
  proved the framework can carry a full offense/defense mechanic with zero
  engine changes, so expect future chassis ideas to fit the same shape.
  Revisit only if a genuinely new idea can't be expressed with the current
  `ChassisDef`/`ChassisPolarityDef` fields.
- **At least one weapon should actually declare `focusedMods`** once C1/C2
  grow the weapon roster, so the focused-fire variant described in
  `chassis.spec.md` is player-visible rather than only unit-tested.
- **Ikaruga polish** (not required by C7's acceptance criteria, but natural
  follow-ups): a mobile-friendly polarity-switch control (currently keyboard
  `X` only, same gap as Focus's own "mobile Focus is TBD" note); a HUD
  indicator for current polarity beyond the ship/bullet tint; enemy-type
  variety in how polarity is assigned (currently uniform random 50/50 per
  spawn) once real enemy archetypes beyond drone/elite/boss exist.

## Related

- [`chassis.spec.md`](chassis.spec.md) — the shipped framework, default
  chassis, and Ikaruga polarity chassis this TODO extends
- [`weapons.spec.todo.md`](weapons.spec.todo.md) — weapon roster growth (C1
  #140, C2 #141) that Focus-mode weapon variety depends on
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
