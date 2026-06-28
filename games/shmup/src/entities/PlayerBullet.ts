import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";
import type { Enemy } from "./Enemy";
import type { ShmupPlayScene } from "./types";

/**
 * Pooled player projectile. One bullet is either:
 * - a decaying pierce "line" (`fireLine`) — each impact applies the next
 *   `tailHitFractions` entry, in order, then recycles once exhausted, or
 * - a forked "infinite" line (`fireForkedLine`) — full damage every impact,
 *   capped by `TUNING.weapons.maxHitsPerInfiniteBullet` rather than decaying
 *   (weapons.spec.todo.md's fork-overflow behavior).
 *
 * `baseHit` is the already-crit-resolved damage for this shot (crit is
 * rolled once per shot fired, never re-rolled per pierce impact/fork —
 * combat.spec.todo.md). Blast radius is a real spatial query the scene runs
 * against the enemies group on each fresh impact this bullet registers, not
 * something the bullet itself queries.
 *
 * Homing (see TUNING.homing) is the one piece of steering the bullet does
 * own: it searches/turns toward a locked enemy in its own preUpdate, decaying
 * the same way damage decays on a finite pierce line and never decaying on
 * an infinite forked one.
 */
export class PlayerBullet extends Phaser.Physics.Arcade.Sprite {
  baseHit = 0;
  /** Crits are resolved once per shot fired (combat.spec.todo.md) and shared by every line/fork that shot spawns — carried here purely for floating-combat-text display. */
  numCrits = 0;
  blastRadius = 0;
  blastDamageFraction = 0;
  private fractions: number[] = [];
  private fractionIndex = 0;
  private infinite = false;
  private hitsRemaining = 0;
  private readonly hitSet = new Set<Enemy>();
  /** Set once per shot; decays on finite pierce lines the same way damage decays (TUNING.homing doc comment). Forked "infinite" lines never decay it, same as they never decay damage. */
  private baseHomingStrength = 0;
  private homingStrength = 0;
  private lockedTarget: Enemy | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
  }

  fireLine(
    x: number,
    y: number,
    vx: number,
    vy: number,
    baseHit: number,
    numCrits: number,
    fractions: number[],
    blastRadius: number,
    blastDamageFraction: number,
    homingStrength: number
  ): void {
    this.reset(x, y, vx, vy, baseHit, numCrits, blastRadius, blastDamageFraction, homingStrength);
    this.infinite = false;
    this.fractions = fractions;
    this.fractionIndex = 0;
  }

  fireForkedLine(
    x: number,
    y: number,
    vx: number,
    vy: number,
    baseHit: number,
    numCrits: number,
    hitsAllowed: number,
    blastRadius: number,
    blastDamageFraction: number,
    homingStrength: number
  ): void {
    this.reset(x, y, vx, vy, baseHit, numCrits, blastRadius, blastDamageFraction, homingStrength);
    this.infinite = true;
    this.hitsRemaining = hitsAllowed;
  }

  private reset(
    x: number,
    y: number,
    vx: number,
    vy: number,
    baseHit: number,
    numCrits: number,
    blastRadius: number,
    blastDamageFraction: number,
    homingStrength: number
  ): void {
    this.baseHit = baseHit;
    this.numCrits = numCrits;
    this.blastRadius = blastRadius;
    this.blastDamageFraction = blastDamageFraction;
    this.baseHomingStrength = homingStrength;
    this.homingStrength = homingStrength;
    this.lockedTarget = null;
    this.hitSet.clear();
    this.setPosition(x, y);
    this.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    this.setActive(true);
    this.setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(vx, vy);
  }

  /** True once this bullet has already damaged `enemy` — it should pass through without re-hitting it. */
  hasHit(enemy: Enemy): boolean {
    return this.hitSet.has(enemy);
  }

  /**
   * Registers a fresh impact against `enemy`. Returns the damage fraction
   * (relative to `baseHit`) to apply, or undefined if `enemy` was already
   * hit by this bullet. Recycles the bullet once its pierce/hits are spent.
   */
  registerHit(enemy: Enemy): number | undefined {
    if (this.hitSet.has(enemy)) return undefined;
    this.hitSet.add(enemy);

    if (this.infinite) {
      this.hitsRemaining -= 1;
      if (this.hitsRemaining <= 0) this.recycle();
      return 1;
    }

    const fraction = this.fractions[this.fractionIndex];
    this.fractionIndex += 1;
    // Homing decays exactly like damage: the next leg of flight uses
    // whatever tailHitFraction will apply to the next hit (0 once spent).
    this.homingStrength = this.baseHomingStrength * (this.fractions[this.fractionIndex] ?? 0);
    if (this.fractionIndex >= this.fractions.length) this.recycle();
    return fraction;
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
      return;
    }
    this.updateHoming(delta / 1000);
  }

  /**
   * Lock-on is sticky (design discussion, F6 #134): once locked, this bullet
   * keeps turning toward `lockedTarget` until it dies, never re-targeting
   * mid-flight. While unlocked it searches a circle that leads its own
   * heading (TUNING.homing doc comment) so it can't lock onto something
   * it's already flown past.
   */
  private updateHoming(dt: number): void {
    if (this.homingStrength <= 0) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed <= 0) return;

    if (this.lockedTarget && !this.lockedTarget.active) this.lockedTarget = null;
    if (!this.lockedTarget) {
      this.lockedTarget = this.findTarget(body, speed);
      if (!this.lockedTarget) return;
    }

    const turnRateDegPerSec = Math.min(
      TUNING.homing.maxTurnRateDegPerSec,
      TUNING.homing.turnRateDegPerSecPerStrength * this.homingStrength
    );
    const currentAngle = Math.atan2(body.velocity.y, body.velocity.x);
    const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, this.lockedTarget.x, this.lockedTarget.y);
    const newAngle = Phaser.Math.Angle.RotateTo(
      currentAngle,
      targetAngle,
      Phaser.Math.DegToRad(turnRateDegPerSec) * dt
    );
    body.setVelocity(Math.cos(newAngle) * speed, Math.sin(newAngle) * speed);
    this.setRotation(newAngle + Math.PI / 2);
  }

  private findTarget(body: Phaser.Physics.Arcade.Body, speed: number): Enemy | null {
    const radius = Math.min(TUNING.homing.maxRadiusPx, speed * TUNING.homing.seekAheadSeconds * this.homingStrength);
    if (radius <= 0) return null;
    const dirX = body.velocity.x / speed;
    const dirY = body.velocity.y / speed;
    const centerX = this.x + dirX * radius;
    const centerY = this.y + dirY * radius;

    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const enemy of (this.scene as ShmupPlayScene).enemies.getChildren() as Enemy[]) {
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(centerX, centerY, enemy.x, enemy.y);
      if (dist <= radius && dist < bestDist) {
        best = enemy;
        bestDist = dist;
      }
    }
    return best;
  }
}
