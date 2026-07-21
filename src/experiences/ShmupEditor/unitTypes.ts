/**
 * Unit data model for the Shmup Editor. **Actions are back** — reverses
 * this file's own prior header note ("There is no ActionDef/'Action
 * buffet' anymore"). That cut was the right call at the time (the old
 * Action only bundled an inert `animationState` + a `visible` bool not
 * worth an indirection), but using the shipped editor exposed real gaps
 * a plain step/attack model couldn't cover — reusable named behaviors,
 * facing/rotation, and a reason for a bullet to be more than a straight
 * line. Design handoff v3 (2026-07-18) proposed a genuinely richer
 * Action; several rounds of reconciliation against it landed on the
 * shape below. Full history: `specs/shmup-editor.md`.
 *
 * A Unit (also covers non-combatant doodads/loot) is sprite + stats + a
 * **layer** + a reusable **Action buffet**, plus zero or more **Parts**,
 * each with its own independent Action buffet. An Action is a fused,
 * reusable bundle of movement-speed%, facing, a state toggle, and an
 * optional attack — authored once per Unit/Part, referenced by an
 * encounter's steps (base Unit) or Part-action placements (Parts).
 *
 * **Movement destination stays per-placement, not on the Action.** An
 * Action is reusable ("author once, place many times"); a literal map
 * coordinate isn't reusable in any useful sense. What's reusable is *how*
 * something moves (`movementPercent` of the owner's fixed `speed`,
 * `facing` while doing it) — *where* it moves to is still the step's own
 * `pos`/`handleIn`/`handleOut` (encounterTypes.ts), exactly as before
 * Actions came back. `speed` itself is a fixed per-Unit ceiling, never
 * touched by difficulty scaling — only `movementPercent` (0 = stationary,
 * 100 = full speed) selects how much of it an Action actually uses, so
 * level pacing stays predictable regardless of how HP/damage/count scale.
 *
 * **Facing subsumes aim — there's no separate weapon aim mode anymore.**
 * A turret's `FixedFire` vs `AimedFire` were always really about which
 * way it's pointed; an attack's base angle is simply whatever the owning
 * Action's `facing` resolves to at fire time. "Aim at a fixed point on
 * the map" is just `facing: "fixed"` with the angle chosen to point
 * there — not a third mode.
 *
 * **Invincibility is derived, not stored per-placement.** No `invincible`
 * field lives on a step or Part-action-placement — it's computed by
 * walking the sequence of Actions in order and applying each one's
 * `setsInvincible` (`null` = no change, carries the previous value
 * forward; `true`/`false` = sets it), starting from `false`. This is also
 * the semantic successor to the old `EncounterStep.visible` — Noah's
 * correction: a Unit that can't be hit isn't necessarily *invisible*
 * (a submarine's shadow, a turret behind a closed blast door) — until a
 * real animation system exists to swap in an alternate sprite for that
 * state, hiding the sprite is just the temporary stand-in.
 *
 * **Weapons are gone as a separate class — an attack is just a field on
 * an Action.** Nothing was gained by the indirection: Weapons were never
 * shared across Units, or even across a Unit's own Parts (each Part owned
 * a private list), so the only reuse a separate class bought was two
 * Actions on the *same* Part wanting a byte-identical fire pattern — a
 * narrow case Clone (authoring-UI, not a data concept) covers fine. A
 * spawned projectile is still an actual Unit, not a bespoke bullet type
 * (`ActionAttack.spawnUnitId`) — recursion (a bullet that itself fires)
 * falls out for free.
 *
 * **Collision groups replace the implicit player/enemy split the old
 * fixed entity classes (`Player`/`Enemy`/`PlayerBullet`/`EnemyBullet`)
 * gave `games/shmup` for free.** A flat `CollisionGroup` on
 * `ActionAttack` (default `"enemyProjectile"`, since this editor only
 * ever authors enemy-side content) plus a small fixed collision matrix in
 * the eventual runtime (same-group never checks itself;
 * `enemyProjectile`/`friendlyProjectile` never check each other either)
 * reproduces that same behavior — no friendly fire, no bullets hitting
 * bullets — without needing spawner-lineage tracking.
 *
 * **Per-Part hitboxes are back too** — `hasHitbox`/`hasHealth`/
 * `damageMultiplier`, previously reserved for hand-coded bosses only,
 * are now general authored fields (Noah: "we're 80% of the way there with
 * sprites and positions"). Hittability cascades top-down only: a Part is
 * only hittable if it *and* its parent Unit are both currently non-
 * invincible — a Part can be more restrictive than its parent (a
 * temporarily shielded turret on an otherwise-vulnerable hull), never
 * less.
 *
 * Deliberately self-contained apart from `Vec2` — not imported from
 * games/shmup/src/.
 */
import type { Vec2 } from "./encounterTypes";

// ── Collision groups ──────────────────────────────────────────────────────

/**
 * Flat, fixed set — not spawner-lineage-derived. A spawned projectile's
 * group is authored directly on the `ActionAttack` that spawns it, not
 * inherited from whatever fired it. The eventual runtime's collision
 * matrix (not this editor's concern) is what actually enforces "same
 * group never checks itself" and "the two projectile groups never check
 * each other" — this type only names the four buckets.
 */
export type CollisionGroup = "enemy" | "friendly" | "enemyProjectile" | "friendlyProjectile";

// ── Layers (Ground/Air/Doodad — a spawn-selection concern, not an editor one) ──

/**
 * A fixed property of the Unit itself, not of any one placement — chosen
 * once when authoring the Unit, shown as a filter/grouping in the
 * Encounter editor's "+ Add" picker. What the game does with layers when
 * picking which Encounters combine on a tile spawn (`spawn-and-warnings.spec.todo.md`)
 * is entirely a runtime concern; the editor's only job is letting an
 * author declare which roster a Unit belongs to.
 */
export type UnitLayer = "ground" | "air" | "doodad";

// ── Actions (fused movement% + facing + state + optional attack) ─────────

export type FacingMode = "fixed" | "faceMovement" | "facePlayer";

export interface ActionAttack {
  /** Arc range in degrees, relative to the owning Action's resolved facing direction — e.g. -30/+30 for a narrow fan, 0/360 for a full radial burst, 5/355 for a burst with a deliberate gap at the facing direction. */
  arcStartDeg: number;
  arcEndDeg: number;
  /** Shots per burst, spread across the arc range. 1 with a zero-width arc is a plain single shot. */
  count: number;
  spacing: "even" | "random";
  /** Time between individual shots within one burst, ms — 0 = simultaneous. Distinct from burstIntervalMs, the time between bursts. */
  perShotDelayMs: number;
  /** Arc rotation speed, degrees/sec — 0 = static arc; nonzero sweeps the whole arc over time. */
  sweepSpeedDeg: number;
  /** Oscillate the sweep between its arc bounds instead of rotating continuously. */
  pingPong: boolean;
  /** Time between bursts, ms. Only meaningful when repeatCount isn't 1. */
  burstIntervalMs: number;
  /** Wind-up before the first burst, ms — shown as a distinct telegraph color on the timeline. */
  telegraphMs: number;
  /** How many bursts this Action fires before it's done — `null` = fire for as long as the Action itself keeps running (a Final Action's indefinite repeat); a number = a fixed, finite count (e.g. one beat of a scripted boss sequence). Feeds the Action's own computed duration. */
  repeatCount: number | null;
  /** The Unit spawned as the projectile — null = not yet configured (fires nothing). Any Unit in the library is eligible, including one with its own Parts/Actions, which is what makes splitting/recursive fire free. */
  spawnUnitId: string | null;
  /** Simple flat multiplier applied to the spawned Unit (size, etc.) — deliberately simple, see shmup-editor.todo.md's deferred difficulty-scaling-curve system. */
  spawnScale: number;
  /** Which collision group the spawned Unit belongs to — see CollisionGroup above. Defaults to "enemyProjectile" since this editor only authors enemy-side content. */
  spawnGroup: CollisionGroup;
}

export interface ActionDef {
  id: string;
  name: string;
  /** 0–100, percent of the owning Unit's fixed `speed` stat. 0 = stationary (a dwell). Never exceeds 100 — see file header on why speed itself is a fixed ceiling. */
  movementPercent: number;
  facing: FacingMode;
  /** Only meaningful when facing === "fixed" — degrees, same convention as the old WeaponDef.fixedAngleDeg (0 = +x/right, 90 = +y/down). */
  fixedFacingDeg: number;
  /** null = this Action doesn't change invincibility (carries forward whatever the previous Action left it at); true/false = sets it explicitly. */
  setsInvincible: boolean | null;
  /** Precondition — this Action is only eligible to run next if the current (derived) invincible state matches. Defaults to false since most Actions expect to be hittable. */
  requiresInvincible: boolean;
  /** null = this Action doesn't fire anything (pure movement/facing/state). */
  attack: ActionAttack | null;
}

export function makeActionId(): string {
  return `action-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankAction(existingCount: number): ActionDef {
  return {
    id: makeActionId(),
    name: `Action ${existingCount + 1}`,
    movementPercent: 100,
    facing: "fixed",
    fixedFacingDeg: 90,
    setsInvincible: null,
    requiresInvincible: false,
    attack: null,
  };
}

/** Defaults to spawning the seeded default Bullet Unit rather than `null` — a brand-new attack does something visible/testable immediately instead of silently firing nothing. */
export function createBlankAttack(): ActionAttack {
  return {
    arcStartDeg: 0,
    arcEndDeg: 0,
    count: 1,
    spacing: "even",
    perShotDelayMs: 0,
    sweepSpeedDeg: 0,
    pingPong: false,
    burstIntervalMs: 1000,
    telegraphMs: 0,
    repeatCount: null,
    spawnUnitId: DEFAULT_BULLET_UNIT_ID,
    spawnScale: 1,
    spawnGroup: "enemyProjectile",
  };
}

// ── Parts (named anchor points, each owning its own independent Action buffet) ──

export interface UnitPart {
  id: string;
  name: string;
  /** Position offset from the Unit's own origin — anchors this part and its Actions' facing/attack, e.g. a turret mounted forward of a battleship's center. */
  offset: Vec2;
  /** Optional sprite so a Part can render/reposition visually — "none" = invisible, just a logical anchor for its Actions. */
  spriteId: string;
  customSprite: string | null;
  /** false (default) = fused to the base sprite, no separate collision — damage to this area is attributed to the parent Unit. true = has its own hitbox, subject to damageMultiplier, and (if hasHealth) its own HP pool. */
  hasHitbox: boolean;
  /** Only meaningful when hasHitbox is true. false = damage transfers through to the parent Unit's shared HP pool. true = this Part has its own separate pool (see hp). */
  hasHealth: boolean;
  /** Only meaningful when hasHitbox && hasHealth. */
  hp: number;
  /** Only meaningful when hasHitbox is true. >1 = weak point/critical spot, <1 = reinforced armor. */
  damageMultiplier: number;
  actions: ActionDef[];
}

export function makePartId(): string {
  return `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** The mandatory baseline every Unit is seeded with, so a fresh Unit has somewhere to hang an Action without extra authoring for the common single-part case. */
export function createDefaultPart(): UnitPart {
  return { id: makePartId(), name: "Main", offset: { x: 0, y: 0 }, spriteId: "none", customSprite: null, hasHitbox: false, hasHealth: false, hp: 10, damageMultiplier: 1, actions: [] };
}

export function createBlankPart(existingCount: number): UnitPart {
  return { id: makePartId(), name: `Part ${existingCount + 1}`, offset: { x: 0, y: 0 }, spriteId: "none", customSprite: null, hasHitbox: false, hasHealth: false, hp: 10, damageMultiplier: 1, actions: [] };
}

// ── Unit ───────────────────────────────────────────────────────────────────

export interface UnitDef {
  id: string;
  name: string;
  spriteId: string;
  customSprite: string | null;
  hp: number;
  contactDamage: number;
  scoreValue: number;
  /** Fixed max travel speed along its encounter steps' bezier curves, px/sec — never touched by difficulty scaling, see file header. An Action's movementPercent selects how much of this is actually used. */
  speed: number;
  /** Caps how far a step's bezier handle can extend, as a multiple of that segment's straight-line length (1 = up to 100%). Higher = tighter/sharper turns allowed. */
  turnRate: number;
  /** Hitbox radius, px. */
  size: number;
  layer: UnitLayer;
  /** The Action used when this Unit is spawned dynamically (an ActionAttack.spawnUnitId reference) rather than hand-placed on a tile — a dynamic spawn has no placement-time "choose a starting Action" step to draw from. null = not yet configured. */
  defaultActionId: string | null;
  /** This Unit's own reusable Action buffet — used directly when it has no Parts (the simplest case: a jet that flies and shoots is one Unit, zero Parts, one Final Action), and always governs the base Unit's own movement/facing/state regardless of how many Parts it has. */
  actions: ActionDef[];
  parts: UnitPart[];
  createdAt: number;
  modifiedAt: number;
}

export function makeUnitId(): string {
  return `unit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankUnit(existingCount: number): UnitDef {
  const now = Date.now();
  return {
    id: makeUnitId(),
    name: `New Unit ${existingCount + 1}`,
    spriteId: "none",
    customSprite: null,
    hp: 10,
    contactDamage: 1,
    scoreValue: 100,
    speed: 120,
    turnRate: 1,
    size: 16,
    layer: "ground",
    defaultActionId: null,
    actions: [],
    parts: [createDefaultPart()],
    createdAt: now,
    modifiedAt: now,
  };
}

/** Stable (not random) id — the default library reseeds against this exact id, see unitStore.ts, so a fresh install and a version-bump reset both land on the same Bullet rather than accumulating duplicates. */
export const DEFAULT_BULLET_UNIT_ID = "unit-default-bullet";

/**
 * A ready-to-use "Bullet" Unit, seeded into a brand-new/reset library
 * (unitStore.ts's `loadUnits`) so the editor never starts from a totally
 * blank Unit picker — the single most common thing an attack spawns is
 * some kind of generic projectile, and authoring one from scratch before
 * you can test *anything* about attacks was real friction. Its one Action
 * ("Fly") is a Final Action (repeatCount: null on nothing — this Unit
 * itself doesn't attack, it just travels) at full speed, straight ahead.
 */
export function createDefaultBulletUnit(): UnitDef {
  const now = Date.now();
  const flyAction: ActionDef = {
    id: makeActionId(),
    name: "Fly",
    movementPercent: 100,
    facing: "faceMovement",
    fixedFacingDeg: 90,
    setsInvincible: null,
    requiresInvincible: false,
    attack: null,
  };
  return {
    id: DEFAULT_BULLET_UNIT_ID,
    name: "Bullet",
    spriteId: "bullet-basic",
    customSprite: null,
    hp: 1,
    contactDamage: 1,
    scoreValue: 0,
    speed: 300,
    turnRate: 1,
    size: 6,
    layer: "ground",
    defaultActionId: flyAction.id,
    actions: [flyAction],
    parts: [createDefaultPart()],
    createdAt: now,
    modifiedAt: now,
  };
}

/** The full default Unit library a brand-new/reset session starts with. */
export function createDefaultUnitLibrary(): UnitDef[] {
  return [createDefaultBulletUnit()];
}
