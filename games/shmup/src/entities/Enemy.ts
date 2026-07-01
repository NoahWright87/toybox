import Phaser from "phaser";
import { TUNING } from "../tuning";
import { GAME_HEIGHT } from "../config";
import { reflexMoveSpeedMult } from "../systems/combat";
import type { EnemyArchetypeId, ScaledEnemyStats } from "../systems/difficulty";
import type { ShmupPlayScene } from "./types";

/**
 * Pooled enemy (run-structure.spec.todo.md's Difficulty (D) scaling, F8
 * #136). Stat-flat only, no armor/evasion/shield — enemies don't have an F3
 * stat pool. `spawn()` takes stats already scaled by `systems/difficulty`
 * (per-stat curves + per-archetype emphasis) at the current D, so this class
 * has no D/curve math of its own — it just carries the numbers.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private static nextSpawnId = 1;

  hp = 0;
  maxHp = 0;
  archetype: EnemyArchetypeId = "drone";
  scoreValue = 0;
  contactDamage = 0;
  bulletDamage = 0;
  bulletSpeed = 0;
  private moveSpeedValue = 0;
  /** Identifies this enemy's current life, not the pooled object — bullets must track hits by this, not by object reference, since the underlying sprite is reused across spawns (Group.get() recycling). */
  spawnId = 0;
  private fireCooldownMs = 0;
  private fireIntervalMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
  }

  spawn(x: number, y: number, archetype: EnemyArchetypeId, stats: ScaledEnemyStats): void {
    this.archetype = archetype;
    this.hp = stats.maxHp;
    this.maxHp = stats.maxHp;
    this.scoreValue = stats.scoreValue;
    this.contactDamage = stats.contactDamage;
    this.bulletDamage = stats.bulletDamage;
    this.bulletSpeed = stats.bulletSpeed;
    this.moveSpeedValue = stats.speed;
    this.fireIntervalMs = stats.fireIntervalMs;
    this.fireCooldownMs = stats.fireIntervalMs;
    this.spawnId = Enemy.nextSpawnId++;
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    if (archetype === "boss") {
      // A boss holds its lane and patrols side to side instead of streaming
      // off the bottom of the screen like a normal spawn.
      body.setCollideWorldBounds(true);
      body.setBounce(1, 0);
      body.setVelocityX(this.moveSpeed());
    } else {
      body.setVelocity(0, this.moveSpeed());
    }
    body.debugBodyColor = TUNING.debug.hitboxColors.enemy;
    body.debugShowVelocity = false;
  }

  recycle(): void {
    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }

  /** True if this enemy's fire cooldown elapsed this frame (and resets it). */
  tryFire(dtMs: number): boolean {
    this.fireCooldownMs -= dtMs;
    if (this.fireCooldownMs <= 0) {
      this.fireCooldownMs += this.fireIntervalMs;
      return true;
    }
    return false;
  }

  private moveSpeed(): number {
    const reflexes = (this.scene as ShmupPlayScene).player?.stats.reflexes ?? 0;
    return this.moveSpeedValue * reflexMoveSpeedMult(reflexes);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    if (this.archetype === "boss") return; // holds position — no despawn-off-bottom check
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(this.moveSpeed());
    if (this.y > GAME_HEIGHT + 48) this.recycle();
  }
}
