# Shmup — Chassis Spec

> Issue: **F10 #138**. Status: implemented (framework + default chassis).
> Code lives in `games/shmup/src/systems/chassis/` (the `ChassisDef` shape)
> and `games/shmup/src/content/chassis.ts` (the registry — `DEFAULT_CHASSIS`,
> `chassisById()`). Additional chassis (Ikaruga polarity, etc.) are Epic 2
> content — see `chassis.spec.todo.md`.

## A chassis is data, applied through existing engines

`ChassisDef` (`systems/chassis/types.ts`) declares:

- **`maxWeaponSlots`** — weapon-slot cap (bullet-heaven default **6**,
  `TUNING.weapons.maxWeaponSlots`). Enforced by `resolveLoadout()`'s
  `assertWeaponSlots(weapons, maxSlots)` — the chassis's own cap flows in via
  `LoadoutInput.maxWeaponSlots`, falling back to the framework's
  `MAX_WEAPON_SLOTS` constant (`systems/effects/slots.ts`) when omitted.
- **`hitboxRadiusNormal`** — collision hitbox radius while not focusing,
  distinct from sprite size (a chassis can look big but hit small, or vice
  versa).
- **`statBase`** / **`mods`** — stat weightings and identity quirks. These
  are exactly `LoadoutInput.chassisBase` / `chassisMods`
  (`systems/effects/loadout.ts`) — fields that already existed on the F4
  engine before this issue landed. A chassis is proof that engine needed no
  changes to express: `statBase` overrides a stat's base value (e.g. a
  tankier frame raising base Max HP), `mods` are 1-2 persistent
  `StatModifier`s reinterpreting the shared stat pool (Brotato-character
  model) — run through `computeStats()` the same as any weapon or item mod,
  no bespoke per-chassis subsystem.
- **`focus`** — Focus behavior, see below.

`entities/Player.ts` holds the equipped `chassis: ChassisDef` (constructor
param, defaults to `DEFAULT_CHASSIS`) and threads it into every
`resolveLoadout()` call (`resolveEffectiveLoadout()`), and into its own
hitbox/speed math (`applyHitboxRadius()`, `currentSpeed()`).

## Focus — universal action + optional chassis perk

Focus is a chassis feature, not a player stat:

- **Base (universal, `ChassisFocusDef.speedMult`):** every chassis slows
  Player Speed to this fraction while Focus (Shift) is held, for precise
  dodging (Touhou-style). This is not a perk — every chassis has it.
- **Hitbox shrink is an opt-in perk, not a rule:** `ChassisFocusDef` also
  carries an optional `hitboxRadiusFocus`. Omitting it means Focus doesn't
  shrink the hitbox at all (the framework-neutral default) — a chassis that
  wants the genre-standard "graze box" declares `hitboxRadiusFocus` as its
  own identity trait, same as any other quirk. `DEFAULT_CHASSIS` opts in
  (`hitboxRadiusNormal: 6` -> `hitboxRadiusFocus: 3`, both from
  `TUNING.combat`).
- **Weapon-defined focused-fire mode:** a `WeaponDef` may declare
  `focusedMods?: ScalingModifier[]` (`systems/effects/types.ts`) — extra
  scaling modifiers (same shape/tiering as `mods`) layered in only while
  Focus is held, expressing "wide spray unfocused -> concentrated stream
  focused" as data over the shared stat pool. `Player.resolveEffectiveLoadout()`
  includes a weapon's `focusedMods` (via `weaponFocusModsAtTier()`) in
  `transientMods` only when `this.focus` is true, and `setFocus()` recomputes
  on every toggle — the same "toggled by condition flips" convention
  `stats.spec.md` already uses for grazing/polarity-style effects. No new
  engine: focused-fire is just another transient-mod source.

`DEFAULT_CHASSIS` ships with no weapon declaring `focusedMods` — the field
exists and is exercised by unit tests (`upgrades.test.ts`), proving the shape
before any weapon actually uses it.

## DEFAULT_CHASSIS

`content/chassis.ts`'s `DEFAULT_CHASSIS`: 6 weapon slots, no `statBase`
override, no quirks (`mods: []`), the Focus hitbox-shrink perk described
above. A clean, quirk-free baseline — `resolveLoadout()` with
`DEFAULT_CHASSIS`'s fields plugged in produces exactly the same `StatBlock`
as calling it with no chassis fields at all (`content/chassis.test.ts`).
`chassisById(id)` falls back to `DEFAULT_CHASSIS` for an unknown id, the same
convention as `weaponById`/`itemById`.

Chassis selection (persisting which chassis a career flies, once more than
one exists) is Epic 2 scope (`chassis.spec.todo.md`) — `Player` always
defaults to `DEFAULT_CHASSIS` today.

## Validating extensibility: a polarity-switch chassis needs no new subsystem

The framework's job in this issue is to prove it can express a chassis as
different as an Ikaruga-style polarity switch (C7 #146) without adding
engine code. Here's how that chassis slots in, entirely with pieces that
already exist above:

- **Remap an input onto the shared graze-multiplier stat.** Grazing already
  drives `grazeMultiplier` (an exotic stat, `hype-and-ratings.spec.md`)
  through Hype gain. A polarity chassis's "same-color absorption" is just a
  different *input* feeding that same stat: on absorbing a same-polarity
  bullet, the chassis (or the bullet's resolution code) applies a
  `StatModifier` against `grazeMultiplier` — no new "absorb meter" stat, no
  new subsystem, just a different producer writing into the same consumer
  `PlayScene.updateGrazeAndHype()` already reads.
- **Gate damage by state via a transient mod.** Current polarity is exactly
  the kind of toggled condition `transientMods` already exists for (stats.spec.md's
  "while grazing effects, polarity state, etc." is literally called out as
  the intended use). Flipping polarity swaps in a transient `StatModifier`
  set — e.g. a percent bonus to incoming-damage reduction in one category
  gated on the current polarity — recomputed on every polarity flip exactly
  like `Player.setFocus()` recomputes on every Focus toggle.
- **The chassis quirk slot carries the rest.** Anything permanent about the
  identity (e.g. a base stat reweight) is just `ChassisDef.statBase`/`mods`,
  same as `DEFAULT_CHASSIS`.

No part of this requires a new engine, a new stat archetype, or a bespoke
per-chassis code path — it's a new `ChassisDef` plus a state flag toggling
which `transientMods` are active, both patterns the framework already
supports. Building the actual chassis (sprite, input mapping, the specific
numbers) is C7 #146 content work, not framework work.

## Related

- [`stats.spec.md`](stats.spec.md) — the composition grammar and
  `chassisBase`/`chassisMods`/`transientMods` fields this spec builds on
- [`weapons.spec.todo.md`](weapons.spec.todo.md) — `WeaponDef.focusedMods`,
  the weapon-slot cap, the effect-composition engine chassis reuses
- [`hype-and-ratings.spec.md`](hype-and-ratings.spec.md) — `grazeMultiplier`,
  the stat a polarity chassis remaps onto
- [`chassis.spec.todo.md`](chassis.spec.todo.md) — Epic 2 chassis content
  (Ikaruga polarity C7 #146, more chassis C8 #147) and chassis selection
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
