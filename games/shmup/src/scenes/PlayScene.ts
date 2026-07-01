import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";
import { copy, ratingsTierForScore, ratingsTierName, RATINGS_LADDER } from "../content";
import { preloadSprites, ensurePlaceholderTextures } from "../sprites";
import type { SpriteKey } from "../sprites";
import { Player, Enemy, EnemyBullet, PlayerBullet } from "../entities";
import type { PlayerFireRequest, ShmupPlayScene } from "../entities";
import { applyDamage, applyLifesteal, reflexBulletSpeedMult, rollCrit, tickHpRegen, tickShieldRegen } from "../systems/combat";
import {
  GrazeTracker,
  ShmupEventBus,
  grazeRingAt,
  hypeMax,
  gainHype,
  decayHype,
  scoreMult,
  ratingsGainOnClear,
  ratingsLossOnDeath,
  applyRatingsDelta,
  loadRatings,
  saveRatings,
} from "../systems/hype";
import type { HypeState, GrazeRingDef } from "../systems/hype";
import { DebugOverlay } from "../debug/DebugOverlay";

// Placeholder until a real player-profile/name system exists (F11) — only
// used to fill the {playerName} token in the Cancelled flavor line.
const PLACEHOLDER_PLAYER_NAME = "Pilot";

// Logical roles -> sprite registry keys (specs/games/shmup/content-and-assets.spec.md).
// Code never inlines a draw call or file path — it asks for one of these keys,
// and the registry decides whether that currently means a colored primitive
// or real art. Add new entries to sprites/manifest.json, not here.
const TEX = {
  ship: "shipPlayer",
  bulletPlayer: "bulletPlayer",
  bulletEnemy: "bulletEnemy",
  enemy: "enemyDrone",
  star: "fxStarDust",
  bg: "bgSpace",
} satisfies Record<string, SpriteKey>;

const DRAG_OFFSET_Y = 132; // float the ship well above the finger so it stays visible

/**
 * The F6 #134 core gameplay loop — the integration point for F3 (stats),
 * F4 (weapon/item effect composition), and F5 (sprite registry): a player
 * ship whose speed/fire-rate/damage come from the resolved stat pool, a
 * weapon that fires through resolveLoadout()'s projectile behavior
 * (pierce/fork), and pooled Arcade-physics entities for bullets/enemies.
 */
export class PlayScene extends Phaser.Scene implements ShmupPlayScene {
  player!: Player;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  enemies!: Phaser.Physics.Arcade.Group;
  private stars!: Phaser.GameObjects.Group;
  private background!: Phaser.GameObjects.TileSprite;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private focusKey!: Phaser.Input.Keyboard.Key;
  private pointerTarget: { x: number; y: number } | null = null;

  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private shieldBar!: Phaser.GameObjects.Graphics;

  // Grazing / Hype / Ratings (hype-and-ratings.spec.md, F7 #135).
  private hypeEvents = new ShmupEventBus();
  private grazeTracker = new GrazeTracker();
  private hypeState: HypeState = { hype: 0, idleTimeSec: 0 };
  private hypeMaxValue = 0;
  private currentScoreMult = 1;
  private crowdSize = TUNING.hype.crowdSizeDefault;
  private grazeStreak = 0;
  private grazeTotalMult = 0;
  private ratings = 0;
  // Placeholder "episode cleared" stand-in (run-structure.spec.todo.md /
  // F8 #136 owns the real stage-end condition) -- surviving this many
  // seconds makes the on-clear Ratings cash-in path reachable in F6's
  // endless-wave vertical slice.
  private elapsedEpisodeSec = 0;
  private hypeBar!: Phaser.GameObjects.Graphics;
  private ratingsBar!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private tierNameText!: Phaser.GameObjects.Text;

  private gameOver = false;
  private debugOverlay!: DebugOverlay;
  private enemySpawnCooldownMs: number = TUNING.enemies.drone.spawnIntervalMs;

  constructor() {
    super("Play");
  }

  preload() {
    preloadSprites(this);
  }

  create() {
    ensurePlaceholderTextures(this);
    this.gameOver = false;
    this.score = 0;

    // PlayScene's instance survives scene.restart() (only init/create rerun,
    // not the constructor), so every piece of run state needs an explicit
    // reset here -- same reason `this.score = 0` above already exists.
    this.hypeState = { hype: 0, idleTimeSec: 0 };
    this.elapsedEpisodeSec = 0;
    this.grazeTracker.reset();
    this.grazeStreak = 0;
    this.grazeTotalMult = 0;
    this.crowdSize = TUNING.hype.crowdSizeDefault;
    this.hypeMaxValue = hypeMax(this.crowdSize);
    this.currentScoreMult = 1;
    this.ratings = loadRatings();

    this.background = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEX.bg)
      .setDepth(-20);

    this.stars = this.add.group();
    for (let i = 0; i < TUNING.visuals.starCount; i++) {
      const s = this.add
        .image(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(0, GAME_HEIGHT), TEX.star)
        .setAlpha(Phaser.Math.FloatBetween(0.2, 1))
        .setDepth(-10);
      s.setData("speed", Phaser.Math.Between(TUNING.visuals.starMinSpeed, TUNING.visuals.starMaxSpeed));
      this.stars.add(s);
    }

    this.playerBullets = this.physics.add.group({
      classType: PlayerBullet,
      maxSize: TUNING.performance.maxPlayerBullets,
      runChildUpdate: true,
    });
    this.enemyBullets = this.physics.add.group({
      classType: EnemyBullet,
      maxSize: TUNING.performance.maxEnemyBullets,
      runChildUpdate: true,
    });
    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: TUNING.performance.maxEnemies,
      runChildUpdate: true,
    });

    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, TEX.ship);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    this.physics.add.overlap(this.playerBullets, this.enemies, (bulletObj, enemyObj) =>
      this.onPlayerBulletHitEnemy(bulletObj as PlayerBullet, enemyObj as Enemy)
    );
    // Arcade's overlap() always normalizes a Sprite-vs-Group pair to
    // collideCallback(sprite, groupMember) regardless of the order the two
    // arguments are passed in, so the player (a lone Sprite, not a Group)
    // is always the first callback argument here.
    this.physics.add.overlap(this.enemyBullets, this.player, (_player, bulletObj) =>
      this.onEnemyBulletHitPlayer(bulletObj as EnemyBullet)
    );
    this.physics.add.overlap(this.enemies, this.player, (_player, enemyObj) =>
      this.onEnemyContactPlayer(enemyObj as Enemy)
    );

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.focusKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    // Pointer / touch: drag-to-move (the ship follows the finger, floated above it).
    // Mobile Focus is TBD (combat.spec.todo.md) — not wired to the pointer here.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pointerTarget = { x: p.x, y: p.y - DRAG_OFFSET_Y };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.pointerTarget = { x: p.x, y: p.y - DRAG_OFFSET_Y };
    });
    this.input.on("pointerup", () => {
      this.pointerTarget = null;
    });

    this.enemySpawnCooldownMs = this.player.effectiveEnemySpawnIntervalMs;

    // Depth 50: above every gameplay sprite (player is the highest at 10) so
    // hitbox outlines aren't hidden beneath the sprites they outline, but
    // below the HUD/debug-overlay text (100+).
    this.physics.world.createDebugGraphic().setDepth(50);
    this.physics.world.drawDebug = false;

    this.scoreText = this.add
      .text(16, 14, copy("play.score", { score: 0 }), {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
      })
      .setDepth(100);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 14, copy("play.hint"), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#888888",
      })
      .setOrigin(0.5, 1)
      .setDepth(100);

    this.hpBar = this.add.graphics().setDepth(100);
    this.shieldBar = this.add.graphics().setDepth(100);
    this.hypeBar = this.add.graphics().setDepth(100);
    this.ratingsBar = this.add.graphics().setDepth(100);

    // Timer: top-center, monospace to mimic a digital clock readout.
    this.timerText = this.add
      .text(GAME_WIDTH / 2, 14, "01:30", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0)
      .setDepth(100);

    // Tier name: top-right, same font/size as score but yellow.
    this.tierNameText = this.add
      .text(GAME_WIDTH - 16, 14, "", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffcc00",
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(100);

    this.debugOverlay = new DebugOverlay(this, this.player, () => ({
      hype: this.hypeState.hype,
      hypeMax: this.hypeMaxValue,
      scoreMult: this.currentScoreMult,
      grazeStreak: this.grazeStreak,
      grazeTotalMult: this.grazeTotalMult,
      ratings: this.ratings,
      ratingsTier: ratingsTierName(ratingsTierForScore(this.ratings)),
    }));
  }

  update(_time: number, delta: number) {
    this.debugOverlay.update();
    this.physics.world.drawDebug = this.player.debugShowHitboxes;
    if (!this.physics.world.drawDebug) this.physics.world.debugGraphic?.clear();
    if (this.gameOver) return;

    const dt = delta / 1000;

    this.updateMovement(dt);
    this.player.tickIFrame(delta);
    this.updateGrazeAndHype(dt);

    for (const req of this.player.tryFire(delta)) {
      this.fireWeapon(req);
    }

    this.enemySpawnCooldownMs -= delta;
    if (this.enemySpawnCooldownMs <= 0) {
      this.spawnEnemy();
      this.enemySpawnCooldownMs += this.player.effectiveEnemySpawnIntervalMs;
    }

    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (enemy.active && enemy.tryFire(delta)) this.fireEnemyBullet(enemy);
    }

    tickShieldRegen(this.player.defender, this.player.stats.maxShield, dt);
    tickHpRegen(this.player.defender, this.player.stats.maxHp, this.player.stats.hpRegen, dt);
    this.updateHud();

    this.background.tilePositionY -= TUNING.visuals.bgScrollSpeed * dt;
    for (const star of this.stars.getChildren() as Phaser.GameObjects.Image[]) {
      star.y += (star.getData("speed") as number) * dt;
      if (star.y > GAME_HEIGHT) {
        star.y = 0;
        star.x = Phaser.Math.Between(0, GAME_WIDTH);
      }
    }

    this.elapsedEpisodeSec += dt;
    if (this.elapsedEpisodeSec >= TUNING.ratings.episodeClearDurationSec) {
      this.clearEpisode();
    }
  }

  /**
   * Graze detection (concentric rings around grazeRadius, innermost-only
   * payout) feeds the Hype meter directly: gain while actively grazing,
   * super-linear decay otherwise (Model 1 formulas, hype-and-ratings.spec.md).
   */
  private updateGrazeAndHype(dt: number): void {
    const grazeMap = new Map<number, GrazeRingDef>();
    for (const bullet of this.enemyBullets.getChildren() as EnemyBullet[]) {
      if (!bullet.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, bullet.x, bullet.y);
      const ring = grazeRingAt(dist, this.player.stats.grazeRadius, TUNING.graze.rings);
      if (ring) grazeMap.set(bullet.spawnId, ring);
    }

    const grazeResult = this.grazeTracker.update(grazeMap);
    for (const event of grazeResult.events) {
      this.hypeEvents.emit(event.type === "start" ? "grazeStart" : "grazeEnd", event);
    }
    this.grazeStreak = grazeResult.streak;
    this.grazeTotalMult = grazeResult.totalMult;

    this.hypeMaxValue = hypeMax(this.crowdSize);
    if (grazeResult.totalMult > 0) {
      const gainRate = TUNING.hype.grazeGainPerSecond * grazeResult.totalMult * this.player.stats.grazeMultiplier;
      this.hypeState = gainHype(this.hypeState, gainRate * dt, this.hypeMaxValue);
    } else {
      this.hypeState = decayHype(this.hypeState, dt, this.hypeMaxValue);
    }
    this.currentScoreMult = scoreMult(this.hypeState.hype, this.hypeMaxValue);
    this.hypeEvents.emit("hypeChanged", {
      hype: this.hypeState.hype,
      hypeMax: this.hypeMaxValue,
      scoreMult: this.currentScoreMult,
    });
  }

  private updateMovement(dt: number): void {
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    const kbActive = left || right || up || down;

    this.player.setFocus(this.focusKey.isDown);
    const speed = this.player.currentSpeed();

    if (kbActive) {
      // Keyboard overrides any active drag.
      this.pointerTarget = null;
      this.player.setVelocity(0);
      if (left) this.player.setVelocityX(-speed);
      if (right) this.player.setVelocityX(speed);
      if (up) this.player.setVelocityY(-speed);
      if (down) this.player.setVelocityY(speed);
    } else if (this.pointerTarget) {
      // Drag-to-move: glide toward the finger at the same capped speed as keyboard.
      this.player.setVelocity(0);
      const dx = this.pointerTarget.x - this.player.x;
      const dy = this.pointerTarget.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      const step = speed * dt;
      if (dist <= step || dist === 0) {
        this.player.setPosition(this.pointerTarget.x, this.pointerTarget.y);
      } else {
        this.player.x += (dx / dist) * step;
        this.player.y += (dy / dist) * step;
      }
      this.player.x = Phaser.Math.Clamp(this.player.x, 16, GAME_WIDTH - 16);
      this.player.y = Phaser.Math.Clamp(this.player.y, 15, GAME_HEIGHT - 15);
    } else {
      this.player.setVelocity(0);
    }
  }

  private spawnEnemy(): void {
    if (this.gameOver) return;
    const x = Phaser.Math.Between(24, GAME_WIDTH - 24);
    const y = -20;
    const enemy = this.enemies.get(x, y, TEX.enemy) as Enemy | null;
    enemy?.spawn(x, y);
  }

  private fireEnemyBullet(enemy: Enemy): void {
    const x = enemy.x;
    const y = enemy.y + enemy.height / 2;
    const speed = TUNING.enemies.drone.bulletSpeed * reflexBulletSpeedMult(this.player.stats.reflexes);
    const bullet = this.enemyBullets.get(x, y, TEX.bulletEnemy) as EnemyBullet | null;
    bullet?.fire(x, y, 0, speed, TUNING.enemies.drone.bulletDamage);
  }

  /**
   * Crit is resolved once per shot fired (combat.spec.todo.md), so `baseHit`
   * is shared by every line/fork this shot spawns — pierce/fork decay the
   * fraction of that single resolved hit, they never re-roll it.
   */
  private fireWeapon(req: PlayerFireRequest): void {
    const { numCrits, critFactor } = rollCrit(this.player.stats.critChance, this.player.stats.critDamage);
    const hit = this.player.stats.damage * critFactor;
    const { flatLineCount, tailHitFractions, blastDamageFraction } = req.behavior;
    const blastRadius = this.player.stats.blastRadius;
    const homingStrength = this.player.stats.homingStrength;
    const originX = this.player.x;
    const originY = this.player.y - this.player.height / 2;
    const coneDeg = this.player.debugFiringConeDeg;
    const angleRad = Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-coneDeg / 2, coneDeg / 2));
    const vx = Math.sin(angleRad) * req.projectileSpeed;
    const vy = -Math.cos(angleRad) * req.projectileSpeed;

    const forkCount = Math.min(flatLineCount, TUNING.weapons.maxForkedBulletsPerShot);
    this.spawnPlayerLine(
      originX,
      originY,
      vx,
      vy,
      hit,
      numCrits,
      tailHitFractions,
      blastRadius,
      blastDamageFraction,
      homingStrength,
      forkCount,
      req.projectileSpeed,
      this.player.effectiveForkConeDeg
    );
  }

  /** A fork's heading is drawn from a cone around the forking bullet's own heading at the moment of impact (not fully random) — weapons.spec.todo.md follow-up, `WeaponDef.forkConeDeg`. */
  private forkAngle(baseAngleRad: number, coneDeg: number): number {
    return baseAngleRad + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-coneDeg / 2, coneDeg / 2));
  }

  private spawnPlayerLine(
    x: number,
    y: number,
    vx: number,
    vy: number,
    hit: number,
    numCrits: number,
    fractions: number[],
    blastRadius: number,
    blastDamageFraction: number,
    homingStrength: number,
    forkCount: number,
    forkProjectileSpeed: number,
    forkConeDeg: number
  ): void {
    const bullet = this.playerBullets.get(x, y, TEX.bulletPlayer) as PlayerBullet | null;
    bullet?.fireLine(
      x,
      y,
      vx,
      vy,
      hit,
      numCrits,
      fractions,
      blastRadius,
      blastDamageFraction,
      homingStrength,
      forkCount,
      forkProjectileSpeed,
      forkConeDeg
    );
  }

  private spawnPlayerFork(
    x: number,
    y: number,
    vx: number,
    vy: number,
    hit: number,
    numCrits: number,
    hitsAllowed: number,
    blastRadius: number,
    blastDamageFraction: number,
    homingStrength: number,
    forkCount: number,
    forkProjectileSpeed: number,
    forkConeDeg: number,
    inheritedHit?: Enemy
  ): void {
    const bullet = this.playerBullets.get(x, y, TEX.bulletPlayer) as PlayerBullet | null;
    bullet?.fireForkedLine(
      x,
      y,
      vx,
      vy,
      hit,
      numCrits,
      hitsAllowed,
      blastRadius,
      blastDamageFraction,
      homingStrength,
      forkCount,
      forkProjectileSpeed,
      forkConeDeg,
      inheritedHit
    );
  }

  /**
   * Forks aren't spawned at the muzzle — weapons.spec.todo.md's "forked
   * projectiles inherit the firing projectile's hit-list" only makes sense
   * once the line has actually scored an impact. So a bullet (the main line
   * or an earlier fork) carries its remaining chain-link count and hands it
   * off here, on its first registered hit, spawning exactly ONE more forked
   * line from this impact point (pre-seeded with `enemy` so it can't
   * immediately re-hit it) and carrying the chain count minus one. That new
   * fork resolves the same rule recursively on its OWN first impact
   * (weapons.spec.todo.md), so pierce well above 200% is only visible as a
   * multi-generation chain if every link in it keeps landing hits — a link
   * that flies past everything ends the chain early.
   */
  private onPlayerBulletHitEnemy(bullet: PlayerBullet, enemy: Enemy): void {
    if (this.gameOver || !bullet.active || !enemy.active || bullet.hasHit(enemy)) return;
    const fraction = bullet.registerHit(enemy);
    if (fraction === undefined) return;

    this.damageEnemy(enemy, bullet.baseHit * fraction, bullet.numCrits);

    if (bullet.blastRadius > 0) {
      const blastDamage = bullet.baseHit * bullet.blastDamageFraction;
      for (const other of this.enemies.getChildren() as Enemy[]) {
        if (other === enemy || !other.active) continue;
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
        if (dist <= bullet.blastRadius) this.damageEnemy(other, blastDamage, bullet.numCrits);
      }
    }

    const remainingForks = bullet.takePendingForks();
    if (remainingForks > 0) {
      const bulletBody = bullet.body as Phaser.Physics.Arcade.Body;
      const baseAngle = Math.atan2(bulletBody.velocity.y, bulletBody.velocity.x);
      const angle = this.forkAngle(baseAngle, bullet.forkConeDeg);
      const vx = Math.cos(angle) * bullet.forkProjectileSpeed;
      const vy = Math.sin(angle) * bullet.forkProjectileSpeed;
      this.spawnPlayerFork(
        bullet.x,
        bullet.y,
        vx,
        vy,
        bullet.baseHit,
        bullet.numCrits,
        TUNING.weapons.maxHitsPerInfiniteBullet,
        bullet.blastRadius,
        bullet.blastDamageFraction,
        bullet.shotHomingStrength,
        remainingForks - 1,
        bullet.forkProjectileSpeed,
        bullet.forkConeDeg,
        enemy
      );
    }
  }

  private damageEnemy(enemy: Enemy, damage: number, numCrits: number): void {
    enemy.hp -= damage;
    applyLifesteal(this.player.defender, this.player.stats.maxHp, damage, this.player.stats.lifesteal);
    this.spawnDamageNumber(enemy.x, enemy.y, damage, numCrits);
    if (enemy.hp <= 0) {
      enemy.recycle();
      this.gainScore(enemy.scoreValue);
    }
  }

  /**
   * Hype is rewarded exactly once, here, via ScoreMult on the score gain
   * itself (hype-and-ratings.spec.md's Model 1: "Hype rewarded exactly
   * once via ScoreMult, no double-multiplying") — Ratings later converts off
   * of this already-inflated `this.score`, so ratings.ts must never apply
   * ScoreMult a second time.
   */
  private gainScore(baseAmount: number, source = "kill"): void {
    const amount = baseAmount * this.currentScoreMult;
    this.score += amount;
    this.scoreText.setText(copy("play.score", { score: Math.round(this.score) }));
    this.hypeEvents.emit("scoreEvent", { source, baseAmount, scoreMult: this.currentScoreMult, amount });
  }

  /** Crit styling per the user's request: bigger, gold-colored, one "!" per crit stacked on the shot (combat.spec.todo.md's numCrits, not re-rolled per pierce/fork impact). */
  private spawnDamageNumber(x: number, y: number, damage: number, numCrits: number): void {
    const rounded = Math.round(damage);
    if (numCrits > 0) {
      this.spawnFloatingText(x, y, `${rounded}${"!".repeat(numCrits)}`, "#ffcc00", 20);
    } else {
      this.spawnFloatingText(x, y, `${rounded}`, "#ffffff", 13);
    }
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string, fontSize: number): void {
    const t = this.add
      .text(x, y, text, { fontFamily: "monospace", fontSize: `${fontSize}px`, color, fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(150);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 700,
      ease: "Cubic.Out",
      onComplete: () => t.destroy(),
    });
  }

  private onEnemyBulletHitPlayer(bullet: EnemyBullet): void {
    if (this.gameOver || !bullet.active) return;
    bullet.recycle();
    this.damagePlayer(bullet.damage);
  }

  private onEnemyContactPlayer(enemy: Enemy): void {
    if (this.gameOver || !enemy.active) return;
    enemy.recycle();
    this.damagePlayer(TUNING.enemies.drone.contactDamage);
  }

  private damagePlayer(hit: number): void {
    if (this.player.invulnerable) return;
    const result = applyDamage(this.player.defender, hit, this.player.stats.armor, this.player.stats.evasion);
    if (result.dodged) {
      this.spawnFloatingText(this.player.x, this.player.y - this.player.height / 2, "MISS!", "#88ccff", 16);
      return;
    }
    this.player.triggerIFrame();
    this.cameras.main.flash(120, 150, 0, 0);
    if (result.defeated) this.endEpisode();
  }

  // No-hull-lives model (combat.spec.todo.md / run-structure.spec.todo.md): one
  // death ends the episode. The map/run-structure system (F8/F11) doesn't
  // exist yet, so F6's vertical slice simplifies "returned to the map" to an
  // immediate restart.
  //
  // Ratings cash-in on death (hype-and-ratings.spec.md, F7 #135):
  // stageProgress stands in as elapsedEpisodeSec/episodeClearDurationSec
  // until F8's real stage-end condition exists, so dying immediately loses
  // the full base penalty and dying right at the clear line loses ~nothing.
  // A drop below 0 cumulative Ratings is Cancelled — the run's Ratings
  // resets to 0 rather than going negative.
  private endEpisode(): void {
    const stageProgress =
      TUNING.ratings.episodeClearDurationSec > 0
        ? this.elapsedEpisodeSec / TUNING.ratings.episodeClearDurationSec
        : 1;
    const loss = ratingsLossOnDeath(stageProgress);
    const result = applyRatingsDelta(this.ratings, -loss);
    const appliedDelta = (result.cancelled ? 0 : result.ratings) - this.ratings;
    this.ratings = result.cancelled ? 0 : result.ratings;
    saveRatings(this.ratings);
    this.hypeEvents.emit("ratingsChanged", {
      ratings: this.ratings,
      delta: appliedDelta,
      tier: ratingsTierForScore(this.ratings),
      cancelled: result.cancelled,
    });

    if (result.cancelled) {
      this.showEndScreen([
        copy("cancelled.title"),
        "",
        copy("cancelled.flavor", { playerName: PLACEHOLDER_PLAYER_NAME }),
        "",
        copy("play.episodeOver.score", { score: Math.round(this.score) }),
        "",
        copy("play.episodeOver.restartPrompt"),
      ]);
      return;
    }

    this.showEndScreen([
      copy("play.episodeOver.title"),
      "",
      copy("play.episodeOver.score", { score: Math.round(this.score) }),
      copy("play.episodeOver.ratingsLoss", { ratings: Math.round(loss) }),
      "",
      copy("play.episodeOver.restartPrompt"),
    ]);
  }

  /**
   * Basic end-of-episode cash-in of Hype into Ratings (hype-and-ratings.spec.md,
   * F7 #135) — the full episode->map transition is F8 #136's job, not this
   * issue's; this just proves the conversion path exists by restarting the
   * same vertical-slice episode once `episodeClearDurationSec` is survived.
   */
  private clearEpisode(): void {
    const gain = ratingsGainOnClear(this.score);
    const result = applyRatingsDelta(this.ratings, gain);
    this.ratings = result.ratings;
    saveRatings(this.ratings);
    this.hypeEvents.emit("ratingsChanged", {
      ratings: this.ratings,
      delta: gain,
      tier: ratingsTierForScore(this.ratings),
      cancelled: result.cancelled,
    });

    this.showEndScreen([
      copy("play.episodeClear.title"),
      "",
      copy("play.episodeClear.score", { score: Math.round(this.score) }),
      copy("play.episodeClear.ratingsGain", { ratings: Math.round(gain) }),
      "",
      copy("play.continuePrompt"),
    ]);
  }

  private showEndScreen(lines: string[]): void {
    this.gameOver = true;
    this.physics.pause();

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, lines.join("\n"), {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ff6b00",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(200);

    const restart = () => this.scene.restart();
    this.input.keyboard?.once("keydown", restart);
    this.input.once("pointerdown", restart);
  }

  private updateHud(): void {
    const width = 200;
    const height = 10;
    const leftX = 16;
    const rightX = GAME_WIDTH - 16;
    const hpY = 44;
    const shieldY = 60;

    // Left side: HP bar (left-to-right).
    this.hpBar.clear();
    this.hpBar.fillStyle(0x404040).fillRect(leftX, hpY, width, height);
    const hpFrac = Phaser.Math.Clamp(this.player.defender.hp / this.player.stats.maxHp, 0, 1);
    this.hpBar.fillStyle(0xff6b00).fillRect(leftX, hpY, width * hpFrac, height);

    // Left side: Shield bar (left-to-right).
    this.shieldBar.clear();
    if (this.player.stats.maxShield > 0) {
      this.shieldBar.fillStyle(0x404040).fillRect(leftX, shieldY, width, height);
      const shieldFrac = Phaser.Math.Clamp(this.player.defender.shield / this.player.stats.maxShield, 0, 1);
      this.shieldBar.fillStyle(0x5599ff).fillRect(leftX, shieldY, width * shieldFrac, height);
    }

    // Right side: Hype bar (right-to-left, mirroring HP bar row).
    this.hypeBar.clear();
    this.hypeBar.fillStyle(0x404040).fillRect(rightX - width, hpY, width, height);
    const hypeFrac = this.hypeMaxValue > 0 ? Phaser.Math.Clamp(this.hypeState.hype / this.hypeMaxValue, 0, 1) : 0;
    this.hypeBar.fillStyle(0xffcc00).fillRect(rightX - width * hypeFrac, hpY, width * hypeFrac, height);

    // Right side: Ratings progress-to-next-tier bar (right-to-left, mirroring Shield bar row).
    this.ratingsBar.clear();
    this.ratingsBar.fillStyle(0x404040).fillRect(rightX - width, shieldY, width, height);
    const ratingsFrac = this.ratingsProgressFrac();
    this.ratingsBar.fillStyle(0xaa44ff).fillRect(rightX - width * ratingsFrac, shieldY, width * ratingsFrac, height);

    // Tier name: top-right label above the Hype bar.
    this.tierNameText.setText(ratingsTierName(ratingsTierForScore(this.ratings)));

    // Timer: countdown from episodeClearDurationSec in MM:SS.
    const remaining = Math.max(0, TUNING.ratings.episodeClearDurationSec - this.elapsedEpisodeSec);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    this.timerText.setText(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
  }

  /** Progress fraction [0,1] from current tier threshold to the next one; 1 at max tier. */
  private ratingsProgressFrac(): number {
    const ladder = [...RATINGS_LADDER];
    const currentId = ratingsTierForScore(this.ratings);
    const idx = ladder.findIndex((t) => t.id === currentId);
    if (idx < 0 || idx >= ladder.length - 1) return 1;
    const current = ladder[idx];
    const next = ladder[idx + 1];
    const range = next.threshold - current.threshold;
    return range > 0 ? Phaser.Math.Clamp((this.ratings - current.threshold) / range, 0, 1) : 1;
  }
}
