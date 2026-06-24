import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { preloadSprites, ensurePlaceholderTextures } from "../sprites";
import type { SpriteKey } from "../sprites";

// Logical roles → sprite registry keys (specs/games/shmup/content-and-assets.spec.md).
// Code never inlines a draw call or file path — it asks for one of these keys,
// and the registry decides whether that currently means a colored primitive
// or real art. Add new entities to sprites/manifest.json, not here.
const TEX = {
  ship: "shipPlayer",
  bullet: "bulletPlayer",
  enemy: "enemyDrone",
  star: "fxStarDust",
} satisfies Record<string, SpriteKey>;

const PLAYER_SPEED = 340; // px/s — shared by keyboard and drag so both move at the same rate
const DRAG_OFFSET_Y = 120; // float the ship well above the finger so it stays visible
const FIRE_COOLDOWN_MS = 160;

/**
 * Interactive placeholder slice — everything is a generated colored primitive
 * (placeholder-first art, per specs). Demonstrates the core loop: move, shoot,
 * destroy drifting targets, score. Controls: drag/point to move + auto-fire
 * (mobile-friendly), or arrows/WASD on desktop.
 */
export class PlayScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Image;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private stars!: Phaser.GameObjects.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private pointerTarget: { x: number; y: number } | null = null;
  private lastFired = 0;
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super("Play");
  }

  preload() {
    preloadSprites(this);
  }

  create() {
    ensurePlaceholderTextures(this);

    this.stars = this.add.group();
    for (let i = 0; i < 70; i++) {
      const s = this.add
        .image(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(0, GAME_HEIGHT), TEX.star)
        .setAlpha(Phaser.Math.FloatBetween(0.2, 1));
      s.setData("speed", Phaser.Math.Between(40, 180));
      this.stars.add(s);
    }

    this.player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 90, TEX.ship);
    this.player.setCollideWorldBounds(true);

    this.bullets = this.physics.add.group();
    this.enemies = this.physics.add.group();

    this.physics.add.overlap(this.bullets, this.enemies, (b, e) =>
      this.hitEnemy(b as Phaser.Physics.Arcade.Image, e as Phaser.Physics.Arcade.Image)
    );
    this.physics.add.overlap(this.player, this.enemies, () =>
      this.cameras.main.flash(140, 150, 0, 0)
    );

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;

    // Pointer / touch: drag-to-move (the ship follows the finger, floated above it).
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pointerTarget = { x: p.x, y: p.y - DRAG_OFFSET_Y };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.pointerTarget = { x: p.x, y: p.y - DRAG_OFFSET_Y };
    });
    this.input.on("pointerup", () => {
      this.pointerTarget = null;
    });

    this.time.addEvent({ delay: 650, loop: true, callback: () => this.spawnEnemy() });

    this.add
      .text(GAME_WIDTH / 2, 18, "SHMUP — placeholder build", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ff6b00",
      })
      .setOrigin(0.5, 0);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 22, "Drag to move · auto-fire   (or Arrows / WASD)", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#888888",
      })
      .setOrigin(0.5, 1);
    this.scoreText = this.add.text(16, 14, "SCORE 0", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#ffffff",
    });
  }

  private spawnEnemy() {
    const e = this.enemies.create(
      Phaser.Math.Between(24, GAME_WIDTH - 24),
      -20,
      TEX.enemy
    ) as Phaser.Physics.Arcade.Image;
    e.setVelocityY(Phaser.Math.Between(90, 190));
  }

  // Placeholder: fires on a fixed cadence regardless of targets.
  // TODO (future, see weapons spec): smart auto-fire — only fire when an enemy
  // is within a weapon's range/arc, and lead/target the nearest valid one.
  private fire(time: number) {
    if (time < this.lastFired) return;
    this.lastFired = time + FIRE_COOLDOWN_MS;
    const b = this.bullets.create(
      this.player.x,
      this.player.y - 20,
      TEX.bullet
    ) as Phaser.Physics.Arcade.Image;
    b.setVelocityY(-560);
  }

  private hitEnemy(bullet: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image) {
    bullet.destroy();
    enemy.destroy();
    this.score += 10;
    this.scoreText.setText("SCORE " + this.score);
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    const kbActive = left || right || up || down;

    if (kbActive) {
      // Keyboard overrides any active drag.
      this.pointerTarget = null;
      this.player.setVelocity(0);
      if (left) this.player.setVelocityX(-PLAYER_SPEED);
      if (right) this.player.setVelocityX(PLAYER_SPEED);
      if (up) this.player.setVelocityY(-PLAYER_SPEED);
      if (down) this.player.setVelocityY(PLAYER_SPEED);
    } else if (this.pointerTarget) {
      // Drag-to-move: glide toward the finger at the SAME capped speed as keyboard.
      this.player.setVelocity(0);
      const dx = this.pointerTarget.x - this.player.x;
      const dyToTarget = this.pointerTarget.y - this.player.y;
      const dist = Math.hypot(dx, dyToTarget);
      const step = PLAYER_SPEED * dt;
      if (dist <= step || dist === 0) {
        this.player.setPosition(this.pointerTarget.x, this.pointerTarget.y);
      } else {
        this.player.x += (dx / dist) * step;
        this.player.y += (dyToTarget / dist) * step;
      }
      this.player.x = Phaser.Math.Clamp(this.player.x, 16, GAME_WIDTH - 16);
      this.player.y = Phaser.Math.Clamp(this.player.y, 15, GAME_HEIGHT - 15);
    } else {
      this.player.setVelocity(0);
    }

    // Auto-fire (bullet-heaven default — no fire button).
    this.fire(time);

    (this.stars.getChildren() as Phaser.GameObjects.Image[]).forEach((s) => {
      s.y += (s.getData("speed") as number) * dt;
      if (s.y > GAME_HEIGHT) {
        s.y = 0;
        s.x = Phaser.Math.Between(0, GAME_WIDTH);
      }
    });

    (this.bullets.getChildren() as Phaser.Physics.Arcade.Image[]).forEach((b) => {
      if (b.y < -20) b.destroy();
    });
    (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).forEach((e) => {
      if (e.y > GAME_HEIGHT + 40) e.destroy();
    });
  }
}
