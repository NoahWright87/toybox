/**
 * Data shapes for the master Difficulty (D) scalar (run-structure.spec.todo.md,
 * F8 #136). Pure types only; behavior lives in the sibling modules.
 */

/** The enemy archetypes composition thresholds choose between. */
export const ENEMY_ARCHETYPE_IDS = ["drone", "elite", "boss"] as const;
export type EnemyArchetypeId = (typeof ENEMY_ARCHETYPE_IDS)[number];

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
