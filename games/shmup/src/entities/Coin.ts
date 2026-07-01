import Phaser from "phaser";
import { GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";

/**
 * Physical gold (economy.spec.todo.md): enemies explode into coins the
 * player must catch, not an automatic pickup. Pooled like EnemyBullet/Enemy
 * — `spawn()` reactivates a recycled instance rather than allocating a new
 * sprite per kill.
 *
 * Coins "pop" on spawn (Twin Bee bell-style) — always some upward velocity
 * plus random horizontal velocity, then `coinGravity` arcs them back down —
 * rather than sitting inert at the kill point. This is what makes catching
 * one a skill/positioning act, not a guaranteed pickup: a coin that pops far
 * from the player, or falls before Magnet Radius reaches it, is lost.
 * Bouncing off the left/right world bounds (`Enemy.ts`'s boss uses the same
 * `setCollideWorldBounds` + `setBounce(1, 0)` pattern) keeps a coin from
 * being unfairly lost off the sides; falling off the bottom is NOT
 * bounced — `checkCollision.down = false` lets it sail past the bottom edge
 * so `preUpdate`'s off-screen check can recycle it, same as it always has.
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
    body.setAllowGravity(true);
    body.setGravityY(TUNING.economy.coinGravity);
    body.setCollideWorldBounds(true);
    body.setBounce(1, 0); // reflect off left/right walls; no vertical bounce
    body.checkCollision.up = false; // free to pop above the top edge
    body.checkCollision.down = false; // falling off the bottom is a loss, not a bounce

    const { coinPopSpeedYMin, coinPopSpeedYMax, coinPopSpeedXMax } = TUNING.economy;
    const vy = -Phaser.Math.FloatBetween(coinPopSpeedYMin, coinPopSpeedYMax); // always up (negative y)
    const vx = Phaser.Math.FloatBetween(-coinPopSpeedXMax, coinPopSpeedXMax); // equally likely left/right
    body.setVelocity(vx, vy);
  }

  /** Hands off from the pop/gravity/bounce arc to PlayScene's direct-position homing once Magnet Radius locks on — the two motion modes never run in the same frame. */
  startHoming(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
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
