import Phaser from "phaser";
import { TUNING } from "../tuning";
import { resolveLoadout, weaponFocusModsAtTier } from "../systems/effects";
import type { OwnedItem, OwnedWeapon, ProjectileBehavior } from "../systems/effects";
import type { StatBlock, StatId, StatModifier } from "../systems/stats";
import type { Defender } from "../systems/combat";
import type { ChassisDef, Polarity } from "../systems/chassis";
import { DEFAULT_CHASSIS, PLACEHOLDER_WEAPON } from "../content";
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
  /** The equipped chassis (chassis.spec.md, F10 #138) — supplies stat weightings/quirks, weapon-slot cap, hitbox size, and Focus behavior, all applied via `resolveLoadout()`. Defaults to DEFAULT_CHASSIS until chassis selection (Epic 2) exists. */
  readonly chassis: ChassisDef;
  /** The persisted career build (run-structure.spec.todo.md: "Build persists"), rehydrated by PlayScene from CareerState.weapons. */
  weapons: OwnedWeapon[];
  /** Owned passive items (economy.spec.todo.md, F9 #137), rehydrated from CareerState.items — stack through the F4 engine same as any item. */
  private items: OwnedItem[];
  /** Level-up stat picks (economy.spec.todo.md's hard rule), flattened from CareerState.statPicks — persistent, not transient, since they never toggle. */
  private persistentStatMods: StatModifier[];
  projectileBehaviors: ProjectileBehavior[] = [];
  defender: Defender;
  focus = false;
  /** Current polarity (chassis.spec.md's Ikaruga flagship example) — only meaningful when `chassis.polarity` is defined; harmlessly inert data otherwise. Initialized to the chassis's declared starting polarity, or "red" as a neutral default for chassis without the mechanic. */
  polarity: Polarity;
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
    debugOverrides?: DebugOverrides,
    items: OwnedItem[] = [],
    persistentStatMods: StatModifier[] = [],
    chassis: ChassisDef = DEFAULT_CHASSIS
  ) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.chassis = chassis;
    this.polarity = chassis.polarity?.initial ?? "red";
    this.weapons = weapons;
    this.items = items;
    this.persistentStatMods = persistentStatMods;
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

    const { stats, projectileBehaviors } = this.resolveEffectiveLoadout();
    this.stats = stats;
    this.projectileBehaviors = projectileBehaviors;
    this.defender = { hp: stats.maxHp, shield: stats.maxShield, shieldRegenDelayRemaining: 0 };
    this.fireCooldownMs = this.weapons.map(() => 0);
    this.applyHitboxRadius();
    this.applyPolarityTint();
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

  /**
   * The single resolution call (chassis.spec.md): chassis stat weightings +
   * quirks, level-up picks, items, weapon tiers, debug mods, and — only
   * while Focus is held — each equipped weapon's optional focused-fire mods
   * (transient, per stats.spec.md's "toggled by condition flips" convention).
   */
  private resolveEffectiveLoadout() {
    const focusMods: StatModifier[] = this.focus
      ? this.weapons.flatMap(({ weapon, tier }) => weaponFocusModsAtTier(weapon, tier))
      : [];
    return resolveLoadout({
      weapons: this.weapons,
      items: this.items,
      chassisBase: this.chassis.statBase,
      chassisMods: this.chassis.mods,
      statPickMods: this.persistentStatMods,
      maxWeaponSlots: this.chassis.maxWeaponSlots,
      transientMods: [...this.debugMods.values(), ...focusMods],
    });
  }

  private recompute(): void {
    const { stats, projectileBehaviors } = this.resolveEffectiveLoadout();
    this.stats = stats;
    this.projectileBehaviors = projectileBehaviors;
  }

  private applyHitboxRadius(): void {
    const r = this.focus
      ? (this.chassis.focus.hitboxRadiusFocus ?? this.chassis.hitboxRadiusNormal)
      : this.chassis.hitboxRadiusNormal;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
  }

  setFocus(focus: boolean): void {
    if (this.focus === focus) return;
    this.focus = focus;
    this.applyHitboxRadius();
    this.recompute();
  }

  /** Flips red/blue (chassis.spec.md's Ikaruga flagship example) — a no-op tint-wise on a chassis without `polarity`, since `applyPolarityTint()` clears any tint when the config is absent. */
  togglePolarity(): void {
    if (!this.chassis.polarity) return;
    this.polarity = this.polarity === "red" ? "blue" : "red";
    this.applyPolarityTint();
  }

  private applyPolarityTint(): void {
    if (!this.chassis.polarity) {
      this.clearTint();
      return;
    }
    this.setTintFill(TUNING.chassis.polarityColors[this.polarity]);
  }

  /** Movement speed for this frame, in px/s — Focus's slowdown is the chassis's universal base action (chassis.spec.md's `ChassisFocusDef.speedMult`). */
  currentSpeed(): number {
    return this.stats.playerSpeed * (this.focus ? this.chassis.focus.speedMult : 1);
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
