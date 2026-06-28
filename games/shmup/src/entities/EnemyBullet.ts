import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";

/** Pooled enemy bullet — fixed damage, no pierce/blast (those are player-weapon-only mechanics). */
export class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
  damage = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
  }

  fire(x: number, y: number, vx: number, vy: number, damage: number): void {
    this.damage = damage;
    this.setPosition(x, y);
    this.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    this.setActive(true);
    this.setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(vx, vy);
  }

  recycle(): void {
    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    if (this.y < -32 || this.y > GAME_HEIGHT + 32 || this.x < -32 || this.x > GAME_WIDTH + 32) {
      this.recycle();
    }
  }
}
