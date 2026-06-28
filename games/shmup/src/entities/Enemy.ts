import Phaser from "phaser";
import { TUNING } from "../tuning";
import { GAME_HEIGHT } from "../config";
import { reflexMoveSpeedMult } from "../systems/combat";
import type { ShmupPlayScene } from "./types";

/**
 * Pooled placeholder "drone" enemy (run-structure.spec.todo.md's Difficulty
 * (D) scaling owns real enemy stat curves — F8 #136). Flat HP only, no
 * armor/evasion/shield — enemies don't have an F3 stat pool yet.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  hp = 0;
  scoreValue = 0;
  private fireCooldownMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
  }

  spawn(x: number, y: number): void {
    const d = TUNING.enemies.drone;
    this.hp = d.maxHp;
    this.scoreValue = d.scoreValue;
    this.fireCooldownMs = d.fireIntervalMs;
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, this.moveSpeed());
  }

  recycle(): void {
    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }

  /** True if this drone's fire cooldown elapsed this frame (and resets it). */
  tryFire(dtMs: number): boolean {
    this.fireCooldownMs -= dtMs;
    if (this.fireCooldownMs <= 0) {
      this.fireCooldownMs += TUNING.enemies.drone.fireIntervalMs;
      return true;
    }
    return false;
  }

  private moveSpeed(): number {
    const reflexes = (this.scene as ShmupPlayScene).player?.stats.reflexes ?? 0;
    return TUNING.enemies.drone.speed * reflexMoveSpeedMult(reflexes);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(this.moveSpeed());
    if (this.y > GAME_HEIGHT + 48) this.recycle();
  }
}
