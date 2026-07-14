/**
 * Unit data model for the Shmup Editor (specs/shmup-editor.todo.md, E2 #192
 * — reworked per the "Design Handoff v2" doc after real usability friction,
 * then reworked again for the bezier-curve movement pass, then again for
 * the Parts/weapon-track pass). Deliberately self-contained apart from
 * `Vec2` — not imported from games/shmup/src/.
 *
 * A Unit (renamed from Enemy — also covers non-combatant doodads/loot) is
 * sprite + stats + a reusable **buffet of Actions** (movement/animation
 * only, see below) + a set of **Parts**, each owning its own reusable
 * buffet of **Weapons**.
 *
 * **Movement is two plain Unit stats, `speed`/`turnRate` — not an Action
 * concept.** Every segment between two of a Unit's encounter steps is a
 * single cubic bezier curve (`bezier.ts`), shaped by each step's own
 * `handleIn`/`handleOut` (encounterTypes.ts) and paced by `speed`.
 * `turnRate` caps how far a handle can bend the curve, relative to the
 * segment's straight-line length. **Dwelling is simply a step whose
 * position matches its predecessor's.**
 *
 * **Attacks are not an Action concept either — they live on Parts.** A
 * Unit has one or more **Parts** (`UnitPart`) — named anchor points offset
 * from the Unit's own position (a battleship's three turrets, or the
 * single default "Main" part every Unit is seeded with for the common
 * one-weapon-system case). Each Part owns a reusable buffet of
 * **`WeaponDef`s**, authored once and placed on the timeline as
 * independent per-part attack events (`EncounterAttack`, see
 * encounterTypes.ts) — a battleship's three turrets firing on independent
 * schedules is just three parts' worth of attack-track placements, not a
 * multi-entity system.
 *
 * **The weapon model is one flat, orthogonal set of fields — no shape ×
 * aim × trigger matrix.** Per "Design Handoff v2" §5.6: aim (fixed
 * direction, or the player, tracked or snapshotted) + an arc range
 * (degrees relative to the aim) + shot count/spacing/per-shot delay +
 * optional sweep (a nonzero sweep speed is what "rotating fire" used to
 * be — the arc itself rotates over time, with an optional ping-pong
 * oscillation instead of continuous rotation) + a firing interval. This
 * single primitive covers a narrow fan (small arc, few shots), a radial
 * burst (0°–360°), and a burst with a deliberate gap at the aim direction
 * (e.g. 5°–355°) — a pattern the old shape enum couldn't express at all.
 * **Beam and trigger kinds (`onTrigger`/`onDeath`/`continuous`) are cut
 * entirely** — everything is time-based (an attack event's own `time` on
 * the encounter timeline *is* its trigger; a repeating burst is just a
 * nonzero `fireIntervalMs`), and a beam can be faked with a rapid-fire
 * long/thin projectile rather than needing its own primitive.
 *
 * **A weapon spawns an actual Unit, not a separate bullet type.** Per
 * "a bullet is a minimal enemy" (enemies-and-bullets.spec.todo.md §7),
 * `WeaponDef.spawnUnitId` references any Unit in the library — recursion
 * (a projectile that itself fires) falls out for free, since a spawned
 * Unit can have its own Parts/Weapons, with no dedicated nested-payload
 * shape needed. `spawnScale` is a deliberately simple flat multiplier for
 * now — see shmup-editor.todo.md for the deferred difficulty-scaling-curve
 * system this is *not* attempting to be.
 *
 * **Entrance/exit are not special action categories** — "Pop Up" and
 * "Pop Down" are ordinary Actions, distinguished only by being the first
 * or last step in an encounter's sequence (see encounterTypes.ts). An
 * Action's `visible` flag (false = hidden + hitbox disabled) is what
 * expresses "disappear," which composes with a later differently-positioned
 * step to produce teleporting.
 */
import type { Vec2 } from "./encounterTypes";

// ── Weapons (owned by a Part, spawn a Unit as their projectile) ──────────

export type WeaponAimMode = "fixed" | "player";
export type WeaponSpacing = "even" | "random";

export interface WeaponDef {
  id: string;
  name: string;
  aimMode: WeaponAimMode;
  /** Only meaningful when aimMode === "player" — continuously track vs. snapshot the player's position once at fire time. Not simulated in the editor's live preview (no live player exists at authoring time), same approximation the Unit-level turnRate already accepts. */
  trackPlayer: boolean;
  /** Base aim angle in degrees, used when aimMode === "fixed" — overridable per-placement via a draggable handle, see encounterTypes.ts's EncounterAttack.aimAngleOverride. */
  fixedAngleDeg: number;
  /** Arc range in degrees, relative to the aim direction — e.g. -30/+30 for a narrow fan, 0/360 for a full radial burst, 5/355 for a burst with a deliberate gap at the aim direction. */
  arcStartDeg: number;
  arcEndDeg: number;
  /** Shots per burst, spread across the arc range. 1 with a zero-width arc is a plain single shot. */
  count: number;
  spacing: WeaponSpacing;
  /** Time between individual shots within one burst, ms — 0 = simultaneous. Distinct from fireIntervalMs, the time between bursts. */
  perShotDelayMs: number;
  /** Arc rotation speed, degrees/sec — 0 = static arc; nonzero sweeps the whole arc over time (this is what "rotating fire" reduces to, not a separate aim mode). */
  sweepSpeedDeg: number;
  /** Oscillate the sweep between its arc bounds instead of rotating continuously. */
  pingPong: boolean;
  /** Time between bursts, ms — 0 = fires once (no repeat) for as long as the placing EncounterAttack's durationMs allows. */
  fireIntervalMs: number;
  /** Wind-up before firing, ms — shown as a distinct telegraph color on the timeline. */
  telegraphMs: number;
  /** The Unit this weapon spawns as its projectile — null = not yet configured (weapon does nothing). Any Unit in the library is eligible, including one with its own Parts/Weapons, which is what makes splitting/recursive fire free. */
  spawnUnitId: string | null;
  /** Simple flat multiplier applied to the spawned Unit (size, etc.) — deliberately simple for now, see shmup-editor.todo.md. */
  spawnScale: number;
}

export function makeWeaponId(): string {
  return `weapon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Defaults to spawning the seeded default Bullet Unit (below) rather than `null` — a brand-new Weapon does something visible/testable immediately instead of silently firing nothing, same "reduce zero-default friction" motivation as the seeded Bullet Unit itself. */
export function createBlankWeapon(existingCount: number): WeaponDef {
  return {
    id: makeWeaponId(),
    name: `Weapon ${existingCount + 1}`,
    aimMode: "player",
    trackPlayer: false,
    fixedAngleDeg: 90,
    arcStartDeg: 0,
    arcEndDeg: 0,
    count: 1,
    spacing: "even",
    perShotDelayMs: 0,
    sweepSpeedDeg: 0,
    pingPong: false,
    fireIntervalMs: 1000,
    telegraphMs: 0,
    spawnUnitId: DEFAULT_BULLET_UNIT_ID,
    spawnScale: 1,
  };
}

// ── Parts (named anchor points, each owning a Weapon buffet) ─────────────

export interface UnitPart {
  id: string;
  name: string;
  /** Position offset from the Unit's own origin — anchors this part's weapons and their aim handle, e.g. a turret mounted forward of a battleship's center. */
  offset: Vec2;
  /** Optional sprite so a Part can render/reposition visually (PartEditor.tsx's position editor) — "none" = invisible, just a logical anchor for its Weapons. */
  spriteId: string;
  customSprite: string | null;
  weapons: WeaponDef[];
}

export function makePartId(): string {
  return `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** The mandatory baseline every Unit is seeded with, so a fresh Unit has somewhere to hang a Weapon without extra authoring for the common single-weapon-system case. */
export function createDefaultPart(): UnitPart {
  return { id: makePartId(), name: "Main", offset: { x: 0, y: 0 }, spriteId: "none", customSprite: null, weapons: [] };
}

export function createBlankPart(existingCount: number): UnitPart {
  return { id: makePartId(), name: `Part ${existingCount + 1}`, offset: { x: 0, y: 0 }, spriteId: "none", customSprite: null, weapons: [] };
}

// ── Actions (movement/animation buffet — no attack field, see file header) ─

export type AnimationState = "idle" | "moving" | "attacking" | "dying";
export const ANIMATION_STATES: AnimationState[] = ["idle", "moving", "attacking", "dying"];

export interface ActionDef {
  id: string;
  name: string;
  animationState: AnimationState;
  /** false = hidden + hitbox disabled — what "Disappear"/teleport-out/pop-down are made of. */
  visible: boolean;
}

export function makeActionId(): string {
  return `action-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** The mandatory baseline every Unit is seeded with, so an encounter's action picker is never empty for a freshly authored Unit. */
export function createIdleAction(): ActionDef {
  return { id: makeActionId(), name: "Idle", animationState: "idle", visible: true };
}

export function createBlankAction(existingCount: number): ActionDef {
  return { id: makeActionId(), name: `Action ${existingCount + 1}`, animationState: "idle", visible: true };
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
  /** Travel speed along its encounter steps' bezier curves, px/sec — see file header. */
  speed: number;
  /** Caps how far a step's bezier handle can extend, as a multiple of that segment's straight-line length (1 = up to 100%). Higher = tighter/sharper turns allowed. */
  turnRate: number;
  /** Hitbox radius, px. */
  size: number;
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
    actions: [createIdleAction()],
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
 * blank Unit picker — the single most common thing a Weapon spawns is
 * some kind of generic projectile, and authoring one from scratch before
 * you can test *anything* about attacks was real friction.
 */
export function createDefaultBulletUnit(): UnitDef {
  const now = Date.now();
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
    actions: [createIdleAction()],
    parts: [createDefaultPart()],
    createdAt: now,
    modifiedAt: now,
  };
}

/** The full default Unit library a brand-new/reset session starts with. */
export function createDefaultUnitLibrary(): UnitDef[] {
  return [createDefaultBulletUnit()];
}
