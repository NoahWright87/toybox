/**
 * Enemy data model for the Shmup Editor (specs/shmup-editor.todo.md, E2 #192).
 * Matches specs/games/shmup/enemies-and-bullets.spec.todo.md's node-graph
 * design: nodes own state (position, dwell, branch, attack), edges own a
 * single movement behavior between two nodes. Deliberately self-contained —
 * not imported from games/shmup/src/ — same "shape compatible, code is not"
 * relationship tileTypes.ts has with the game's L1 tile model.
 *
 * The graph authored here is a strict CHAIN, not a general graph: every
 * node has at most one outgoing movement edge, created by "growing" a new
 * node off an existing one in the editor (there is no free "connect any two
 * nodes" gesture). A `BranchCondition` is the one place a second, CONDITIONAL
 * target can be reached — an HP/time threshold jump to any other node id,
 * independent of the primary chain. This matches the spec's plain-language
 * framing of movement as "a chain... across multiple nodes" while still
 * calling the whole thing a graph, since branch jumps make it not a strict
 * linked list at runtime.
 */

export interface Vec2 {
  x: number;
  y: number;
}

// ── Movement behaviors (edges + bullets) ────────────────────────────────

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
  /** Travel speed of the orbit's center point along A→B, px/sec. */
  speed: number;
  /** Orbit radius, px. */
  radius: number;
  /** Orbit angular speed, degrees/sec. */
  angularSpeed: number;
  /** Radius change per second; 0 = constant orbit, negative = tightening, positive = widening corkscrew. */
  radiusGrowth: number;
}

export interface TeleportMovement {
  kind: "teleport";
  /** Delay between vanishing at A and reappearing at B, seconds. */
  delay: number;
  /** Whether a shimmer/warning telegraphs at B before the enemy reappears. */
  telegraphAtDestination: boolean;
}

/** The 3 primitives usable by a bullet's own movement — no teleport (a bullet's "entrance"/"exit" is its spawn/expire, per spec §7). */
export type BulletMovement = StraightLineMovement | WaveMovement | SpiralMovement;

/** All 4 primitives, usable on an enemy graph edge. */
export type MovementBehavior = BulletMovement | TeleportMovement;

export function defaultStraightLine(): StraightLineMovement {
  return { kind: "straightLine", speed: 120, accel: 0, turnRate: 0 };
}
export function defaultWave(): WaveMovement {
  return { kind: "wave", speed: 100, amplitude: 40, frequency: 1, phase: 0, waveform: "smooth" };
}
export function defaultSpiral(): SpiralMovement {
  return { kind: "spiral", speed: 80, radius: 50, angularSpeed: 90, radiusGrowth: 0 };
}
export function defaultTeleport(): TeleportMovement {
  return { kind: "teleport", delay: 0.6, telegraphAtDestination: true };
}
export function defaultMovement(): MovementBehavior {
  return defaultStraightLine();
}
export function defaultBulletMovement(): BulletMovement {
  return defaultStraightLine();
}

// ── Dwell behaviors (nodes) ──────────────────────────────────────────────

export interface WaitDwell {
  kind: "wait";
  /** True = drifts with scrolling terrain (ground unit); false = holds screen position (hovering unit). */
  scrollLocked: boolean;
}

export interface OrbitDwell {
  kind: "orbit";
  scrollLocked: boolean;
  radius: number;
  angularSpeed: number;
}

export type DwellBehavior = WaitDwell | OrbitDwell;

export function defaultWaitDwell(): WaitDwell {
  return { kind: "wait", scrollLocked: false };
}
export function defaultOrbitDwell(): OrbitDwell {
  return { kind: "orbit", scrollLocked: false, radius: 40, angularSpeed: 90 };
}

// ── Exit (terminal nodes) ────────────────────────────────────────────────

export type ExitType = "leave" | "vanish" | "ram";

export interface ExitConfig {
  type: ExitType;
  /** Direction of travel, degrees (0 = right, 90 = down). Only meaningful for "leave". */
  direction: number;
}

export function defaultExitConfig(): ExitConfig {
  return { type: "leave", direction: 90 };
}

// ── Entrance appearance (entrance node only) ─────────────────────────────

export type EntranceStyle = "fade" | "shrink" | "rise";

export interface EntranceAppearance {
  kind: "none" | "appear";
  style: EntranceStyle;
  durationMs: number;
}

export function defaultEntranceAppearance(): EntranceAppearance {
  return { kind: "none", style: "fade", durationMs: 500 };
}

// ── Branch conditions (any node or edge) ─────────────────────────────────

export type BranchTrigger = "hp" | "time";

export interface BranchCondition {
  trigger: BranchTrigger;
  /** hp: fraction of max HP (0..1) at/below which the jump fires. time: seconds elapsed in the encounter at/after which the jump fires. */
  threshold: number;
  targetNodeId: string;
}

export function defaultBranchCondition(targetNodeId: string): BranchCondition {
  return { trigger: "hp", threshold: 0.25, targetNodeId };
}

// ── Attack payloads (parallel track, nodes + edges + bullets) ────────────

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
  /** Fixed firing angle in degrees, "fixed" aim only. */
  fixedAngleDeg: number;
  /** Sweep rate in degrees/sec, "rotating" aim only. */
  rotationSpeedDeg: number;
  /** Seconds between volleys, "continuous" trigger only. */
  intervalMs: number;
  /** Telegraph/wind-up duration, "onTrigger" trigger or "beam" shape. */
  telegraphMs: number;
  /** Radius, "onProximity" trigger only. */
  proximityRadius: number;
  /** The bullet this payload spawns — bullets are minimal enemies (spec §7), enabling free recursion. */
  bullet: BulletDef;
}

export interface BulletDef {
  spriteId: string;
  customSprite: string | null;
  movement: BulletMovement;
  /** A bullet's own nested attack payload (splitting bullets, etc.) — null = doesn't fire. */
  attack: AttackPayload | null;
}

export function createBlankBullet(): BulletDef {
  return {
    spriteId: "none",
    customSprite: null,
    movement: defaultBulletMovement(),
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

// ── Graph nodes/edges ─────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  pos: Vec2;
  dwell: DwellBehavior | null;
  attack: AttackPayload | null;
  branch: BranchCondition | null;
  /** Only meaningful on a leaf node (no outgoing edge) — see getLeafNodeIds. */
  exit: ExitConfig | null;
  /** Only meaningful on the entrance node — see EnemyDef.entranceNodeId. */
  entranceAppearance: EntranceAppearance | null;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  movement: MovementBehavior;
  attack: AttackPayload | null;
  branch: BranchCondition | null;
}

export interface EnemyDef {
  id: string;
  name: string;
  spriteId: string;
  customSprite: string | null;
  /** Null only for a brand new enemy with zero nodes yet. */
  entranceNodeId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  createdAt: number;
  modifiedAt: number;
}

export function makeEnemyId(): string {
  return `enemy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeNodeId(): string {
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeEdgeId(): string {
  return `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankEnemy(existingCount: number): EnemyDef {
  const now = Date.now();
  return {
    id: makeEnemyId(),
    name: `New Enemy ${existingCount + 1}`,
    spriteId: "none",
    customSprite: null,
    entranceNodeId: null,
    nodes: [],
    edges: [],
    createdAt: now,
    modifiedAt: now,
  };
}
