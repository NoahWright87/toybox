/**
 * Unit data model for the Shmup Editor (specs/shmup-editor.todo.md, E2 #192
 * — reworked per the "Design Handoff v2" doc after real usability friction
 * with the encounter-owns-everything version). Deliberately self-contained
 * — not imported from games/shmup/src/.
 *
 * A Unit (renamed from Enemy — also covers non-combatant doodads/loot) is
 * sprite + stats + a reusable **buffet of Actions**, authored once and
 * selected repeatedly across encounters. This replaces the previous
 * design where behavior lived entirely on the encounter: attacks are very
 * enemy-specific in practice (a helicopter with missile pods always has
 * missile pods, wherever it appears), so authoring them once per Unit and
 * *selecting* them per placement removes the repetition tax the old
 * design had — an encounter no longer hand-rolls every field for every
 * placement, it just picks from the buffet and sets a trigger.
 *
 * **Dwell dissolves into `movement: null`** — a step whose action has no
 * movement just holds its current position; there's no separate
 * wait/orbit distinction anymore (orbit-in-place is just a `spiral`
 * movement whose net displacement happens to be small).
 *
 * **Entrance/exit are not special action categories** — "Pop Up" and
 * "Pop Down" are ordinary Actions, distinguished only by being the first
 * or last step in an encounter's sequence (see encounterTypes.ts). An
 * Action's `visible` flag (false = hidden + hitbox disabled) is what
 * expresses "disappear," which composes with a later differently-positioned
 * step to produce teleporting — so there's no dedicated Teleport movement
 * kind anymore either.
 */

// ── Movement behaviors ───────────────────────────────────────────────────

export type Waveform = "smooth" | "triangle" | "square";

export interface StraightLineMovement {
  kind: "straightLine";
  /** Base travel speed, px/sec. */
  speed: number;
  /** Change in speed per second; negative eventually reverses direction (boomerang out-and-back). */
  accel: number;
  /** Degrees/sec turned toward the player's position; 0 = perfectly straight. Nonzero is what makes this "homing" — not a separate movement kind. */
  turnRate: number;
}

export interface WaveMovement {
  kind: "wave";
  /** Travel speed along the base A→B path, px/sec. */
  speed: number;
  /** Perpendicular oscillation amplitude, px. */
  amplitude: number;
  /** Oscillation frequency, cycles/sec. */
  frequency: number;
  /** Phase offset, 0..1 of one cycle. */
  phase: number;
  waveform: Waveform;
}

export interface SpiralMovement {
  kind: "spiral";
  /** Travel speed of the orbit's center point along A→B, px/sec — near-zero net displacement reads as "orbit in place." */
  speed: number;
  /** Orbit radius, px. */
  radius: number;
  /** Orbit angular speed, degrees/sec. */
  angularSpeed: number;
  /** Radius change per second; 0 = constant orbit, negative = tightening, positive = widening corkscrew. */
  radiusGrowth: number;
}

/** The 3 movement primitives — no dedicated Teleport kind; see file header. */
export type MovementBehavior = StraightLineMovement | WaveMovement | SpiralMovement;

export function defaultStraightLine(): StraightLineMovement {
  return { kind: "straightLine", speed: 120, accel: 0, turnRate: 0 };
}
export function defaultWave(): WaveMovement {
  return { kind: "wave", speed: 100, amplitude: 40, frequency: 1, phase: 0, waveform: "smooth" };
}
export function defaultSpiral(): SpiralMovement {
  return { kind: "spiral", speed: 80, radius: 50, angularSpeed: 90, radiusGrowth: 0 };
}
export function defaultMovement(): MovementBehavior {
  return defaultStraightLine();
}

// ── Attack payloads (independent of movement, optional per Action) ───────

export type PatternShape = "single" | "arc" | "radialBurst" | "beam";
export type AimMode = "fixed" | "aimed" | "rotating";
export type AttackTrigger = "continuous" | "onDeath" | "onTrigger" | "onProximity";

export interface AttackPayload {
  enabled: boolean;
  shape: PatternShape;
  aim: AimMode;
  trigger: AttackTrigger;
  /** Projectiles per volley; 1 for "single", fan count for "arc"/"radialBurst". */
  projectileCount: number;
  /** Total angular spread in degrees, "arc" only. */
  arcSpreadDeg: number;
  /** Fixed firing angle in degrees, "fixed" aim only — overridable per-placement, see encounterTypes.ts's EncounterStep.aimAngleOverride. */
  fixedAngleDeg: number;
  /** Sweep rate in degrees/sec, "rotating" aim only. */
  rotationSpeedDeg: number;
  /** Seconds between volleys, "continuous" trigger only. */
  intervalMs: number;
  /** Telegraph/wind-up duration, "onTrigger" trigger or "beam" shape. */
  telegraphMs: number;
  /** Radius, "onProximity" trigger only. */
  proximityRadius: number;
  /** The bullet this payload spawns — bullets are minimal Units (spec §7), enabling free recursion. */
  bullet: BulletDef;
}

export interface BulletDef {
  spriteId: string;
  customSprite: string | null;
  movement: MovementBehavior;
  /** A bullet's own nested attack payload (splitting bullets, etc.) — null = doesn't fire. */
  attack: AttackPayload | null;
}

export function createBlankBullet(): BulletDef {
  return {
    spriteId: "none",
    customSprite: null,
    movement: defaultMovement(),
    attack: null,
  };
}

export function createBlankAttackPayload(): AttackPayload {
  return {
    enabled: true,
    shape: "single",
    aim: "aimed",
    trigger: "continuous",
    projectileCount: 1,
    arcSpreadDeg: 45,
    fixedAngleDeg: 90,
    rotationSpeedDeg: 60,
    intervalMs: 1000,
    telegraphMs: 400,
    proximityRadius: 150,
    bullet: createBlankBullet(),
  };
}

// ── Actions (the reusable buffet) ─────────────────────────────────────────

export type AnimationState = "idle" | "moving" | "attacking" | "dying";
export const ANIMATION_STATES: AnimationState[] = ["idle", "moving", "attacking", "dying"];

export interface ActionDef {
  id: string;
  name: string;
  /** null = stationary (no movement component) — see file header. */
  movement: MovementBehavior | null;
  attack: AttackPayload | null;
  animationState: AnimationState;
  /** false = hidden + hitbox disabled — what "Disappear"/teleport-out/pop-down are made of. */
  visible: boolean;
}

export function makeActionId(): string {
  return `action-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** The mandatory baseline every Unit is seeded with, so an encounter's action picker is never empty for a freshly authored Unit. */
export function createIdleAction(): ActionDef {
  return { id: makeActionId(), name: "Idle", movement: null, attack: null, animationState: "idle", visible: true };
}

export function createBlankAction(existingCount: number): ActionDef {
  return { id: makeActionId(), name: `Action ${existingCount + 1}`, movement: null, attack: null, animationState: "idle", visible: true };
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
  baseSpeed: number;
  /** Hitbox radius, px. */
  size: number;
  actions: ActionDef[];
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
    baseSpeed: 120,
    size: 16,
    actions: [createIdleAction()],
    createdAt: now,
    modifiedAt: now,
  };
}
