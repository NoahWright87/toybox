import Phaser from "phaser";
import { TUNING } from "../tuning";
import { GAME_HEIGHT } from "../config";
import { reflexMoveSpeedMult } from "../systems/combat";
import type { EnemyArchetypeId, EnemyDomain, FirePatternConfig, MovementConfig, ScaledEnemyStats } from "../systems/difficulty";
import type { Polarity } from "../systems/chassis";
import type { ShmupPlayScene } from "./types";

const DEFAULT_MOVEMENT: MovementConfig = { kind: "linear" };
const DEFAULT_FIRE_PATTERN: FirePatternConfig = { kind: "straight" };

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
  /** Which player weapons can hit this enemy (combat.spec.todo.md / C1 #140's ground-only/air-only weapon targeting) — a pure data tag; C1 owns actually gating damage by it. */
  domain: EnemyDomain = "air";
  /** How this enemy moves each frame (run-structure.spec.todo.md's "varied movement patterns") — interpreted generically in `preUpdate`, never a per-archetype-ID special case. */
  movement: MovementConfig = DEFAULT_MOVEMENT;
  /** How this enemy's bullets fire (combat.spec.todo.md) — interpreted generically by `PlayScene.fireEnemyBullet`. */
  firePattern: FirePatternConfig = DEFAULT_FIRE_PATTERN;
  /** Assigned every spawn regardless of the equipped chassis (chassis.spec.md's Ikaruga flagship example) — inert unless the player's chassis actually declares a `polarity` mechanic, in which case it gates damage from player shots. */
  polarity: Polarity = "red";
  private moveSpeedValue = 0;
  /** Elapsed time since spawn, ms — drives the "sine" movement pattern's horizontal weave. */
  private moveElapsedMs = 0;
  /** "hover" movement pattern's phase: descend to the hold line, hold in place, then resume a normal descent (so it still exits and recycles like every other pooled enemy). */
  private hoverPhase: "descending" | "holding" | "resumed" = "descending";
  private hoverElapsedMs = 0;
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
    this.domain = stats.domain;
    this.movement = stats.movement;
    this.firePattern = stats.firePattern;
    this.moveElapsedMs = 0;
    this.hoverPhase = "descending";
    this.hoverElapsedMs = 0;
    this.fireIntervalMs = stats.fireIntervalMs;
    this.fireCooldownMs = stats.fireIntervalMs;
    this.spawnId = Enemy.nextSpawnId++;
    this.polarity = Math.random() < 0.5 ? "red" : "blue";
    this.applyPolarityTint();
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    if (this.movement.kind === "patrol") {
      // Holds its lane and patrols side to side instead of streaming off the
      // bottom of the screen like a normal spawn.
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

  /** Only visually tints by polarity when the equipped chassis actually uses it — a polarity-agnostic chassis (e.g. DEFAULT_CHASSIS) never shows a meaningless red/blue split. */
  private applyPolarityTint(): void {
    const chassis = (this.scene as ShmupPlayScene).player?.chassis;
    if (!chassis?.polarity) {
      this.clearTint();
      return;
    }
    this.setTintFill(TUNING.chassis.polarityColors[this.polarity]);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    const movement = this.movement;
    if (movement.kind === "patrol") return; // holds its lane — no despawn-off-bottom check
    const body = this.body as Phaser.Physics.Arcade.Body;
    switch (movement.kind) {
      case "sine": {
        this.moveElapsedMs += delta;
        const angularFreq = movement.frequencyHz * Math.PI * 2;
        const vx = movement.amplitudePx * angularFreq * Math.cos(angularFreq * (this.moveElapsedMs / 1000));
        body.setVelocity(vx, this.moveSpeed());
        break;
      }
      case "hover":
        if (this.hoverPhase === "descending") {
          body.setVelocity(0, this.moveSpeed());
          if (this.y >= movement.holdYFrac * GAME_HEIGHT) {
            body.setVelocity(0, 0);
            this.hoverPhase = "holding";
            this.hoverElapsedMs = 0;
          }
        } else if (this.hoverPhase === "holding") {
          this.hoverElapsedMs += delta;
          if (this.hoverElapsedMs >= movement.holdDurationMs) this.hoverPhase = "resumed";
        } else {
          body.setVelocity(0, this.moveSpeed());
        }
        break;
      case "linear":
      default:
        body.setVelocityY(this.moveSpeed());
        break;
    }
    if (this.y > GAME_HEIGHT + 48) this.recycle();
  }
}
