import Phaser from "phaser";
import { TUNING } from "../tuning";
import { resolveLoadout } from "../systems/effects";
import type { OwnedWeapon, ProjectileBehavior } from "../systems/effects";
import type { StatBlock } from "../systems/stats";
import type { Defender } from "../systems/combat";
import { PLACEHOLDER_WEAPON } from "../content";

/** One weapon ready to fire this frame, with everything its shot needs already resolved. */
export interface PlayerFireRequest {
  weaponIndex: number;
  projectileSpeed: number;
  behavior: ProjectileBehavior;
}

/**
 * Single starting weapon for F6's vertical slice (C1 #140 owns the real
 * base-weapon roster). `Player.weapons` is an array so a future roster is
 * purely a data addition, per weapons.spec.todo.md's acceptance reference.
 */
const STARTING_WEAPONS: OwnedWeapon[] = [{ weapon: PLACEHOLDER_WEAPON, tier: 0 }];

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: StatBlock;
  weapons: OwnedWeapon[] = STARTING_WEAPONS;
  projectileBehaviors: ProjectileBehavior[] = [];
  defender: Defender;
  focus = false;
  iFrameRemainingMs = 0;
  private fireCooldownMs: number[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const { stats, projectileBehaviors } = resolveLoadout({ weapons: this.weapons });
    this.stats = stats;
    this.projectileBehaviors = projectileBehaviors;
    this.defender = { hp: stats.maxHp, shield: stats.maxShield, shieldRegenDelayRemaining: 0 };
    this.fireCooldownMs = this.weapons.map(() => 0);
    this.applyHitboxRadius();
  }

  private applyHitboxRadius(): void {
    const r = this.focus ? TUNING.combat.hitboxRadiusFocus : TUNING.combat.hitboxRadiusNormal;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
  }

  setFocus(focus: boolean): void {
    if (this.focus === focus) return;
    this.focus = focus;
    this.applyHitboxRadius();
  }

  /** Movement speed for this frame, in px/s — Focus is movement-slow-only per chassis.spec.todo.md. */
  currentSpeed(): number {
    return this.stats.playerSpeed * (this.focus ? TUNING.combat.focusSpeedMult : 1);
  }

  get invulnerable(): boolean {
    return this.iFrameRemainingMs > 0;
  }

  triggerIFrame(): void {
    this.iFrameRemainingMs = TUNING.combat.playerIFrameMs;
  }

  tickIFrame(dtMs: number): void {
    if (this.iFrameRemainingMs > 0) {
      this.iFrameRemainingMs = Math.max(0, this.iFrameRemainingMs - dtMs);
    }
  }

  /** Decrements every weapon's cooldown; returns fire requests for whichever weapons came ready this frame. */
  tryFire(dtMs: number): PlayerFireRequest[] {
    const requests: PlayerFireRequest[] = [];
    const cadenceMs = 1000 / (TUNING.weapons.baseFireRate * this.stats.attackSpeed);
    this.weapons.forEach((owned, i) => {
      this.fireCooldownMs[i] -= dtMs;
      if (this.fireCooldownMs[i] <= 0) {
        this.fireCooldownMs[i] += cadenceMs;
        requests.push({
          weaponIndex: i,
          projectileSpeed: owned.weapon.projectileSpeed,
          behavior: this.projectileBehaviors[i],
        });
      }
    });
    return requests;
  }
}
