import Phaser from "phaser";
import { TUNING } from "../tuning";
import { resolveLoadout } from "../systems/effects";
import type { OwnedWeapon, ProjectileBehavior } from "../systems/effects";
import type { StatBlock, StatId, StatModifier } from "../systems/stats";
import type { Defender } from "../systems/combat";
import { PLACEHOLDER_WEAPON } from "../content";
import type { DebugOverrides } from "../debug/debugSettings";

/** One weapon ready to fire this frame, with everything its shot needs already resolved. */
export interface PlayerFireRequest {
  weaponIndex: number;
  projectileSpeed: number;
  behavior: ProjectileBehavior;
}

/** Fallback for standalone/debug use (e.g. tests) when no CareerState build is available. */
const STARTING_WEAPONS: OwnedWeapon[] = [{ weapon: PLACEHOLDER_WEAPON, tier: 0 }];

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: StatBlock;
  /** The persisted career build (run-structure.spec.todo.md: "Build persists"), rehydrated by PlayScene from CareerState.weapons. */
  weapons: OwnedWeapon[];
  projectileBehaviors: ProjectileBehavior[] = [];
  defender: Defender;
  focus = false;
  iFrameRemainingMs = 0;
  /** Debug-only (C12 #151): full width, in degrees, of a random cone around straight-up that each shot's heading is drawn from (0 = always straight up). Not a real StatId — there's no balance/upgrade source for it, it exists purely so the debug overlay can spread fire to inspect homing/fork/pierce behavior off-axis. */
  debugFiringConeDeg = 0;
  /** Debug-only override (C12 #151 follow-up) for fork-cone width; null means "use the weapon's authored/default value" (see `effectiveForkConeDeg`). */
  debugForkConeOverrideDeg: number | null = null;
  /** Debug-only override (C12 #151 follow-up) for the enemy spawn interval (ms); null means "use TUNING.enemies.drone.spawnIntervalMs" (see `effectiveEnemySpawnIntervalMs`). */
  debugEnemySpawnIntervalMs: number | null = null;
  /** Debug-only override for the standard/elite survival-timer clear condition (sec); null means "use TUNING.ratings.episodeClearDurationSec" (see `effectiveEpisodeClearDurationSec`). Doesn't affect bossFinale nodes, which clear on boss defeat regardless. */
  debugEpisodeClearDurationSec: number | null = null;
  /** Debug-only (C12 #151 follow-up): renders collision hitbox outlines for player/enemies/projectiles when true. */
  debugShowHitboxes = false;
  private fireCooldownMs: number[] = [];
  // Transient mods from the debug overlay (C12 #151) — a stand-in for the
  // real level-up/item mod sources that don't exist yet. Keyed by stat so
  // the overlay can replace one stat's nudge without touching the others.
  private debugMods = new Map<StatId, StatModifier>();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    weapons: OwnedWeapon[] = STARTING_WEAPONS,
    debugOverrides?: DebugOverrides
  ) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.weapons = weapons;
    if (debugOverrides) {
      for (const [stat, amount] of Object.entries(debugOverrides.statMods) as [StatId, number][]) {
        if (amount) this.debugMods.set(stat, { kind: "flat", stat, amount, source: "debug" });
      }
      this.debugFiringConeDeg = debugOverrides.firingConeDeg;
      this.debugForkConeOverrideDeg = debugOverrides.forkConeOverrideDeg;
      this.debugEnemySpawnIntervalMs = debugOverrides.enemySpawnIntervalMs;
      this.debugEpisodeClearDurationSec = debugOverrides.episodeClearDurationSec;
      this.debugShowHitboxes = debugOverrides.showHitboxes;
    }

    const { stats, projectileBehaviors } = resolveLoadout({
      weapons: this.weapons,
      transientMods: [...this.debugMods.values()],
    });
    this.stats = stats;
    this.projectileBehaviors = projectileBehaviors;
    this.defender = { hp: stats.maxHp, shield: stats.maxShield, shieldRegenDelayRemaining: 0 };
    this.fireCooldownMs = this.weapons.map(() => 0);
    this.applyHitboxRadius();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.debugBodyColor = TUNING.debug.hitboxColors.player;
    body.debugShowVelocity = false;
  }

  /** This player's first weapon's authored fork-cone width, or the tuning default if unset — the "real" production value before any debug override. */
  get baseForkConeDeg(): number {
    return this.weapons[0]?.weapon.forkConeDeg ?? TUNING.weapons.defaultForkConeDeg;
  }

  /** Effective fork-cone width: the debug override when set, else the production value above. */
  get effectiveForkConeDeg(): number {
    return this.debugForkConeOverrideDeg ?? this.baseForkConeDeg;
  }

  /** Effective enemy spawn interval (ms): the debug override when set, else TUNING's default. */
  get effectiveEnemySpawnIntervalMs(): number {
    return this.debugEnemySpawnIntervalMs ?? TUNING.enemies.drone.spawnIntervalMs;
  }

  /** Effective standard/elite survival-timer length (sec): the debug override when set, else TUNING's default. */
  get effectiveEpisodeClearDurationSec(): number {
    return this.debugEpisodeClearDurationSec ?? TUNING.ratings.episodeClearDurationSec;
  }

  /** Nudges a stat by `delta` via a debug-sourced flat modifier; re-resolves the whole loadout so the change is visible immediately. */
  nudgeDebugStat(stat: StatId, delta: number): void {
    const current = this.debugMods.get(stat)?.amount ?? 0;
    this.setDebugMod(stat, current + delta);
  }

  setDebugMod(stat: StatId, amount: number): void {
    if (amount === 0) {
      this.debugMods.delete(stat);
    } else {
      this.debugMods.set(stat, { kind: "flat", stat, amount, source: "debug" });
    }
    this.recompute();
  }

  clearDebugMods(): void {
    this.debugMods.clear();
    this.recompute();
  }

  debugModAmount(stat: StatId): number {
    return this.debugMods.get(stat)?.amount ?? 0;
  }

  private recompute(): void {
    const { stats, projectileBehaviors } = resolveLoadout({
      weapons: this.weapons,
      transientMods: [...this.debugMods.values()],
    });
    this.stats = stats;
    this.projectileBehaviors = projectileBehaviors;
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
