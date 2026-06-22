import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";

const TEX = { ship: "t_ship", bullet: "t_bullet", enemy: "t_enemy", star: "t_star" } as const;

/**
 * Interactive placeholder slice — everything is a generated colored primitive
 * (placeholder-first art, per specs). Demonstrates the core loop works:
 * move, shoot, destroy drifting targets, score. Real stat/weapon/grazing
 * systems land in their respective foundation issues.
 */
export class PlayScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Image;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private stars!: Phaser.GameObjects.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastFired = 0;
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super("Play");
  }

  create() {
    this.makeTextures();

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
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,SPACE") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;

    this.time.addEvent({ delay: 650, loop: true, callback: () => this.spawnEnemy() });

    this.add
      .text(GAME_WIDTH / 2, 18, "SHMUP — placeholder build", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ff6b00",
      })
      .setOrigin(0.5, 0);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 22, "Arrows / WASD to move  ·  Space to fire", {
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

  private makeTextures() {
    const g = this.add.graphics();
    g.fillStyle(0xff6b00).fillTriangle(16, 0, 0, 30, 32, 30);
    g.generateTexture(TEX.ship, 32, 30);
    g.clear();
    g.fillStyle(0xffcc88).fillRect(0, 0, 4, 12);
    g.generateTexture(TEX.bullet, 4, 12);
    g.clear();
    g.fillStyle(0x7b3dbe).fillRect(0, 0, 28, 28);
    g.generateTexture(TEX.enemy, 28, 28);
    g.clear();
    g.fillStyle(0xffffff).fillRect(0, 0, 2, 2);
    g.generateTexture(TEX.star, 2, 2);
    g.destroy();
  }

  private spawnEnemy() {
    const e = this.enemies.create(
      Phaser.Math.Between(24, GAME_WIDTH - 24),
      -20,
      TEX.enemy
    ) as Phaser.Physics.Arcade.Image;
    e.setVelocityY(Phaser.Math.Between(90, 190));
  }

  private fire(time: number) {
    if (time < this.lastFired) return;
    this.lastFired = time + 160;
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
    const speed = 340;
    this.player.setVelocity(0);
    if (this.cursors.left.isDown || this.keys.A.isDown) this.player.setVelocityX(-speed);
    if (this.cursors.right.isDown || this.keys.D.isDown) this.player.setVelocityX(speed);
    if (this.cursors.up.isDown || this.keys.W.isDown) this.player.setVelocityY(-speed);
    if (this.cursors.down.isDown || this.keys.S.isDown) this.player.setVelocityY(speed);
    if (this.cursors.space.isDown || this.keys.SPACE.isDown) this.fire(time);

    const dy = delta / 1000;
    (this.stars.getChildren() as Phaser.GameObjects.Image[]).forEach((s) => {
      s.y += (s.getData("speed") as number) * dy;
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
