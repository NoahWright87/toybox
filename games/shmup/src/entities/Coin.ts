import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
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
 *
 * Left/right bounce is done manually in `preUpdate` rather than via Arcade's
 * `setCollideWorldBounds` — that flag is all-or-nothing across every edge,
 * and `Body.checkWorldBounds()` (Phaser's own source) gates it by
 * `world.checkCollision`, a setting shared by every body in the scene (the
 * player's keyboard movement relies on the World's top/bottom bounds to
 * stay on-screen), not a per-body `body.checkCollision` flag — so there's no
 * way to ask Arcade for "block left/right, but let this one body alone pass
 * through top/bottom." A coin needs exactly that: free to sail above the
 * top of the play area on the way up, and lost for good off the bottom.
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

  /**
   * Manual left/right bounce (see the class doc for why this isn't Arcade's
   * `setCollideWorldBounds`) — reflect `vx` and clamp position the instant
   * the coin's edge reaches either side. Skipped once magnetized: homing
   * drives position directly and never touches `body.velocity`, so this
   * would never trigger anyway, but the guard makes the hand-off explicit.
   */
  private bounceOffSideWalls(): void {
    if (this.magnetized) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const halfWidth = this.width / 2;
    if (this.x <= halfWidth && body.velocity.x < 0) {
      this.x = halfWidth;
      body.setVelocityX(-body.velocity.x);
    } else if (this.x >= GAME_WIDTH - halfWidth && body.velocity.x > 0) {
      this.x = GAME_WIDTH - halfWidth;
      body.setVelocityX(-body.velocity.x);
    }
  }

  /**
   * Ages the coin out after `coinLifespanSec` unclaimed, or once it's fallen
   * off the bottom of the play area — wealth is skill-gated, not a floor
   * loot pile waiting to be swept up later. Popping above the top of the
   * play area is fine and expected (Twin Bee-style); there's no matching
   * top-edge despawn, gravity always eventually brings it back down.
   */
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    this.bounceOffSideWalls();
    this.ageSec += delta / 1000;
    if (this.ageSec >= TUNING.economy.coinLifespanSec || this.y > GAME_HEIGHT + 32) {
      this.recycle();
    }
  }
}
