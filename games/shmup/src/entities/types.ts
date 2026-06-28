import type Phaser from "phaser";
import type { Player } from "./Player";

/**
 * Structural contract PlayScene satisfies. Lets pooled entities (Enemy,
 * EnemyBullet, PlayerBullet) read the player's resolved stats (e.g.
 * Reflexes, for the enemy bullet/move slow channels) and the live enemy
 * group (homing's target search) without importing PlayScene itself and
 * creating a scenes <-> entities import cycle.
 */
export interface ShmupPlayScene extends Phaser.Scene {
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
}
