import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";
import type { Polarity } from "../systems/chassis";
import type { PlayerTarget, ShmupPlayScene } from "./types";
import { DEPTH } from "../systems/depth";

/**
 * Pooled player projectile. One bullet is either:
 * - a decaying pierce "line" (`fireLine`) — each impact applies the next
 *   `tailHitFractions` entry, in order, then recycles once exhausted, or
 * - a forked "infinite" line (`fireForkedLine`) — full damage every impact,
 *   capped by `TUNING.weapons.maxHitsPerInfiniteBullet` rather than decaying
 *   (weapons.spec.todo.md's fork-overflow behavior).
 *
 * Forks aren't spawned at the muzzle — weapons.spec.todo.md's "forked
 * projectiles inherit the firing projectile's hit-list" only makes sense if
 * a fork is born from an impact the line has already scored. Either kind of
 * bullet carries `pendingForkCount` (how many more chain links remain) and
 * hands it to the scene via `takePendingForks()` on its first registered
 * hit; the scene spawns exactly one `fireForkedLine` bullet from that impact
 * point, pre-seeded with the just-hit enemy so it can't re-hit it, and
 * carrying `pendingForkCount - 1` so the chain keeps recursing as long as
 * each new fork keeps landing impacts of its own (weapons.spec.todo.md: "That
 * forked projectile resolves the same rule recursively"). A chain link that
 * never lands a hit ends the chain early — pierce above 100% only describes
 * the *maximum* chain depth, not a guaranteed simultaneous spawn count.
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
  /** The firing player's polarity at the moment this shot was fired (chassis.spec.md's Ikaruga flagship example), baked in like crit so a mid-flight polarity switch doesn't retroactively change an already-fired shot. Null when the equipped chassis has no polarity mechanic — always resolves to no damage gating (`polarityDamageMultiplier`). */
  shotPolarity: Polarity | null = null;
  blastRadius = 0;
  blastDamageFraction = 0;
  /** Speed to give any fork spawned from this line's first impact (the firing weapon's projectileSpeed) — carried forward to each chain link so the whole chain shares one projectile speed. */
  forkProjectileSpeed = 0;
  /** Cone width (degrees) any fork spawned from this line's first impact should spread its heading within, centered on this bullet's heading at that impact — carried forward to each chain link. */
  forkConeDeg = 0;
  private fractions: number[] = [];
  private fractionIndex = 0;
  private infinite = false;
  private hitsRemaining = 0;
  /** Tracks `PlayerTarget.spawnId`, not the object itself — target sprites are pooled and reused across spawns, so an object-reference Set would risk a later, logically-different target reusing the same pooled object and being skipped as "already hit". */
  private readonly hitSet = new Set<number>();
  /** Set once per shot; decays on finite pierce lines the same way damage decays (TUNING.homing doc comment). Forked "infinite" lines never decay it, same as they never decay damage. */
  private baseHomingStrength = 0;
  private homingStrength = 0;
  private lockedTarget: PlayerTarget | null = null;
  /** How many more chain links remain after this one, drained once (by `takePendingForks`) on the first hit this bullet registers. Set on both `fireLine` and `fireForkedLine` so the fork chain can keep recursing across generations. */
  private pendingForkCount = 0;

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
    homingStrength: number,
    forkCount: number,
    forkProjectileSpeed: number,
    forkConeDeg: number,
    shotPolarity: Polarity | null = null
  ): void {
    this.reset(x, y, vx, vy, baseHit, numCrits, blastRadius, blastDamageFraction, homingStrength, shotPolarity);
    this.infinite = false;
    this.fractions = fractions;
    this.fractionIndex = 0;
    this.pendingForkCount = forkCount;
    this.forkProjectileSpeed = forkProjectileSpeed;
    this.forkConeDeg = forkConeDeg;
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
    homingStrength: number,
    forkCount: number,
    forkProjectileSpeed: number,
    forkConeDeg: number,
    inheritedHit?: PlayerTarget,
    shotPolarity: Polarity | null = null
  ): void {
    this.reset(x, y, vx, vy, baseHit, numCrits, blastRadius, blastDamageFraction, homingStrength, shotPolarity);
    this.infinite = true;
    this.hitsRemaining = hitsAllowed;
    this.pendingForkCount = forkCount;
    this.forkProjectileSpeed = forkProjectileSpeed;
    this.forkConeDeg = forkConeDeg;
    if (inheritedHit) this.hitSet.add(inheritedHit.spawnId);
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
    homingStrength: number,
    shotPolarity: Polarity | null
  ): void {
    this.baseHit = baseHit;
    this.numCrits = numCrits;
    this.shotPolarity = shotPolarity;
    this.blastRadius = blastRadius;
    this.blastDamageFraction = blastDamageFraction;
    this.baseHomingStrength = homingStrength;
    this.homingStrength = homingStrength;
    this.lockedTarget = null;
    this.hitSet.clear();
    this.pendingForkCount = 0;
    this.forkProjectileSpeed = 0;
    this.forkConeDeg = 0;
    this.setPosition(x, y);
    this.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    // Explicit depth, not the default 0 — see systems/depth.ts (so a shot is never hidden behind the scenery or the unit it is flying toward).
    this.setDepth(DEPTH.playerBullet);
    this.setActive(true);
    this.setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(vx, vy);
    body.debugBodyColor = TUNING.debug.hitboxColors.playerBullet;
    body.debugShowVelocity = false;
    const chassis = (this.scene as ShmupPlayScene).player?.chassis;
    if (chassis?.polarity && shotPolarity) this.setTintFill(TUNING.chassis.polarityColors[shotPolarity]);
    else this.clearTint();
  }

  /** True once this bullet has already damaged `target` — it should pass through without re-hitting it. */
  hasHit(target: PlayerTarget): boolean {
    return this.hitSet.has(target.spawnId);
  }

  /** This shot's original Homing Strength, undecayed — what a fork spawned off this line should carry, since forked "infinite" lines never decay homing (same as they never decay damage). */
  get shotHomingStrength(): number {
    return this.baseHomingStrength;
  }

  /** Drains and returns this line's fork allotment — non-zero only the first time it's called, since `pendingForkCount` is only ever set on a fresh `fireLine`. The scene calls this after a successful `registerHit` to spawn forks from that impact. */
  takePendingForks(): number {
    const n = this.pendingForkCount;
    this.pendingForkCount = 0;
    return n;
  }

  /**
   * Registers a fresh impact against `target`. Returns the damage fraction
   * (relative to `baseHit`) to apply, or undefined if `target` was already
   * hit by this bullet. Recycles the bullet once its pierce/hits are spent.
   */
  registerHit(target: PlayerTarget): number | undefined {
    if (this.hitSet.has(target.spawnId)) return undefined;
    this.hitSet.add(target.spawnId);

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

  private findTarget(body: Phaser.Physics.Arcade.Body, speed: number): PlayerTarget | null {
    const radius = Math.min(TUNING.homing.maxRadiusPx, speed * TUNING.homing.seekAheadSeconds * this.homingStrength);
    if (radius <= 0) return null;
    const dirX = body.velocity.x / speed;
    const dirY = body.velocity.y / speed;
    const centerX = this.x + dirX * radius;
    const centerY = this.y + dirY * radius;

    let best: PlayerTarget | null = null;
    let bestDist = Infinity;
    for (const target of (this.scene as ShmupPlayScene).playerTargets()) {
      // Can't hit it again (it's already in this bullet's hit-list, same as
      // collision exclusion), so it shouldn't be seekable either.
      if (!target.active || this.hitSet.has(target.spawnId)) continue;
      const dist = Phaser.Math.Distance.Between(centerX, centerY, target.x, target.y);
      if (dist <= radius && dist < bestDist) {
        best = target;
        bestDist = dist;
      }
    }
    return best;
  }
}
