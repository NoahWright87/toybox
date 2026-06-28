import type Phaser from "phaser";
import type { Player } from "./Player";

/**
 * Structural contract PlayScene satisfies. Lets pooled entities (Enemy,
 * EnemyBullet) read the player's resolved stats (e.g. Reflexes, for the
 * enemy bullet/move slow channels) without importing PlayScene itself and
 * creating scenes <-> entities import cycle.
 */
export interface ShmupPlayScene extends Phaser.Scene {
  player: Player;
}
