/**
 * The render stack, in one place.
 *
 * Phaser resolves ties in a display list by insertion order, so anything that
 * never calls `setDepth` sits at depth 0 in whatever order it happened to
 * spawn. That was survivable while *every* pooled entity was at 0 — bullets,
 * enemies and coins all tied, and the arbitrary ordering among them was rarely
 * noticeable — but authored units set real depths (1/2/4), so the entire
 * pooled layer silently rendered *beneath* every authored unit on the field.
 *
 * Doodads are what made it obvious: a tree canopy or a warehouse roof is a
 * large opaque sprite, so player fire visibly disappeared behind the scenery
 * it was flying over. The same bug applied to enemy bullets, which matters
 * more than it sounds — incoming fire hidden behind a doodad is a hazard you
 * cannot dodge — and to built-in enemies.
 *
 * The ordering below encodes what a shmup needs to stay readable, roughly
 * "the more urgent it is to see, the higher it goes":
 *
 * 1. Terrain and backdrop are furthest back.
 * 2. Scenery, then ground units, then air units — doodads sit under the things
 *    that fight, and ground traffic passes under air traffic.
 * 3. Projectiles clear every unit. You must always be able to see your own
 *    fire, and enemy fire sits highest of all because dodging it is the game.
 * 4. The player is above the field, and debug/HUD above that.
 *
 * Values are spaced so a Part can take `+ PART_DEPTH_OFFSET` without
 * colliding with the next layer up.
 */
export const DEPTH = {
  /** Scrolling star/space backdrop for stock episodes. */
  backdrop: -20,
  /** Authored tile terrain art (`LevelRunner`). */
  tileArt: -15,
  /** Drifting starfield — stock backdrop only; suppressed over authored terrain. */
  stars: -10,

  /** Authored `"doodad"` layer — scenery, under everything that fights. */
  doodad: 1,
  /** Authored `"ground"` layer. */
  groundUnit: 2,
  /** Built-in pooled `Enemy` — between the two authored unit layers, since stock enemies are neither strictly. */
  enemy: 3,
  /** Authored `"air"` layer. */
  airUnit: 4,

  /** Dropped gold. Above the field so it reads against terrain, below fire so it never hides a bullet. */
  coin: 6,
  /** Player shots — must clear every unit, which is the bug this table exists to fix. */
  playerBullet: 7,
  /** Incoming fire, built-in and authored alike. The highest gameplay layer: it is what the player is reading the screen for. */
  enemyProjectile: 8,

  player: 10,

  /** Arcade's physics debug graphic — over the field, under the HUD. */
  debugPhysics: 50,
  /** Score, bars, timers — the fixed HUD. */
  hud: 100,
  /** Floating combat text, which has to stay legible over the HUD it drifts across. */
  floatingText: 150,
} as const;

/** A Part renders just above the hull it is bolted to. Spacing in `DEPTH` leaves room for this without reaching the next layer. */
export const PART_DEPTH_OFFSET = 1;

/** Depth for an authored unit's layer, falling back to ground for an unrecognized one. */
export function authoredLayerDepth(layer: string): number {
  switch (layer) {
    case "doodad":
      return DEPTH.doodad;
    case "air":
      return DEPTH.airUnit;
    default:
      return DEPTH.groundUnit;
  }
}
