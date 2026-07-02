import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";
import type { Polarity } from "../systems/chassis";
import type { ShmupPlayScene } from "./types";

/** Pooled enemy bullet — fixed damage, no pierce/blast (those are player-weapon-only mechanics). */
export class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
  private static nextSpawnId = 1;

  damage = 0;
  /** Inherited from the firing enemy (chassis.spec.md's Ikaruga flagship example) — inert unless the player's chassis declares a `polarity` mechanic, in which case a same-polarity bullet is absorbed instead of damaging the player. */
  polarity: Polarity = "red";
  /** Identifies this bullet's current life, not the pooled object — grazing (F7 #135) must track relationships by this, not by object reference, since the underlying sprite is reused across fires (Group.get() recycling). */
  spawnId = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
  }

  fire(x: number, y: number, vx: number, vy: number, damage: number, polarity: Polarity = "red"): void {
    this.damage = damage;
    this.polarity = polarity;
    this.spawnId = EnemyBullet.nextSpawnId++;
    this.setPosition(x, y);
    this.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    this.setActive(true);
    this.setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(vx, vy);
    body.debugBodyColor = TUNING.debug.hitboxColors.enemyBullet;
    body.debugShowVelocity = false;
    const chassis = (this.scene as ShmupPlayScene).player?.chassis;
    if (chassis?.polarity) this.setTintFill(TUNING.chassis.polarityColors[polarity]);
    else this.clearTint();
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
