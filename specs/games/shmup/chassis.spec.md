# Shmup — Chassis Spec

> Issues: **F10 #138** (framework + default chassis), **C7 #146** (Ikaruga
> polarity chassis). Status: implemented. Code lives in
> `games/shmup/src/systems/chassis/` (the `ChassisDef`/`ChassisPolarityDef`
> shapes), `games/shmup/src/systems/combat/polarity.ts` (pure damage-gating/
> absorption resolution), and `games/shmup/src/content/chassis.ts` (the
> registry — `DEFAULT_CHASSIS`, `IKARUGA_CHASSIS`, `chassisById()`).
> Additional chassis are Epic 2 content — see `chassis.spec.todo.md`.

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
  engine before F10 landed. A chassis is proof that engine needed no changes
  to express: `statBase` overrides a stat's base value (e.g. a tankier frame
  raising base Max HP), `mods` are 1-2 persistent `StatModifier`s
  reinterpreting the shared stat pool (Brotato-character model) — run
  through `computeStats()` the same as any weapon or item mod, no bespoke
  per-chassis subsystem.
- **`focus`** — Focus behavior, see below.
- **`polarity`** (optional) — the Ikaruga-style polarity-switch mechanic, see
  below. Absent entirely on chassis that don't use it (`DEFAULT_CHASSIS`).

`entities/Player.ts` holds the equipped `chassis: ChassisDef` (constructor
param, defaults to `DEFAULT_CHASSIS`) and threads it into every
`resolveLoadout()` call (`resolveEffectiveLoadout()`), and into its own
hitbox/speed/polarity math.

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
  `TUNING.combat`); `IKARUGA_CHASSIS` doesn't — its identity is entirely the
  polarity hook below.
- **Weapon-defined focused-fire mode:** a `WeaponDef` may declare
  `focusedMods?: ScalingModifier[]` (`systems/effects/types.ts`) — extra
  scaling modifiers (same shape/tiering as `mods`) layered in only while
  Focus is held, expressing "wide spray unfocused -> concentrated stream
  focused" as data over the shared stat pool. `Player.resolveEffectiveLoadout()`
  includes a weapon's `focusedMods` (via `weaponFocusModsAtTier()`) in
  `transientMods` only when `this.focus` is true, and `setFocus()` recomputes
  on every toggle — the same "toggled by condition flips" convention
  `stats.spec.md` already uses for grazing/polarity-style effects. No new
  engine: focused-fire is just another transient-mod source. No shipped
  weapon declares `focusedMods` yet (`chassis.spec.todo.md`).

## DEFAULT_CHASSIS

`content/chassis.ts`'s `DEFAULT_CHASSIS`: 6 weapon slots, no `statBase`
override, no quirks (`mods: []`), the Focus hitbox-shrink perk described
above, no `polarity`. A clean, quirk-free baseline — `resolveLoadout()` with
`DEFAULT_CHASSIS`'s fields plugged in produces exactly the same `StatBlock`
as calling it with no chassis fields at all (`content/chassis.test.ts`).
`chassisById(id)` falls back to `DEFAULT_CHASSIS` for an unknown id, the same
convention as `weaponById`/`itemById`. Every fresh career (`createNewCareer()`)
starts equipped with it (`CareerState.chassisId`).

## IKARUGA_CHASSIS — the polarity-switch flagship

`content/chassis.ts`'s `IKARUGA_CHASSIS` (C7 #146): no static stat quirks and
no Focus hitbox-shrink perk — its entire identity is the optional
`ChassisDef.polarity` hook (`ChassisPolarityDef`: `initial`,
`damageMultiplierSame`, `damageMultiplierOpposite`, `absorbHypeBase`, sourced
from `TUNING.chassis.ikaruga`), resolved by two pure functions in
`systems/combat/polarity.ts`:

- **`polarityDamageMultiplier(polarityDef, shotPolarity, targetPolarity)`** —
  "current polarity gates which enemies take full damage from your shots."
  `PlayerBullet.shotPolarity` is baked in once per shot fired (same
  convention as crit, `combat.spec.todo.md`) from `Player.polarity` at the
  moment `PlayScene.fireWeapon()` fires — a mid-flight polarity switch never
  retroactively changes an already-fired shot. `Enemy.polarity` is assigned
  randomly (50/50) on every spawn regardless of the equipped chassis (inert
  data unless a polarity chassis reads it). `onPlayerBulletHitEnemy()`
  applies the resulting multiplier to both the primary hit and any blast
  splash damage, per target.
- **`absorbsBullet(polarityDef, playerPolarity, bulletPolarity)`** —
  "same-color absorption." `EnemyBullet.polarity` inherits its firing
  enemy's polarity. `PlayScene.onEnemyBulletHitPlayer()` checks this before
  applying damage: a same-polarity bullet is recycled with **no damage**
  and instead calls `absorbBullet()`, which feeds `TUNING.chassis.ikaruga.absorbHypeBase`
  into `gainHype()` scaled by the player's `grazeMultiplier` stat — "same-color
  absorption feeds the same underlying graze-multiplier stat, repurposed as
  absorb-meter gain rate": an instantaneous Hype pulse through the exact
  gain path grazing already uses, not a new meter. An opposite-polarity
  bullet damages the player normally.

Both functions take `ChassisPolarityDef | undefined` explicitly rather than
reading a chassis object, so a chassis with no polarity mechanic (every
chassis but Ikaruga today) always resolves to "no gating, no absorption"
with no special-casing anywhere in `PlayScene`.

`Player.togglePolarity()` flips red/blue (bound to the `X` key in
`PlayScene`) and is a no-op on a chassis without `polarity`. Visual feedback
uses `setTintFill()` (not `setTint()`, which multiplies over a placeholder
sprite's own base color and reads as muddy rather than a clean red/blue) on
the player ship, enemies, and both bullet types — `TUNING.chassis.polarityColors`
— but only when the equipped chassis actually has `polarity`; a
polarity-agnostic chassis never shows a meaningless red/blue split.

## Chassis selection — the Hangar

Chassis choice persists on `CareerState.chassisId` (same id-indirection
convention as `OwnedWeaponRef`/`OwnedItemRef` — a save never embeds a full
`ChassisDef` snapshot), resolved via `chassisById()` everywhere a build is
resolved (`PlayScene`, `ShopScene`'s stat preview, `ResolveScene`'s Player
Speed preview). `scenes/ChassisSelectScene.ts` (the "Hangar") lists every
`ALL_CHASSIS` entry, highlights the currently-equipped one, and re-saves the
career on tap. `MapScene` exposes it via a persistent corner button
(opposite the "New Career" control) on both the Season map and Syndication
screens — reachable any time, not gated behind starting a new career, since
a chassis is career-persistent equipment rather than a one-time pick.

## Related

- [`stats.spec.md`](stats.spec.md) — the composition grammar and
  `chassisBase`/`chassisMods`/`statPickMods`/`transientMods` fields this spec
  builds on
- [`weapons.spec.todo.md`](weapons.spec.todo.md) — `WeaponDef.focusedMods`,
  the weapon-slot cap, the effect-composition engine chassis reuses
- [`hype-and-ratings.spec.md`](hype-and-ratings.spec.md) — `grazeMultiplier`
  and `gainHype()`, which Ikaruga's absorption repurposes rather than
  duplicating
- [`chassis.spec.todo.md`](chassis.spec.todo.md) — remaining Epic 2 chassis
  content (C8 #147) and follow-ups
- [`overview.spec.todo.md`](overview.spec.todo.md) — spec map
