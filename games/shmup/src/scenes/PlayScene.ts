import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";
import { copy, ratingsTierForScore, ratingsTierName, RATINGS_LADDER, weaponById, itemById, chassisById } from "../content";
import { preloadSprites, ensurePlaceholderTextures } from "../sprites";
import type { SpriteKey } from "../sprites";
import { Player, Enemy, EnemyBullet, PlayerBullet, Coin, AuthoredUnit } from "../entities";
import type { PlayerFireRequest, PlayerTarget, ShmupPlayScene } from "../entities";
import {
  absorbsBullet,
  applyDamage,
  applyLifesteal,
  polarityDamageMultiplier,
  reflexBulletSpeedMult,
  rollCrit,
  tickHpRegen,
  tickShieldRegen,
} from "../systems/combat";
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
} from "../systems/hype";
import type { HypeState, GrazeRingDef } from "../systems/hype";
import { rollSpawnArchetype, scaledEnemyStats, rewardCurve } from "../systems/difficulty";
import type { EnemyArchetypeId } from "../systems/difficulty";
import type { Polarity } from "../systems/chassis";
import { coinValue, rollsTip, statPickMods } from "../systems/economy";
import type { OwnedItem } from "../systems/effects";
import { DebugOverlay } from "../debug/DebugOverlay";
import { getDebugOverrides } from "../debug/debugSettings";
import { LevelRunner } from "../systems/encounters/LevelRunner";
import { collectLevelTextures } from "../systems/encounters/assets";
import { loadAuthoredContent } from "../systems/encounters/authoredContent";
import { loadAuthoredLevel } from "../systems/encounters/authoredLevel";
import { singleTileLayout, type LevelLayout } from "../systems/encounters/levelLayout";
import { LEVEL_SCROLL_SPEED, playerScreenY } from "../systems/encounters/scrollModel";
import type { AuthoredContent } from "../systems/encounters/authoredTypes";
import { SCENE_KEYS } from "./sceneData";
import type { EpisodeLaunchData, PlaytestResultData, ResolveLaunchData } from "./sceneData";

// Logical roles -> sprite registry keys (specs/games/shmup/content-and-assets.spec.md).
// Code never inlines a draw call or file path — it asks for one of these keys,
// and the registry decides whether that currently means a colored primitive
// or real art. Add new entries to sprites/manifest.json, not here.
const TEX = {
  ship: "shipPlayer",
  bulletPlayer: "bulletPlayer",
  bulletEnemy: "bulletEnemy",
  star: "fxStarDust",
  bg: "bgSpace",
  coin: "fxCoin",
} satisfies Record<string, SpriteKey>;

/** Per-archetype enemy texture — composition thresholds (run-structure.spec.todo.md) pick the archetype, this just resolves its look. */
const ENEMY_TEX: Record<EnemyArchetypeId, SpriteKey> = {
  drone: "enemyDrone",
  elite: "enemyElite",
  boss: "enemyBoss",
};

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
  private polarityKey!: Phaser.Input.Keyboard.Key;
  private pointerTarget: { x: number; y: number } | null = null;

  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private shieldBar!: Phaser.GameObjects.Graphics;

  // Gold & EXP (economy.spec.todo.md, F9 #137): gold is physical (coins must
  // be caught, Magnet Radius widens the catch); EXP is gained automatically
  // on kill. Both are only banked into CareerState by ResolveScene at the
  // end-of-level break — PlayScene never touches persisted career state.
  private coins!: Phaser.Physics.Arcade.Group;
  private goldCollected = 0;
  private goldText!: Phaser.GameObjects.Text;
  private expGained = 0;

  // Grazing / Hype / Ratings (hype-and-ratings.spec.md, F7 #135).
  private hypeEvents = new ShmupEventBus();
  private grazeTracker = new GrazeTracker();
  private hypeState: HypeState = { hype: 0, idleTimeSec: 0 };
  private hypeMaxValue = 0;
  private currentScoreMult = 1;
  private crowdSize = TUNING.hype.crowdSizeDefault;
  private grazeStreak = 0;
  private grazeTotalMult = 0;
  // Display-only cumulative Ratings entering this episode (HUD tier readout)
  // — Ratings never changes mid-episode (Model 1); the real delta is
  // computed on clear/death and applied by ResolveScene against the
  // persisted career, not here.
  private ratings = 0;
  // Standard/elite nodes clear on a survival timer (F6's vertical-slice
  // stage-end condition; run-structure.spec.todo.md's real per-stage content
  // is a future content pass). Boss nodes clear on defeating the boss instead
  // — see isBossNode.
  private elapsedEpisodeSec = 0;
  private hypeBar!: Phaser.GameObjects.Graphics;
  private ratingsBar!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private tierNameText!: Phaser.GameObjects.Text;

  private gameOver = false;
  private debugOverlay!: DebugOverlay;
  private enemySpawnCooldownMs = 0;

  // The node/Difficulty/build this episode was launched with (Map -> Play,
  // sceneData.ts) — set in init(), read-only for the rest of the episode.
  private episode!: EpisodeLaunchData;
  private isBossNode = false;
  private boss: Enemy | null = null;

  // Authored-content mode (`systems/encounters`): the episode is a scrolling
  // level of `/shmup-editor` tiles instead of the ambient spawner.
  // Everything else about the episode — ship, weapons, Hype, coins, HUD — is
  // unchanged, which is the point: an author sees their content in the real
  // game, not a preview of it. Null on every normal episode.
  private levelRunner: LevelRunner | null = null;
  private authoredContent: AuthoredContent | null = null;
  private authoredLayout: LevelLayout | null = null;
  /** Authored hostiles (enemies, their hittable Parts, enemy projectiles) and the friendly-fire mirror of the same. */
  private authoredHostiles!: Phaser.Physics.Arcade.Group;
  private authoredFriendlies!: Phaser.Physics.Arcade.Group;

  constructor() {
    super("Play");
  }

  init(data: EpisodeLaunchData) {
    this.episode = data;
    this.isBossNode = data.nodeType === "bossFinale";
    this.authoredContent = null;
    this.authoredLayout = null;
    if (!data.playtest) return;

    // Resolved in init() rather than create() so preload() below knows which
    // authored art to queue. A reference that no longer resolves (the tile
    // was deleted, or no layout has been saved) falls back to a normal
    // episode rather than failing to start.
    const content = loadAuthoredContent();
    const layout = data.playtest.tileId ? singleTileLayout(data.playtest.tileId) : loadAuthoredLevel();
    if (layout.placements.length === 0) return;
    this.authoredContent = content;
    this.authoredLayout = layout;
  }

  /** True when this episode is running authored content rather than the ambient spawner. */
  private get isEncounterEpisode(): boolean {
    return this.authoredLayout !== null;
  }

  preload() {
    preloadSprites(this);
    if (!this.authoredContent || !this.authoredLayout) return;
    // Every placed tile's art plus every unit any of their Encounters could
    // roll — see `assets.ts` on why those two walks have to be independent.
    for (const request of collectLevelTextures(this.authoredContent, this.authoredLayout, this.episode.playtest?.encounterId)) {
      if (!this.textures.exists(request.key)) this.load.image(request.key, request.url);
    }
  }

  create() {
    ensurePlaceholderTextures(this);
    this.gameOver = false;
    this.boss = null;
    this.score = 0;
    this.goldCollected = 0;
    this.expGained = 0;

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
    this.ratings = this.episode.ratings;

    this.levelRunner?.destroy();
    this.levelRunner = null;

    this.background = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEX.bg)
      .setDepth(-20);

    // The drifting starfield belongs to the stock space backdrop; over an
    // authored tile's terrain art it would read as snow.
    this.stars = this.add.group();
    for (let i = 0; i < (this.isEncounterEpisode ? 0 : TUNING.visuals.starCount); i++) {
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
    this.coins = this.physics.add.group({
      classType: Coin,
      maxSize: TUNING.performance.maxCoins,
      runChildUpdate: true,
    });
    // Authored units drive their own position/facing from the encounter
    // clock, so unlike the pooled groups above they deliberately do NOT use
    // runChildUpdate — `EncounterRunner.update` is their update.
    this.authoredHostiles = this.physics.add.group({
      classType: AuthoredUnit,
      maxSize: TUNING.encounters.maxAuthoredUnits,
    });
    this.authoredFriendlies = this.physics.add.group({
      classType: AuthoredUnit,
      maxSize: TUNING.encounters.maxAuthoredUnits,
    });

    const weapons = this.episode.weapons.map((w) => ({ weapon: weaponById(w.weaponId), tier: w.tier }));
    const ownedItems: OwnedItem[] = this.episode.items
      .map((ref) => {
        const item = itemById(ref.itemId);
        return item ? { item, count: ref.count } : undefined;
      })
      .filter((owned): owned is OwnedItem => owned !== undefined);
    const persistentStatMods = statPickMods(this.episode.statPicks);
    this.player = new Player(
      this,
      GAME_WIDTH / 2,
      playerScreenY(),
      TEX.ship,
      weapons,
      getDebugOverrides(),
      ownedItems,
      persistentStatMods,
      chassisById(this.episode.chassisId)
    );
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

    // The authored collision matrix: same group never checks itself, and the
    // two projectile groups never check each other. That falls out of only
    // wiring hostiles<->player-side and friendlies<->hostiles, with no
    // spawner-lineage tracking anywhere.
    this.physics.add.overlap(this.playerBullets, this.authoredHostiles, (bulletObj, targetObj) =>
      this.onPlayerBulletHitTarget(bulletObj as PlayerBullet, targetObj as AuthoredUnit)
    );
    this.physics.add.overlap(this.authoredHostiles, this.player, (_player, targetObj) =>
      this.onAuthoredContactPlayer(targetObj as AuthoredUnit)
    );
    this.physics.add.overlap(this.authoredFriendlies, this.authoredHostiles, (friendlyObj, hostileObj) =>
      this.onAuthoredFriendlyHitHostile(friendlyObj as AuthoredUnit, hostileObj as AuthoredUnit)
    );

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.focusKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    // Polarity switch (chassis.spec.md's Ikaruga flagship example) — harmless
    // to bind even on a chassis without `polarity`, since `togglePolarity()`
    // no-ops without one. Mobile polarity switching is TBD, same as Focus.
    this.polarityKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);

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
    this.startLevel();
    if (this.isBossNode && !this.isEncounterEpisode) this.spawnBoss();

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

    this.goldText = this.add
      .text(16, 34, copy("play.gold", { gold: 0 }), {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffcc00",
      })
      .setDepth(100);

    this.add
      .text(90, 34, copy("play.level", { level: this.episode.level }), {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#aa88ff",
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

    this.debugOverlay = new DebugOverlay(
      this,
      this.player,
      () => ({
        hype: this.hypeState.hype,
        hypeMax: this.hypeMaxValue,
        scoreMult: this.currentScoreMult,
        grazeStreak: this.grazeStreak,
        grazeTotalMult: this.grazeTotalMult,
        ratings: this.ratings,
        ratingsTier: ratingsTierName(ratingsTierForScore(this.ratings)),
      }),
      () => this.debugAdvanceStage()
    );
  }

  /** Stands the authored level up, once the player and groups exist for it to reference. */
  private startLevel(): void {
    if (!this.authoredContent || !this.authoredLayout) return;
    this.levelRunner = new LevelRunner({
      scene: this,
      content: this.authoredContent,
      layout: this.authoredLayout,
      difficulty: this.episode.playtest?.difficulty ?? this.episode.D,
      hostiles: this.authoredHostiles,
      friendlies: this.authoredFriendlies,
      playerPos: () => ({ x: this.player.x, y: this.player.y }),
      fallbackTexture: TEX.bulletEnemy,
      forceEncounterId: this.episode.playtest?.encounterId,
    });
  }

  /** Debug-only (C12 #151 follow-up): instantly resolves the current episode as a clear, regardless of node type — a boss node kills the boss outright (through the normal win path) rather than skipping it, so Ratings/score still come out right. */
  private debugAdvanceStage(): void {
    if (this.gameOver) return;
    if (this.isEncounterEpisode) {
      // An authored encounter can legitimately end with something parked on
      // screen that the player can't remove (an invincible unit, say), so
      // this is also the escape hatch out of one.
      this.clearEpisode();
      return;
    }
    if (this.isBossNode && this.boss?.active) {
      this.damageEnemy(this.boss, this.boss.hp, 0);
      return;
    }
    this.clearEpisode();
  }

  update(_time: number, delta: number) {
    this.debugOverlay.update();
    this.physics.world.drawDebug = this.player.debugShowHitboxes;
    if (!this.physics.world.drawDebug) this.physics.world.debugGraphic?.clear();
    if (this.gameOver) return;

    // Pausing gameplay while the debug menu is open (not just hiding it
    // behind the panel) is what makes a full-screen panel usable — physics
    // stepping (and therefore movement/collisions) freezes, but this scene's
    // own update() keeps running so the overlay's toggle/shortcuts still work.
    if (this.debugOverlay.isOpen) {
      this.physics.pause();
      return;
    }
    this.physics.resume();

    const dt = delta / 1000;

    if (Phaser.Input.Keyboard.JustDown(this.polarityKey)) this.player.togglePolarity();

    this.updateMovement(dt);
    this.player.tickIFrame(delta);
    this.updateGrazeAndHype(dt);
    this.updateCoins(dt);

    for (const req of this.player.tryFire(delta)) {
      this.fireWeapon(req);
    }

    // An authored encounter IS the episode's content — the ambient spawner
    // would just be noise on top of it.
    if (!this.isBossNode && !this.isEncounterEpisode) {
      this.enemySpawnCooldownMs -= delta;
      if (this.enemySpawnCooldownMs <= 0) this.spawnEnemy();
    }
    if (this.levelRunner) {
      this.levelRunner.update(dt);
      if (this.levelRunner.complete) {
        this.clearEpisode();
        return;
      }
    }

    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (enemy.active && enemy.tryFire(delta)) this.fireEnemyBullet(enemy);
    }

    tickShieldRegen(this.player.defender, this.player.stats.maxShield, dt);
    tickHpRegen(this.player.defender, this.player.stats.maxHp, this.player.stats.hpRegen, dt);
    this.updateHud();

    // The parallax backdrop drifts with the level rather than at its own
    // cosmetic rate while authored terrain is on screen, so the strip of
    // void above and below the tiles moves at the same speed they do.
    this.background.tilePositionY -= (this.isEncounterEpisode ? LEVEL_SCROLL_SPEED : TUNING.visuals.bgScrollSpeed) * dt;
    for (const star of this.stars.getChildren() as Phaser.GameObjects.Image[]) {
      star.y += (star.getData("speed") as number) * dt;
      if (star.y > GAME_HEIGHT) {
        star.y = 0;
        star.x = Phaser.Math.Between(0, GAME_WIDTH);
      }
    }

    // Standard/elite nodes clear on the survival timer; a boss node clears
    // on the boss dying; an authored encounter clears when it has played
    // through (handled above), so no timer applies to it.
    if (!this.isBossNode && !this.isEncounterEpisode) {
      this.elapsedEpisodeSec += dt;
      if (this.elapsedEpisodeSec >= this.player.effectiveEpisodeClearDurationSec) {
        this.clearEpisode();
      }
    }
  }

  /**
   * Graze detection (concentric rings around grazeRadius, innermost-only
   * payout) feeds the Hype meter directly: gain while actively grazing,
   * super-linear decay otherwise (Model 1 formulas, hype-and-ratings.spec.md).
   */
  private updateGrazeAndHype(dt: number): void {
    const grazeMap = new Map<number, GrazeRingDef>();
    const addGraze = (x: number, y: number, spawnId: number) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
      const ring = grazeRingAt(dist, this.player.stats.grazeRadius, TUNING.graze.rings);
      if (ring) grazeMap.set(spawnId, ring);
    };
    for (const bullet of this.enemyBullets.getChildren() as EnemyBullet[]) {
      if (bullet.active) addGraze(bullet.x, bullet.y, bullet.spawnId);
    }
    // Authored enemy projectiles graze exactly like built-in ones — the
    // shared spawn-id counter (`entities/spawnId.ts`) is what lets both feed
    // one tracker without their ids colliding.
    for (const projectile of this.levelRunner?.hostileProjectiles() ?? []) {
      addGraze(projectile.x, projectile.y, projectile.spawnId);
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

  /**
   * Composition thresholds (run-structure.spec.todo.md): an "elite" node
   * forces an elite-heavy fight, a "standard" node rolls the archetype per
   * spawn against the current D (elites locked out below eliteUnlockD).
   */
  private spawnEnemy(): void {
    if (this.gameOver) return;
    const archetype: EnemyArchetypeId = this.episode.nodeType === "elite" ? "elite" : rollSpawnArchetype(this.episode.D);
    const stats = scaledEnemyStats(archetype, TUNING.enemies[archetype], this.episode.D);
    const x = Phaser.Math.Between(24, GAME_WIDTH - 24);
    const y = -20;
    const enemy = this.enemies.get(x, y, ENEMY_TEX[archetype]) as Enemy | null;
    enemy?.spawn(x, y, archetype, stats);
    this.enemySpawnCooldownMs = this.player.debugEnemySpawnIntervalMs ?? stats.spawnIntervalMs;
  }

  /** Single Season/Series Finale boss (run-structure.spec.todo.md) — spawned once, no regular spawner alongside it. */
  private spawnBoss(): void {
    const stats = scaledEnemyStats("boss", TUNING.enemies.boss, this.episode.D);
    const x = GAME_WIDTH / 2;
    const y = 170;
    const enemy = this.enemies.get(x, y, ENEMY_TEX.boss) as Enemy | null;
    if (!enemy) return;
    enemy.spawn(x, y, "boss", stats);
    this.boss = enemy;
  }

  private fireEnemyBullet(enemy: Enemy): void {
    const x = enemy.x;
    const y = enemy.y + enemy.height / 2;
    const speed = enemy.bulletSpeed * reflexBulletSpeedMult(this.player.stats.reflexes);
    const bullet = this.enemyBullets.get(x, y, TEX.bulletEnemy) as EnemyBullet | null;
    bullet?.fire(x, y, 0, speed, enemy.bulletDamage, enemy.polarity);
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
    // Baked in once per shot, same as crit (combat.spec.todo.md) — a switch
    // mid-flight never retroactively changes an already-fired shot. Null on
    // a chassis without `polarity`, which always resolves to no gating.
    const shotPolarity = this.player.chassis.polarity ? this.player.polarity : null;

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
      this.player.effectiveForkConeDeg,
      shotPolarity
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
    forkConeDeg: number,
    shotPolarity: Polarity | null
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
      forkConeDeg,
      shotPolarity
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
    inheritedHit: PlayerTarget | undefined,
    shotPolarity: Polarity | null
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
      inheritedHit,
      shotPolarity
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
    this.onPlayerBulletHitTarget(bullet, enemy);
  }

  /**
   * The one player-shot impact path, shared by built-in enemies and
   * authored ones. Nothing here needs to know which it hit: `PlayerTarget`
   * supplies the identity the pierce/fork hit-list keys on, the
   * `damageMultiplier` of the exact spot that was struck (an authored weak
   * point or armor plate; always 1 on a built-in enemy), and the routing
   * rule for where the damage actually lands.
   */
  private onPlayerBulletHitTarget(bullet: PlayerBullet, target: PlayerTarget): void {
    if (this.gameOver || !bullet.active || !target.active || bullet.hasHit(target)) return;
    // An invincible authored unit isn't hit at all — not "hit for zero" —
    // so it never consumes one of the bullet's pierce charges.
    if (target instanceof AuthoredUnit && !target.hittable) return;
    const fraction = bullet.registerHit(target);
    if (fraction === undefined) return;

    // "Current polarity gates which enemies take full damage from your
    // shots" (chassis.spec.md's Ikaruga flagship example) — a no-op
    // multiplier of 1 on any chassis without `polarity`.
    const mult = polarityDamageMultiplier(this.player.chassis.polarity, bullet.shotPolarity, target.polarity);
    this.damageTarget(target, bullet.baseHit * fraction * mult * target.damageMultiplier, bullet.numCrits);

    if (bullet.blastRadius > 0) {
      const blastDamage = bullet.baseHit * bullet.blastDamageFraction;
      for (const other of this.playerTargets()) {
        if (other === target || !other.active) continue;
        const dist = Phaser.Math.Distance.Between(target.x, target.y, other.x, other.y);
        if (dist <= bullet.blastRadius) {
          const blastMult = polarityDamageMultiplier(this.player.chassis.polarity, bullet.shotPolarity, other.polarity);
          this.damageTarget(other, blastDamage * blastMult * other.damageMultiplier, bullet.numCrits);
        }
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
        target,
        bullet.shotPolarity
      );
    }
  }

  /** Everything a player shot may currently hit — built-in enemies plus every live authored hostile. Also what homing searches. */
  playerTargets(): PlayerTarget[] {
    const out: PlayerTarget[] = [];
    for (const enemy of this.enemies.getChildren() as Enemy[]) if (enemy.active) out.push(enemy);
    for (const unit of this.authoredHostiles.getChildren() as AuthoredUnit[]) {
      if (unit.active && unit.hittable) out.push(unit);
    }
    return out;
  }

  private damageEnemy(enemy: Enemy, damage: number, numCrits: number): void {
    this.damageTarget(enemy, damage, numCrits);
  }

  /**
   * `applyDamage` returns whatever actually died — which is not always what
   * was hit, since an authored Part without its own health passes damage
   * through to the hull it's bolted to. Paying out against the returned
   * entity is what puts the score, EXP and coin drop on the hull rather
   * than on the turret.
   */
  private damageTarget(target: PlayerTarget, damage: number, numCrits: number): void {
    applyLifesteal(this.player.defender, this.player.stats.maxHp, damage, this.player.stats.lifesteal);
    this.spawnDamageNumber(target.x, target.y, damage, numCrits);
    const defeated = target.applyDamage(damage);
    if (!defeated) return;
    // A destroyed Part scores 0 by construction — no payout, no coin, but
    // it still came off the field.
    if (defeated.scoreValue > 0) {
      this.gainScore(defeated.scoreValue);
      this.gainExp(defeated.scoreValue);
      this.spawnCoinDrop(defeated.x, defeated.y);
    }
    // Boss defeated is the bossFinale node's clear condition — standard/elite
    // nodes clear on the survival timer instead (see update()).
    if (defeated instanceof Enemy && defeated.archetype === "boss" && !this.gameOver) this.clearEpisode();
  }

  /** EXP is gained automatically on kill, no collection (economy.spec.todo.md's hard rule) — batched into level-up picks only at the end-of-level break by ResolveScene/LevelUpScene, never mid-play. */
  private gainExp(baseAmount: number): void {
    this.expGained += baseAmount * TUNING.economy.expPerScoreValue * this.player.stats.expGain;
  }

  /** Gold is physical (economy.spec.todo.md): every kill explodes into a coin the player must catch, plus a chance at a bonus "tip" coin once Hype is high enough. */
  private spawnCoinDrop(x: number, y: number): void {
    const baseValue = TUNING.economy.coinValueBase * rewardCurve(this.episode.D);
    this.spawnCoin(x, y, baseValue);

    const hypeFrac = this.hypeMaxValue > 0 ? this.hypeState.hype / this.hypeMaxValue : 0;
    if (rollsTip(hypeFrac)) {
      const offsetX = Phaser.Math.Between(-40, 40);
      const offsetY = Phaser.Math.Between(-40, 40);
      this.spawnCoin(x + offsetX, y + offsetY, baseValue * TUNING.economy.tipsValueMult);
    }
  }

  private spawnCoin(x: number, y: number, value: number): void {
    const coin = this.coins.get(x, y, TEX.coin) as Coin | null;
    coin?.spawn(x, y, value);
  }

  /**
   * Coins pop up and outward on spawn, arced by gravity, and bounce off the
   * side walls (`Coin.spawn()`) — a coin can be caught mid-arc, which is
   * what makes this a skill/positioning act rather than a guaranteed
   * pickup. Once within Magnet Radius it locks on and flies straight to the
   * player instead (`Coin.startHoming()` hands off from Arcade's gravity/
   * bounce to this direct-position homing, once, on the lock-on frame). A
   * coin that never gets caught either despawns on its own
   * (`Coin.preUpdate`'s lifespan) or falls off the bottom of the screen.
   */
  private updateCoins(dt: number): void {
    const magnetRadius = this.player.stats.magnetRadius;
    for (const coin of this.coins.getChildren() as Coin[]) {
      if (!coin.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, coin.x, coin.y);
      if (dist <= TUNING.economy.coinCollectRadius) {
        this.collectCoin(coin);
        continue;
      }
      if (!coin.magnetized && dist <= magnetRadius) {
        coin.magnetized = true;
        coin.startHoming();
      }
      if (coin.magnetized) {
        const step = TUNING.economy.coinMagnetSpeed * dt;
        const denom = Math.max(1, dist);
        coin.x += ((this.player.x - coin.x) / denom) * step;
        coin.y += ((this.player.y - coin.y) / denom) * step;
      }
    }
  }

  private collectCoin(coin: Coin): void {
    const banked = coinValue(coin.value, this.player.stats.creditScore);
    this.goldCollected += banked;
    this.goldText.setText(copy("play.gold", { gold: Math.round(this.goldCollected) }));
    this.spawnFloatingText(coin.x, coin.y, `+${Math.round(banked)}g`, "#ffcc00", 14);
    coin.recycle();
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
    if (absorbsBullet(this.player.chassis.polarity, this.player.polarity, bullet.polarity)) {
      this.absorbBullet();
      return;
    }
    this.damagePlayer(bullet.damage);
  }

  /**
   * Same-color absorption feeds the same underlying graze-multiplier stat,
   * repurposed as this chassis's absorb-meter gain rate (chassis.spec.md's
   * Ikaruga flagship example) — an instantaneous Hype pulse through the
   * exact `gainHype()` path grazing already uses, not a new meter.
   */
  private absorbBullet(): void {
    const polarityDef = this.player.chassis.polarity;
    if (!polarityDef) return;
    this.hypeState = gainHype(this.hypeState, polarityDef.absorbHypeBase, this.hypeMaxValue, this.player.stats.grazeMultiplier);
    this.hypeEvents.emit("hypeChanged", {
      hype: this.hypeState.hype,
      hypeMax: this.hypeMaxValue,
      scoreMult: this.currentScoreMult,
    });
  }

  private onEnemyContactPlayer(enemy: Enemy): void {
    if (this.gameOver || !enemy.active) return;
    const contactDamage = enemy.contactDamage;
    if (enemy.archetype !== "boss") enemy.recycle(); // a boss keeps patrolling through contact, it isn't a one-touch kill
    this.damagePlayer(contactDamage);
  }

  /**
   * An authored **projectile** is spent on contact, like any bullet. An
   * authored **enemy** is not: it's walking an authored path, and having it
   * evaporate the instant the player brushes it would delete content the
   * author placed. The player's i-frames are what stop a lingering overlap
   * from draining them.
   */
  private onAuthoredContactPlayer(unit: AuthoredUnit): void {
    if (this.gameOver || !unit.active || !unit.hittable) return;
    const contactDamage = unit.contactDamage;
    if (unit.collisionGroup === "enemyProjectile") unit.recycle();
    if (contactDamage > 0) this.damagePlayer(contactDamage);
  }

  /** A friendly authored unit (an authored Unit spawned into a friendly group) trading contact damage with a hostile one. */
  private onAuthoredFriendlyHitHostile(friendly: AuthoredUnit, hostile: AuthoredUnit): void {
    if (this.gameOver || !friendly.active || !hostile.active || !hostile.hittable) return;
    if (friendly.collisionGroup === "friendlyProjectile") friendly.recycle();
    if (friendly.contactDamage > 0) this.damageTarget(hostile, friendly.contactDamage * hostile.damageMultiplier, 0);
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

  // No-hull-lives model (combat.spec.todo.md / run-structure.spec.todo.md):
  // one death ends the episode. PlayScene never touches persisted Ratings or
  // career state itself (root CLAUDE.md's reload-mid-episode rule) — it just
  // computes the Ratings delta and hands off to ResolveScene, which applies
  // it to the loaded career and returns to the map.
  //
  // stageProgress on a boss node is how much of the boss's HP got chewed
  // through (a real measure of how close the fight was); on a standard/elite
  // node it's elapsedEpisodeSec/episodeClearDurationSec, so dying immediately
  // loses the full base penalty and dying right at the clear line loses
  // ~nothing either way.
  private endEpisode(): void {
    this.gameOver = true;
    if (this.finishPlaytest("death")) return;
    const stageProgress = this.isBossNode
      ? this.boss
        ? 1 - Math.max(0, this.boss.hp) / this.boss.maxHp
        : 0
      : this.player.effectiveEpisodeClearDurationSec > 0
        ? this.elapsedEpisodeSec / this.player.effectiveEpisodeClearDurationSec
        : 1;
    const loss = ratingsLossOnDeath(stageProgress);
    this.scene.start(SCENE_KEYS.resolve, {
      outcome: "death",
      nodeId: this.episode.nodeId,
      nodeType: this.episode.nodeType,
      season: this.episode.season,
      isSeriesFinale: this.episode.isSeriesFinale,
      score: Math.round(this.score),
      ratingsBefore: this.episode.ratings,
      ratingsDelta: -loss,
      goldCollected: Math.round(this.goldCollected),
      expGained: Math.round(this.expGained),
    } satisfies ResolveLaunchData);
  }

  /**
   * Basic end-of-episode cash-in of Hype into Ratings (hype-and-ratings.spec.md,
   * F7 #135's Model 1) — the resulting delta hands off to ResolveScene, which
   * applies it to the persisted career and returns to the map.
   */
  private clearEpisode(): void {
    this.gameOver = true;
    if (this.finishPlaytest("complete")) return;
    const gain = ratingsGainOnClear(this.score);
    this.scene.start(SCENE_KEYS.resolve, {
      outcome: "clear",
      nodeId: this.episode.nodeId,
      nodeType: this.episode.nodeType,
      season: this.episode.season,
      isSeriesFinale: this.episode.isSeriesFinale,
      score: Math.round(this.score),
      ratingsBefore: this.episode.ratings,
      ratingsDelta: gain,
      goldCollected: Math.round(this.goldCollected),
      expGained: Math.round(this.expGained),
    } satisfies ResolveLaunchData);
  }

  /**
   * A playtest run returns straight to the picker instead of routing
   * through ResolveScene. That's the whole reason `playtest` is its own
   * flag: Resolve applies Ratings, gold and EXP to the **persisted career**,
   * and trying out an encounter you're in the middle of authoring must not
   * be able to cost (or pay) a real run. Returns false on a normal episode,
   * leaving the caller's usual path alone.
   */
  private finishPlaytest(outcome: "complete" | "death"): boolean {
    const playtest = this.episode.playtest;
    if (!playtest) return false;
    this.levelRunner?.destroy();
    this.levelRunner = null;
    this.scene.start(SCENE_KEYS.playtestResult, {
      tileId: playtest.tileId,
      encounterId: playtest.encounterId,
      difficulty: playtest.difficulty,
      outcome,
      score: Math.round(this.score),
    } satisfies PlaytestResultData);
    return true;
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

    // Timer: countdown from episodeClearDurationSec in MM:SS — replaced by a
    // boss HP readout on a bossFinale node, which clears on defeat instead.
    if (this.levelRunner) {
      // An authored encounter has no survival timer: what's left to do is
      // however much of it hasn't been cleared yet.
      this.timerText.setText(copy("play.encounter.remaining", { count: this.levelRunner.liveEnemyCount }));
    } else if (this.isBossNode) {
      const hpFrac2 = this.boss ? Phaser.Math.Clamp(this.boss.hp / this.boss.maxHp, 0, 1) : 0;
      this.timerText.setText(`BOSS ${Math.round(hpFrac2 * 100)}%`);
    } else {
      const remaining = Math.max(0, this.player.effectiveEpisodeClearDurationSec - this.elapsedEpisodeSec);
      const mins = Math.floor(remaining / 60);
      const secs = Math.floor(remaining % 60);
      this.timerText.setText(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    }
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
