import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";
import { copy } from "../content";
import { preloadSprites, ensurePlaceholderTextures } from "../sprites";
import type { SpriteKey } from "../sprites";
import { Player, Enemy, EnemyBullet, PlayerBullet } from "../entities";
import type { PlayerFireRequest, ShmupPlayScene } from "../entities";
import { applyDamage, reflexBulletSpeedMult, resolveHit, tickShieldRegen } from "../systems/combat";

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

const DRAG_OFFSET_Y = 120; // float the ship well above the finger so it stays visible

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
  private enemies!: Phaser.Physics.Arcade.Group;
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

  private gameOver = false;

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
    this.physics.add.overlap(this.enemyBullets, this.player, (bulletObj) =>
      this.onEnemyBulletHitPlayer(bulletObj as EnemyBullet)
    );
    this.physics.add.overlap(this.enemies, this.player, (enemyObj) =>
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

    this.time.addEvent({
      delay: TUNING.enemies.drone.spawnIntervalMs,
      loop: true,
      callback: () => this.spawnEnemy(),
    });

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
  }

  update(_time: number, delta: number) {
    if (this.gameOver) return;

    const dt = delta / 1000;

    this.updateMovement(dt);
    this.player.tickIFrame(delta);

    for (const req of this.player.tryFire(delta)) {
      this.fireWeapon(req);
    }

    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (enemy.active && enemy.tryFire(delta)) this.fireEnemyBullet(enemy);
    }

    tickShieldRegen(this.player.defender, this.player.stats.maxShield, dt);
    this.updateHud();

    this.background.tilePositionY -= TUNING.visuals.bgScrollSpeed * dt;
    for (const star of this.stars.getChildren() as Phaser.GameObjects.Image[]) {
      star.y += (star.getData("speed") as number) * dt;
      if (star.y > GAME_HEIGHT) {
        star.y = 0;
        star.x = Phaser.Math.Between(0, GAME_WIDTH);
      }
    }
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
    const hit = resolveHit({
      damage: this.player.stats.damage,
      critChance: this.player.stats.critChance,
      critDamage: this.player.stats.critDamage,
    });
    const { flatLineCount, tailHitFractions, blastDamageFraction } = req.behavior;
    const blastRadius = this.player.stats.blastRadius;
    const originX = this.player.x;
    const originY = this.player.y - this.player.height / 2;

    this.spawnPlayerLine(originX, originY, 0, -req.projectileSpeed, hit, tailHitFractions, blastRadius, blastDamageFraction);

    const forkCount = Math.min(flatLineCount, TUNING.weapons.maxForkedBulletsPerShot);
    for (let i = 0; i < forkCount; i++) {
      const angle = this.forkAngle(i, forkCount);
      const vx = Math.sin(angle) * req.projectileSpeed;
      const vy = -Math.cos(angle) * req.projectileSpeed;
      this.spawnPlayerFork(
        originX,
        originY,
        vx,
        vy,
        hit,
        TUNING.weapons.maxHitsPerInfiniteBullet,
        blastRadius,
        blastDamageFraction
      );
    }
  }

  /** Fans forked lines out symmetrically around straight-up so each fork is visibly its own line. */
  private forkAngle(i: number, count: number): number {
    const stepDeg = 6;
    const maxSpreadDeg = 50;
    const spreadDeg = Math.min(maxSpreadDeg, stepDeg * Math.max(0, count - 1));
    const startDeg = -spreadDeg / 2;
    const angleDeg = count <= 1 ? startDeg : startDeg + (spreadDeg * i) / (count - 1);
    return Phaser.Math.DegToRad(angleDeg);
  }

  private spawnPlayerLine(
    x: number,
    y: number,
    vx: number,
    vy: number,
    hit: number,
    fractions: number[],
    blastRadius: number,
    blastDamageFraction: number
  ): void {
    const bullet = this.playerBullets.get(x, y, TEX.bulletPlayer) as PlayerBullet | null;
    bullet?.fireLine(x, y, vx, vy, hit, fractions, blastRadius, blastDamageFraction);
  }

  private spawnPlayerFork(
    x: number,
    y: number,
    vx: number,
    vy: number,
    hit: number,
    hitsAllowed: number,
    blastRadius: number,
    blastDamageFraction: number
  ): void {
    const bullet = this.playerBullets.get(x, y, TEX.bulletPlayer) as PlayerBullet | null;
    bullet?.fireForkedLine(x, y, vx, vy, hit, hitsAllowed, blastRadius, blastDamageFraction);
  }

  private onPlayerBulletHitEnemy(bullet: PlayerBullet, enemy: Enemy): void {
    if (this.gameOver || !bullet.active || !enemy.active || bullet.hasHit(enemy)) return;
    const fraction = bullet.registerHit(enemy);
    if (fraction === undefined) return;

    this.damageEnemy(enemy, bullet.baseHit * fraction);

    if (bullet.blastRadius > 0) {
      const blastDamage = bullet.baseHit * bullet.blastDamageFraction;
      for (const other of this.enemies.getChildren() as Enemy[]) {
        if (other === enemy || !other.active) continue;
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
        if (dist <= bullet.blastRadius) this.damageEnemy(other, blastDamage);
      }
    }
  }

  private damageEnemy(enemy: Enemy, damage: number): void {
    enemy.hp -= damage;
    if (enemy.hp <= 0) {
      enemy.recycle();
      this.score += enemy.scoreValue;
      this.scoreText.setText(copy("play.score", { score: this.score }));
    }
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
    if (result.dodged) return;
    this.player.triggerIFrame();
    this.cameras.main.flash(120, 150, 0, 0);
    if (result.defeated) this.endEpisode();
  }

  // No-hull-lives model (combat.spec.todo.md / run-structure.spec.todo.md): one
  // death ends the episode. The map/run-structure system (F8/F11) doesn't
  // exist yet, so F6's vertical slice simplifies "returned to the map" to an
  // immediate restart.
  private endEpisode(): void {
    this.gameOver = true;
    this.physics.pause();

    const lines = [
      copy("play.episodeOver.title"),
      "",
      copy("play.episodeOver.score", { score: this.score }),
      "",
      copy("play.episodeOver.restartPrompt"),
    ];
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
    const x = 16;
    const width = 200;
    const height = 10;
    const hpY = 44;
    const shieldY = 60;

    this.hpBar.clear();
    this.hpBar.fillStyle(0x404040).fillRect(x, hpY, width, height);
    const hpFrac = Phaser.Math.Clamp(this.player.defender.hp / this.player.stats.maxHp, 0, 1);
    this.hpBar.fillStyle(0xff6b00).fillRect(x, hpY, width * hpFrac, height);

    this.shieldBar.clear();
    if (this.player.stats.maxShield > 0) {
      this.shieldBar.fillStyle(0x404040).fillRect(x, shieldY, width, height);
      const shieldFrac = Phaser.Math.Clamp(this.player.defender.shield / this.player.stats.maxShield, 0, 1);
      this.shieldBar.fillStyle(0x5599ff).fillRect(x, shieldY, width * shieldFrac, height);
    }
  }
}
