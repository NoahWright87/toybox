import Phaser from "phaser";
import { TUNING } from "../tuning";
import { nextSpawnId } from "./spawnId";
import type { PlayerTarget, ShmupPlayScene } from "./types";
import type { AuthoredCollisionGroup } from "../systems/encounters/authoredTypes";
import type { Polarity } from "../systems/chassis";

/**
 * One live instance of a `/shmup-editor` Unit — a hull, one of its Parts,
 * or a projectile. All three are the same class because in the authored
 * model they are the same thing: "a spawned projectile is still an actual
 * Unit, not a bespoke bullet type," which is exactly what makes a bullet
 * that itself fires (or splits) fall out for free.
 *
 * `EncounterRunner` owns all the behavior — where this is, which way it
 * faces, when it fires. This class owns only what a *collision* needs:
 * identity, hit points, and the routing rule for where damage lands.
 *
 * **Damage routing.** A Part with `hasHitbox` but not `hasHealth` is a
 * shootable region of its hull, not a separate object: damage passes
 * through to `owner` (after this Part's own `damageMultiplier`), and the
 * hull is what dies. A Part with `hasHealth` has its own pool and can be
 * destroyed while the hull fights on. `applyDamage` returns whichever of
 * the two actually died, so the scene pays out at the right place.
 *
 * **Invincibility is shown, not hidden.** The editor's own note says
 * hiding the sprite is a temporary stand-in for an animation system that
 * can swap in an alternate state — reasonable on an authoring canvas, but
 * an enemy that vanishes mid-fight reads as a bug to a player. Here an
 * invincible instance stays visible at reduced alpha with its body
 * disabled, which is the same information (shots pass through) without the
 * "where did it go" problem.
 */
export class AuthoredUnit extends Phaser.Physics.Arcade.Sprite implements PlayerTarget {
  spawnId = 0;
  hp = 0;
  maxHp = 0;
  scoreValue = 0;
  contactDamage = 0;
  polarity: Polarity = "red";
  damageMultiplier = 1;
  /** Which collision bucket this belongs to — see `AuthoredCollisionGroup`. */
  collisionGroup: AuthoredCollisionGroup = "enemy";
  /** Collision radius in world px (the authored `UnitDef.size`), kept for the runner's graze/despawn math. */
  hitRadius = 0;
  /** The hull this is a Part of, or null for a hull/projectile. */
  owner: AuthoredUnit | null = null;
  /** Parts bolted to this hull — recycled with it, so a destroyed hull never leaves orphaned turrets on the field. */
  readonly parts: AuthoredUnit[] = [];
  /** True for a Part that has a hitbox but no HP of its own: damage lands on `owner` instead. */
  private forwardsDamage = false;
  /** False for a purely decorative Part — it renders and moves with its hull but is never in the collision set. */
  hasCollision = true;
  private invincibleFlag = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
  }

  /**
   * Brings this instance to life. `displaySize` is the longest-side render
   * size in px and `hitRadius` the collision radius — they're independent
   * on purpose (see `systems/encounters/spriteScale.ts`), so the body is
   * sized in *texture* space to survive the sprite's display scaling.
   */
  spawn(config: {
    x: number;
    y: number;
    textureKey: string;
    displaySize: number;
    hitRadius: number;
    hp: number;
    contactDamage: number;
    scoreValue: number;
    collisionGroup: AuthoredCollisionGroup;
    hasCollision?: boolean;
    damageMultiplier?: number;
    owner?: AuthoredUnit | null;
    forwardsDamage?: boolean;
    depth: number;
  }): void {
    this.setTexture(config.textureKey);
    this.spawnId = nextSpawnId();
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.contactDamage = config.contactDamage;
    this.scoreValue = config.scoreValue;
    this.collisionGroup = config.collisionGroup;
    this.hasCollision = config.hasCollision ?? true;
    this.damageMultiplier = config.damageMultiplier ?? 1;
    this.owner = config.owner ?? null;
    this.forwardsDamage = config.forwardsDamage ?? false;
    this.hitRadius = config.hitRadius;
    this.parts.length = 0;
    this.invincibleFlag = false;

    // Authored content has no polarity concept; assigning one anyway keeps
    // an Ikaruga-style chassis meaningful against it, exactly as `Enemy`
    // does. Inert on any chassis without the mechanic.
    this.polarity = Math.random() < 0.5 ? "red" : "blue";

    this.setPosition(config.x, config.y);
    this.setDepth(config.depth);
    this.setActive(true);
    this.setVisible(true);
    this.setAlpha(1);
    this.applyPolarityTint();
    this.applyDisplaySize(config.displaySize);
    this.applyHitbox();

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = this.hasCollision;
    body.stop();
    body.debugBodyColor = TUNING.debug.hitboxColors.enemy;
    body.debugShowVelocity = false;
  }

  /** Scales the sprite so its longest side is `displaySize` px, preserving the art's aspect ratio. */
  private applyDisplaySize(displaySize: number): void {
    const longest = Math.max(this.width, this.height) || 1;
    this.setScale(displaySize / longest);
  }

  /**
   * Arcade multiplies a body's source dimensions by the game object's
   * scale, so the radius handed to `setCircle` has to be pre-divided by it
   * to land on the authored world-space radius. Offsets are in texture
   * space too, centering the circle on the frame.
   */
  private applyHitbox(): void {
    const scale = this.scaleX || 1;
    const sourceRadius = Math.max(1, this.hitRadius / scale);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(sourceRadius, this.width / 2 - sourceRadius, this.height / 2 - sourceRadius);
  }

  get invincible(): boolean {
    return this.invincibleFlag;
  }

  /**
   * Hittability cascades top-down only: a Part is hittable only while it
   * *and* its hull are both non-invincible. A Part may be more restrictive
   * than its hull (a shielded turret on an exposed body), never less.
   */
  setInvincible(value: boolean): void {
    if (this.invincibleFlag === value) return;
    this.invincibleFlag = value;
    this.refreshHittable();
    for (const part of this.parts) part.refreshHittable();
  }

  /** True when shots can currently land on this — this and (if it's a Part) its hull both vulnerable. */
  get hittable(): boolean {
    return !this.invincibleFlag && !(this.owner?.invincible ?? false);
  }

  private refreshHittable(): void {
    const hittable = this.hittable;
    this.setAlpha(hittable ? 1 : 0.45);
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    // A Part with no hitbox of its own never had collision to re-enable.
    if (body && this.hasCollision) body.enable = hittable;
  }

  applyDamage(amount: number): PlayerTarget | null {
    if (this.forwardsDamage && this.owner) return this.owner.applyDamage(amount);
    this.hp -= amount;
    if (this.hp > 0) return null;
    this.recycle();
    return this;
  }

  recycle(): void {
    for (const part of this.parts) part.recycle();
    this.parts.length = 0;
    this.owner = null;
    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }

  /** Mirrors `Enemy`'s rule: only tint by polarity when the equipped chassis actually uses it. */
  private applyPolarityTint(): void {
    const chassis = (this.scene as ShmupPlayScene).player?.chassis;
    if (!chassis?.polarity) {
      this.clearTint();
      return;
    }
    this.setTintFill(TUNING.chassis.polarityColors[this.polarity]);
  }
}
