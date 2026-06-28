import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import type { Enemy } from "./Enemy";

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
    blastDamageFraction: number
  ): void {
    this.reset(x, y, vx, vy, baseHit, numCrits, blastRadius, blastDamageFraction);
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
    blastDamageFraction: number
  ): void {
    this.reset(x, y, vx, vy, baseHit, numCrits, blastRadius, blastDamageFraction);
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
    blastDamageFraction: number
  ): void {
    this.baseHit = baseHit;
    this.numCrits = numCrits;
    this.blastRadius = blastRadius;
    this.blastDamageFraction = blastDamageFraction;
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
    }
  }
}
