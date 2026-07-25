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

// ── Default projectile Units (spawned by an Action's attack.spawnUnitId) ──

/**
 * A projectile is just a Unit (see file header) — these are placeholder
 * "make stuff up" stats-and-sprite pairs for the curated set extracted
 * from the projectile sheet (see public/shmup-editor/projectiles/README.md),
 * giving an attack's `spawnUnitId` a variety of ready-to-use options beyond
 * the single default Bullet. Each gets its own single "Fly" Action (same
 * shape as createDefaultBulletUnit's) so it actually travels once spawned
 * — `defaultActionId` is exactly what a dynamically-spawned Unit runs,
 * and a projectile is always spawned that way, never hand-placed. None
 * of them fire anything themselves — a projectile that recurses into more
 * projectiles is possible per the data model, but isn't a useful default.
 */
interface ProjectileSpec {
  slug: string;
  name: string;
  spriteId: string;
  hp: number;
  contactDamage: number;
  speed: number;
  size: number;
}

const PROJECTILE_SPECS: ProjectileSpec[] = [
  { slug: "bullet-tiny", name: "Bullet (Tiny)", spriteId: "proj-bullet-tiny", hp: 1, contactDamage: 1, speed: 500, size: 4 },
  { slug: "bullet-red-tip", name: "Bullet (Red Tip)", spriteId: "proj-bullet-red-tip", hp: 1, contactDamage: 2, speed: 450, size: 6 },
  { slug: "bullet-tracer", name: "Bullet (Tracer)", spriteId: "proj-bullet-tracer", hp: 1, contactDamage: 2, speed: 480, size: 6 },
  { slug: "bullet-copper", name: "Bullet (Copper)", spriteId: "proj-bullet-copper", hp: 1, contactDamage: 2, speed: 470, size: 6 },
  { slug: "shell-heavy", name: "Shell (Heavy)", spriteId: "proj-shell-heavy", hp: 1, contactDamage: 5, speed: 350, size: 10 },
  { slug: "rocket-red", name: "Rocket (Red)", spriteId: "proj-rocket-red", hp: 2, contactDamage: 6, speed: 260, size: 10 },
  { slug: "rocket-gold", name: "Rocket (Gold)", spriteId: "proj-rocket-gold", hp: 2, contactDamage: 6, speed: 240, size: 11 },
  { slug: "missile", name: "Missile", spriteId: "proj-missile-static", hp: 2, contactDamage: 5, speed: 300, size: 9 },
  { slug: "poison-flask", name: "Poison Flask", spriteId: "proj-poison-flask", hp: 1, contactDamage: 3, speed: 200, size: 9 },
  { slug: "mine-spiked-ball", name: "Spiked Mine", spriteId: "proj-mine-spiked-ball", hp: 3, contactDamage: 4, speed: 150, size: 10 },
  { slug: "cluster-shell", name: "Cluster Shell", spriteId: "proj-cluster-shell", hp: 1, contactDamage: 3, speed: 280, size: 9 },
  { slug: "mine-morning-star", name: "Morning Star Mine", spriteId: "proj-mine-morning-star", hp: 4, contactDamage: 6, speed: 130, size: 12 },
  { slug: "fire-orb", name: "Fire Orb", spriteId: "proj-fire-orb", hp: 1, contactDamage: 4, speed: 320, size: 8 },
  { slug: "starburst", name: "Starburst", spriteId: "proj-starburst", hp: 1, contactDamage: 5, speed: 300, size: 9 },
  { slug: "energy-orb-blue", name: "Energy Orb (Blue)", spriteId: "proj-energy-orb-blue", hp: 1, contactDamage: 3, speed: 380, size: 7 },
  { slug: "lightning-bolt", name: "Lightning Bolt", spriteId: "proj-lightning-bolt", hp: 1, contactDamage: 4, speed: 550, size: 6 },
  { slug: "crystal-burst-green", name: "Crystal Burst (Green)", spriteId: "proj-crystal-burst-green", hp: 1, contactDamage: 4, speed: 300, size: 8 },
  { slug: "orb-capsule-purple", name: "Orb Capsule (Purple)", spriteId: "proj-orb-capsule-purple", hp: 1, contactDamage: 3, speed: 340, size: 8 },
  { slug: "toxic-canister", name: "Toxic Canister", spriteId: "proj-toxic-canister", hp: 2, contactDamage: 4, speed: 220, size: 9 },
  { slug: "energy-canister-blue", name: "Energy Canister (Blue)", spriteId: "proj-energy-canister-blue", hp: 2, contactDamage: 3, speed: 300, size: 8 },
];

function projectileUnitId(slug: string): string {
  return `unit-default-proj-${slug}`;
}

function createFlyAction(): ActionDef {
  return {
    id: makeActionId(),
    name: "Fly",
    movementPercent: 100,
    facing: "faceMovement",
    fixedFacingDeg: 90,
    setsInvincible: null,
    requiresInvincible: false,
    attack: null,
  };
}

function createProjectileUnit(spec: ProjectileSpec, now: number): UnitDef {
  const flyAction = createFlyAction();
  return {
    id: projectileUnitId(spec.slug),
    name: spec.name,
    spriteId: spec.spriteId,
    customSprite: null,
    hp: spec.hp,
    contactDamage: spec.contactDamage,
    scoreValue: 0,
    speed: spec.speed,
    turnRate: 1,
    size: spec.size,
    layer: "ground",
    defaultActionId: flyAction.id,
    actions: [flyAction],
    parts: [createDefaultPart()],
    createdAt: now,
    modifiedAt: now,
  };
}

// ── Default enemy Units, pre-wired with a basic movement + attack Action ──

/**
 * Every enemy Unit below is seeded with two Actions: a "Move" Action
 * (`movementPercent: 100`, facing the direction of travel — or, for the
 * two stationary turrets, `movementPercent: 0`/fixed facing) on the
 * Unit's own buffet, plus an "Attack" Action (stationary, facing the
 * player, firing the default Bullet on repeat) either also on the Unit's
 * own buffet (simple single-sprite vehicles) or on a dedicated Turret
 * Part's buffet (body+turret vehicles) — see file header on why Parts
 * have their own independent Action buffet. `defaultActionId` points at
 * the Move Action, same convention as createDefaultBulletUnit's "Fly".
 */
function createMoveAction(canMove: boolean): ActionDef {
  return {
    id: makeActionId(),
    name: "Move",
    movementPercent: canMove ? 100 : 0,
    facing: canMove ? "faceMovement" : "fixed",
    fixedFacingDeg: 90,
    setsInvincible: null,
    requiresInvincible: false,
    attack: null,
  };
}

function createAttackAction(burstIntervalMs: number): ActionDef {
  return {
    id: makeActionId(),
    name: "Attack",
    movementPercent: 0,
    facing: "facePlayer",
    fixedFacingDeg: 90,
    setsInvincible: null,
    requiresInvincible: false,
    attack: {
      arcStartDeg: 0,
      arcEndDeg: 0,
      count: 1,
      spacing: "even",
      perShotDelayMs: 0,
      sweepSpeedDeg: 0,
      pingPong: false,
      burstIntervalMs,
      telegraphMs: 0,
      repeatCount: null,
      spawnUnitId: DEFAULT_BULLET_UNIT_ID,
      spawnScale: 1,
      spawnGroup: "enemyProjectile",
    },
  };
}

interface SimpleEnemySpec {
  slug: string;
  name: string;
  spriteId: string;
  layer: UnitLayer;
  hp: number;
  contactDamage: number;
  scoreValue: number;
  speed: number;
  turnRate: number;
  size: number;
  fireIntervalMs: number;
}

const SIMPLE_ENEMY_SPECS: SimpleEnemySpec[] = [
  { slug: "heli", name: "Attack Helicopter", spriteId: "heli", layer: "air", hp: 30, contactDamage: 3, scoreValue: 220, speed: 140, turnRate: 1.2, size: 16, fireIntervalMs: 950 },
  { slug: "heli-transport", name: "Transport Helicopter", spriteId: "heli-transport", layer: "air", hp: 50, contactDamage: 2, scoreValue: 260, speed: 100, turnRate: 0.8, size: 20, fireIntervalMs: 1400 },
  { slug: "jet-bomber", name: "Jet Bomber", spriteId: "jet-bomber", layer: "air", hp: 45, contactDamage: 4, scoreValue: 300, speed: 160, turnRate: 0.9, size: 20, fireIntervalMs: 1200 },
  { slug: "jet-fighter", name: "Jet Fighter", spriteId: "jet-fighter", layer: "air", hp: 25, contactDamage: 3, scoreValue: 220, speed: 220, turnRate: 1.4, size: 16, fireIntervalMs: 800 },
  { slug: "jet-stealth", name: "Stealth Jet", spriteId: "jet-stealth", layer: "air", hp: 20, contactDamage: 4, scoreValue: 260, speed: 240, turnRate: 1.5, size: 15, fireIntervalMs: 750 },
  { slug: "motorcycle-sidecar", name: "Motorcycle + Sidecar", spriteId: "motorcycle-sidecar", layer: "ground", hp: 18, contactDamage: 2, scoreValue: 150, speed: 150, turnRate: 1.3, size: 14, fireIntervalMs: 1000 },
  { slug: "plane-prop", name: "Prop Plane", spriteId: "plane-prop", layer: "air", hp: 55, contactDamage: 3, scoreValue: 280, speed: 120, turnRate: 0.7, size: 22, fireIntervalMs: 1300 },
  { slug: "truck-transport", name: "Transport Truck", spriteId: "truck-transport", layer: "ground", hp: 35, contactDamage: 2, scoreValue: 200, speed: 90, turnRate: 0.8, size: 18, fireIntervalMs: 1400 },
  { slug: "turret", name: "Turret", spriteId: "turret", layer: "ground", hp: 30, contactDamage: 3, scoreValue: 200, speed: 0, turnRate: 0, size: 16, fireIntervalMs: 1000 },
  { slug: "turret-4x", name: "Turret (Quad)", spriteId: "turret-4x", layer: "ground", hp: 40, contactDamage: 4, scoreValue: 260, speed: 0, turnRate: 0, size: 18, fireIntervalMs: 700 },
  { slug: "train-front", name: "Train (Front)", spriteId: "train-front", layer: "ground", hp: 80, contactDamage: 4, scoreValue: 400, speed: 60, turnRate: 0.4, size: 26, fireIntervalMs: 1500 },
  { slug: "train-rear", name: "Train (Rear)", spriteId: "train-rear", layer: "ground", hp: 60, contactDamage: 3, scoreValue: 320, speed: 60, turnRate: 0.4, size: 24, fireIntervalMs: 1500 },
];

function enemyUnitId(slug: string): string {
  return `unit-default-${slug}`;
}

function createSimpleEnemyUnit(spec: SimpleEnemySpec, now: number): UnitDef {
  const moveAction = createMoveAction(spec.speed > 0);
  const attackAction = createAttackAction(spec.fireIntervalMs);
  return {
    id: enemyUnitId(spec.slug),
    name: spec.name,
    spriteId: spec.spriteId,
    customSprite: null,
    hp: spec.hp,
    contactDamage: spec.contactDamage,
    scoreValue: spec.scoreValue,
    speed: spec.speed,
    turnRate: spec.turnRate,
    size: spec.size,
    layer: spec.layer,
    defaultActionId: moveAction.id,
    actions: [moveAction, attackAction],
    parts: [createDefaultPart()],
    createdAt: now,
    modifiedAt: now,
  };
}

interface TurretedEnemySpec {
  slug: string;
  name: string;
  bodySpriteId: string;
  turretSpriteId: string;
  /** One entry per turret mount — most vehicles have one, but battleship/train-gun-car have several obvious circular gun mounts baked into their hull/body art (see enemies/README.md), so each gets its own independently-firing Turret Part. */
  turretOffsets: Vec2[];
  layer: UnitLayer;
  hp: number;
  contactDamage: number;
  scoreValue: number;
  speed: number;
  turnRate: number;
  size: number;
  fireIntervalMs: number;
}

/** Vehicles split into a body + turret sprite (see enemies/README.md's "incoming" batch and the pre-existing armored-truck/battle-tank Parts-demo set) — each turret mount is its own Part, offset from center, carrying the Attack Action. */
const TURRETED_ENEMY_SPECS: TurretedEnemySpec[] = [
  { slug: "armored-truck", name: "Armored Truck", bodySpriteId: "armored-truck-body", turretSpriteId: "armored-truck-turret", turretOffsets: [{ x: 0, y: 0 }], layer: "ground", hp: 40, contactDamage: 3, scoreValue: 250, speed: 90, turnRate: 0.8, size: 20, fireIntervalMs: 1000 },
  { slug: "battle-tank", name: "Battle Tank", bodySpriteId: "battle-tank-body", turretSpriteId: "battle-tank-turret", turretOffsets: [{ x: 0, y: 0 }], layer: "ground", hp: 60, contactDamage: 4, scoreValue: 350, speed: 70, turnRate: 0.6, size: 22, fireIntervalMs: 900 },
  // Battleship hull art has 4 obvious circular turret barbettes (2 fore, 2 aft of the bridge) — one Turret Part each.
  { slug: "battleship", name: "Battleship", bodySpriteId: "battleship-hull", turretSpriteId: "battleship-turret", turretOffsets: [{ x: 0, y: -43 }, { x: 0, y: -25 }, { x: 0, y: 22 }, { x: 0, y: 39 }], layer: "ground", hp: 150, contactDamage: 6, scoreValue: 800, speed: 40, turnRate: 0.3, size: 34, fireIntervalMs: 1100 },
  { slug: "missile-truck", name: "Missile Truck", bodySpriteId: "missile-truck-body", turretSpriteId: "missile-truck-turret", turretOffsets: [{ x: 0, y: -6 }], layer: "ground", hp: 45, contactDamage: 5, scoreValue: 320, speed: 85, turnRate: 0.8, size: 20, fireIntervalMs: 1300 },
  // Train gun car body art has 3 obvious circular turret rings running down the roof.
  { slug: "train-gun-car", name: "Train (Gun Car)", bodySpriteId: "train-gun-car-body", turretSpriteId: "train-gun-car-turret", turretOffsets: [{ x: 0, y: -41 }, { x: 0, y: -4 }, { x: 0, y: 33 }], layer: "ground", hp: 70, contactDamage: 5, scoreValue: 380, speed: 60, turnRate: 0.4, size: 24, fireIntervalMs: 850 },
];

function createTurretedEnemyUnit(spec: TurretedEnemySpec, now: number): UnitDef {
  const moveAction = createMoveAction(spec.speed > 0);
  const main = createDefaultPart();
  const turrets: UnitPart[] = spec.turretOffsets.map((offset, i) => ({
    id: makePartId(),
    name: spec.turretOffsets.length > 1 ? `Turret ${i + 1}` : "Turret",
    offset,
    spriteId: spec.turretSpriteId,
    customSprite: null,
    hasHitbox: false,
    hasHealth: false,
    hp: 10,
    damageMultiplier: 1,
    actions: [createAttackAction(spec.fireIntervalMs)],
  }));
  return {
    id: enemyUnitId(spec.slug),
    name: spec.name,
    spriteId: spec.bodySpriteId,
    customSprite: null,
    hp: spec.hp,
    contactDamage: spec.contactDamage,
    scoreValue: spec.scoreValue,
    speed: spec.speed,
    turnRate: spec.turnRate,
    size: spec.size,
    layer: spec.layer,
    defaultActionId: moveAction.id,
    actions: [moveAction],
    parts: [main, ...turrets],
    createdAt: now,
    modifiedAt: now,
  };
}

/** The full default Unit library a brand-new/reset session starts with. */
export function createDefaultUnitLibrary(): UnitDef[] {
  const now = Date.now();
  return [
    createDefaultBulletUnit(),
    ...PROJECTILE_SPECS.map((spec) => createProjectileUnit(spec, now)),
    ...SIMPLE_ENEMY_SPECS.map((spec) => createSimpleEnemyUnit(spec, now)),
    ...TURRETED_ENEMY_SPECS.map((spec) => createTurretedEnemyUnit(spec, now)),
  ];
}
