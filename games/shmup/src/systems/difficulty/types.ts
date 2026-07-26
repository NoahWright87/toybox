/**
 * Data shapes for the master Difficulty (D) scalar (run-structure.spec.todo.md,
 * F8 #136). Pure types only; behavior lives in the sibling modules.
 */

/** The enemy archetypes composition thresholds choose between (C5 #144's batch 1: drone/elite/boss plus swarmer/turret). */
export const ENEMY_ARCHETYPE_IDS = ["drone", "elite", "boss", "swarmer", "turret"] as const;
export type EnemyArchetypeId = (typeof ENEMY_ARCHETYPE_IDS)[number];

/**
 * Which player weapons can hit this enemy (combat.spec.todo.md / C1 #140's
 * ground-only/air-only weapon targeting) — a pure data tag here; C1 owns
 * actually gating damage by it. Not tied to any visual "layer": everything
 * still occupies the same 2D field, this only decides which `WeaponDef.targetType`s
 * can connect.
 */
export const ENEMY_DOMAINS = ["ground", "air"] as const;
export type EnemyDomain = (typeof ENEMY_DOMAINS)[number];

/**
 * Generic movement pattern an archetype's per-frame motion follows
 * (run-structure.spec.todo.md's "varied movement + fire patterns" — a data
 * field a shared interpreter in `entities/Enemy.ts` switches on, not a
 * per-archetype-ID special case).
 *  - `linear`: straight down at `speed` (the original drone/elite behavior).
 *  - `sine`: descends at `speed` while weaving horizontally — amplitude/
 *    frequency authored per archetype (the swarmer's "more of them, harder
 *    to pin down" lean expressed as motion, not just a stat).
 *  - `patrol`: holds a lane and bounces side to side off the world bounds
 *    (the existing boss behavior, generalized off the `archetype === "boss"`
 *    special case it used to be).
 *  - `hover`: descends to `holdYFrac * GAME_HEIGHT`, holds position for
 *    `holdDurationMs`, then resumes a normal descent (the turret's
 *    "emplacement" read — stationary but not indefinitely, so it still
 *    exits and recycles like every other pooled enemy).
 */
export type MovementConfig =
  | { kind: "linear" }
  | { kind: "sine"; amplitudePx: number; frequencyHz: number }
  | { kind: "patrol" }
  | { kind: "hover"; holdYFrac: number; holdDurationMs: number };

/**
 * Generic enemy-bullet fire pattern (combat.spec.todo.md) — a data field a
 * shared interpreter in `scenes/PlayScene.ts`'s `fireEnemyBullet` switches
 * on, not a per-archetype special case.
 *  - `straight`: fires straight down (the original drone/elite/boss behavior).
 *  - `aimed`: fires directly at the player's current position (the elite/
 *    turret "nastier pattern" the difficulty todo spec calls for).
 *  - `spread`: fires `count` bullets fanned across `spreadDeg` around
 *    straight down.
 */
export type FirePatternConfig =
  | { kind: "straight" }
  | { kind: "aimed" }
  | { kind: "spread"; count: number; spreadDeg: number };

/** Everything the escalation formula needs to produce one D value. */
export interface DifficultyContext {
  /** 1-based Season number. */
  season: number;
  /** 0-based count of nodes already taken this Season — climbs D through a Season. */
  episodeIndex: number;
  /** Flat bonus/discount from the node itself (e.g. treasure nodes run safer). */
  stageOffset?: number;
  /** Flat bonus from risk items (items-and-brands.spec.todo.md); not wired up yet. */
  itemModifiers?: number;
  /** How far the overworld deadline has passed the player (>=0), evaluated on episode entry. */
  mapLag: number;
}

/** Base (D=0) stats one enemy archetype scales from — matches TUNING.enemies.<archetype>. */
export interface EnemyBaseStats {
  maxHp: number;
  speed: number;
  fireIntervalMs: number;
  bulletDamage: number;
  bulletSpeed: number;
  contactDamage: number;
  scoreValue: number;
  spawnIntervalMs: number;
  /** Structural, not D-scaled — carried through scaledEnemyStats() unchanged. */
  domain: EnemyDomain;
  movement: MovementConfig;
  firePattern: FirePatternConfig;
}

/** The same shape, post-D-scaling — what Enemy.spawn() actually uses. */
export type ScaledEnemyStats = EnemyBaseStats;

/** Per-archetype emphasis weights (run-structure.spec.todo.md): how much of each curve's swing this archetype actually feels. 1 = full curve response, 0 = archetype ignores that curve entirely. */
export interface ArchetypeEmphasis {
  hp: number;
  damage: number;
  speed: number;
  fireRate: number;
}
