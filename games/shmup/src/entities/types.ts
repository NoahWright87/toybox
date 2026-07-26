import type Phaser from "phaser";
import type { Polarity } from "../systems/chassis";
import type { Player } from "./Player";

/**
 * Anything a player shot can hit. Two very different things satisfy it: the
 * built-in pooled `Enemy` (ambient spawns, bosses) and `AuthoredUnit`
 * (everything `/shmup-editor` authored — enemies, their hittable Parts, and
 * enemy projectiles, since in that model a projectile is just a Unit).
 *
 * `applyDamage` is a method rather than a bare `hp` field because *where*
 * the HP lives isn't the shooter's business: a Part with `hasHitbox` but no
 * `hasHealth` passes damage straight through to the hull it's bolted to, so
 * the thing that dies is not always the thing that was hit. Returning the
 * entity that actually died is what lets `PlayScene` pay out score, EXP and
 * coins at the right place without knowing any of that.
 */
export interface PlayerTarget extends Phaser.GameObjects.GameObject {
  x: number;
  y: number;
  /** Identifies this *life*, not the pooled object — see `spawnId.ts`. */
  spawnId: number;
  /** Gates damage from player shots when a polarity chassis is equipped; inert otherwise. */
  polarity: Polarity;
  /** Applied at this impact point: >1 = weak point, <1 = reinforced armor. 1 for anything without authored armor zones. */
  damageMultiplier: number;
  scoreValue: number;
  contactDamage: number;
  /** Applies `amount` and returns whatever died as a result (this, a parent hull, or null if nothing died). */
  applyDamage(amount: number): PlayerTarget | null;
  recycle(): void;
}

/**
 * Structural contract PlayScene satisfies. Lets pooled entities (Enemy,
 * EnemyBullet, PlayerBullet, AuthoredUnit) read the player's resolved stats
 * (e.g. Reflexes, for the enemy bullet/move slow channels) and the current
 * target list (homing's target search) without importing PlayScene itself
 * and creating a scenes <-> entities import cycle.
 */
export interface ShmupPlayScene extends Phaser.Scene {
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  /** Every currently-active thing a player shot may hit — built-in enemies plus any authored ones. */
  playerTargets(): PlayerTarget[];
}
