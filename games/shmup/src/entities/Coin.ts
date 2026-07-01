import Phaser from "phaser";
import { GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";

/**
 * Physical gold (economy.spec.todo.md): enemies explode into coins the
 * player must catch, not an automatic pickup. Pooled like EnemyBullet/Enemy
 * — `spawn()` reactivates a recycled instance rather than allocating a new
 * sprite per kill.
 */
export class Coin extends Phaser.Physics.Arcade.Sprite {
  value = 0;
  private ageSec = 0;
  /** True once within Magnet Radius and actively flying toward the player (PlayScene drives the actual steering). */
  magnetized = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
  }

  spawn(x: number, y: number, value: number): void {
    this.value = value;
    this.ageSec = 0;
    this.magnetized = false;
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, 0);
  }

  recycle(): void {
    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }

  /** Ages the coin out after `coinLifespanSec` unclaimed — wealth is skill-gated, not a floor loot pile waiting to be swept up later. */
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    this.ageSec += delta / 1000;
    if (this.ageSec >= TUNING.economy.coinLifespanSec || this.y > GAME_HEIGHT + 32) {
      this.recycle();
    }
  }
}
