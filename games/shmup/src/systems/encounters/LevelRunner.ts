import Phaser from "phaser";
import { GAME_HEIGHT } from "../../config";
import { editorTileImageUrl, editorTileTextureKey } from "../../sprites/editorArt";
import { EncounterRunner } from "./EncounterRunner";
import { pickEncounter } from "./authoredLevel";
import { tileFrameAt, tileLocalSec, type TileFrame } from "./frame";
import type { LevelLayout, TilePlacement } from "./levelLayout";
import { TILE_UNIT, tileEngageSec, tileFullyOffScreen, tileLifespanSec } from "./scrollModel";
import type { AuthoredContent, AuthoredEncounter, AuthoredTile, Vec2 } from "./authoredTypes";
import type { AuthoredUnit } from "../../entities/AuthoredUnit";
import { DEPTH } from "../depth";

/**
 * Scrolls a level past the player and runs each tile's encounter as it
 * arrives.
 *
 * A shmup level moves **down**: the player advances north, terrain slides
 * south across the screen, and each tile arrives at the top just before it
 * is needed. Tiles are ordered by depth (`levelLayout.ts`), and depth alone
 * decides when a tile engages — `scrollModel.ts` anchors the clock so that
 * at a tile's own time zero the tile is entirely off the top of the screen,
 * south edge flush with it, and scrolls in from there. Anything authored on
 * (or above) the tile therefore starts off-screen and flies in, rather than
 * appearing mid-screen the instant the tile loads. A single-tile encounter
 * playtest is not a special case at all: it's a level of one tile at depth
 * 0, and it looks identical to that same tile played as depth 7.
 *
 * A tile is done the moment **either** its authored content is spent
 * (`EncounterRunner.complete`) **or** it has scrolled entirely off the
 * bottom of the screen — whichever comes first. The second half is what
 * stops an authored unit that parks itself on screen, or one the player
 * can't kill, from stalling a level: the ground moves on regardless.
 *
 * **A tile with no Encounter at all is ordinary terrain, not an instantly
 * finished tile.** It has nothing to spend, so only the scrolled-off half
 * applies to it — it draws and scrolls past like any other. Treating "no
 * encounter" as "already complete" would retire it the instant it engaged
 * and, since the level ends when every tile is done, could end a level
 * while its last stretch of ground was still on screen.
 */

/** Tile art sits above the parallax backdrop (-20) and below every gameplay sprite (1+). */
const TILE_ART_DEPTH = DEPTH.tileArt;

interface LiveTile {
  placement: TilePlacement;
  tile: AuthoredTile;
  encounter: AuthoredEncounter | null;
  engageSec: number;
  /** One image per footprint column — the art is a whole 1x1 square, repeated across a wider tile. */
  art: Phaser.GameObjects.Image[];
  runner: EncounterRunner | null;
  /** Set once the tile is done, either way it can be done. */
  finished: boolean;
}

export interface LevelRunnerConfig {
  scene: Phaser.Scene;
  content: AuthoredContent;
  layout: LevelLayout;
  /** Incoming Difficulty budget, handed to every tile's encounter. */
  difficulty: number;
  hostiles: Phaser.Physics.Arcade.Group;
  friendlies: Phaser.Physics.Arcade.Group;
  playerPos: () => Vec2;
  fallbackTexture: string;
  /** Injected so a level can be made reproducible from a seed later; the playtest passes `Math.random`. */
  rng?: () => number;
  /**
   * Pins every tile to this Encounter id instead of rolling one. Set by the
   * Encounter editor's own Play Test, where the whole point is to see *that*
   * encounter — a level playtest leaves it unset so each tile rolls its own,
   * which is what the tile model actually specifies.
   */
  forceEncounterId?: string;
}

export class LevelRunner {
  private readonly config: LevelRunnerConfig;
  private readonly tiles: LiveTile[] = [];
  private levelSec = 0;
  /** When the last tile will have scrolled entirely off screen — the level's own hard end. */
  private readonly lastExitSec: number;

  constructor(config: LevelRunnerConfig) {
    this.config = config;
    const rng = config.rng ?? Math.random;

    for (const placement of config.layout.placements) {
      const tile = config.content.tiles.find((t) => t.id === placement.tileId);
      // A layout can outlive the tile it references — the editor saves ids,
      // not copies, precisely so tile edits show through, which also means a
      // deleted tile leaves a hole rather than breaking the level.
      if (!tile) continue;
      const forced = config.forceEncounterId ? tile.encounters.find((e) => e.id === config.forceEncounterId) : undefined;
      this.tiles.push({
        placement,
        tile,
        encounter: forced ?? pickEncounter(tile, rng),
        engageSec: tileEngageSec(placement.depth),
        art: this.createArt(tile, placement),
        runner: null,
        finished: false,
      });
    }

    this.lastExitSec = this.tiles.reduce((max, t) => Math.max(max, t.engageSec + tileLifespanSec()), tileLifespanSec());
  }

  get elapsedSec(): number {
    return this.levelSec;
  }

  /** How many hand-placed enemies are alive across every engaged tile — the HUD's "what's left" readout. */
  get liveEnemyCount(): number {
    return this.tiles.reduce((n, t) => n + (t.runner?.liveEnemyCount ?? 0), 0);
  }

  /** True when there is nothing left to scroll in and nothing left to fight. */
  get complete(): boolean {
    if (this.tiles.length === 0) return true;
    if (this.levelSec >= this.lastExitSec) return true;
    return this.tiles.every((t) => t.finished);
  }

  /** Every live hostile projectile across the level — what grazing measures itself against. */
  hostileProjectiles(): AuthoredUnit[] {
    const out: AuthoredUnit[] = [];
    for (const tile of this.tiles) {
      if (tile.runner) out.push(...tile.runner.hostileProjectiles());
    }
    return out;
  }

  update(dtSec: number): void {
    this.levelSec += dtSec;

    for (const tile of this.tiles) {
      const localSec = tileLocalSec(tile.placement, this.levelSec);
      const frame = tileFrameAt(tile.placement, tile.tile.footprint, this.config.layout.columns, this.levelSec);
      this.positionArt(tile, frame);

      if (localSec < 0) continue; // still ahead of the player, waiting its turn
      if (tile.finished) continue;

      if (!tile.runner && tile.encounter) tile.runner = this.startEncounter(tile, frame);
      if (tile.runner) {
        tile.runner.setFrame(frame);
        tile.runner.update(dtSec);
      }

      // Either half of the end condition finishes a tile: its content is
      // spent, or the ground it was standing on is gone. A tile with no
      // Encounter has no content to spend, so only the second half applies.
      const contentSpent = tile.encounter !== null && (tile.runner?.complete ?? false);
      if (tileFullyOffScreen(localSec) || contentSpent) this.finishTile(tile);
    }
  }

  /** Recycles everything on the field and removes the level's art. */
  destroy(): void {
    for (const tile of this.tiles) {
      tile.runner?.destroy();
      tile.runner = null;
      for (const image of tile.art) image.destroy();
      tile.art.length = 0;
    }
    this.tiles.length = 0;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private startEncounter(tile: LiveTile, frame: TileFrame): EncounterRunner | null {
    if (!tile.encounter) return null;
    return new EncounterRunner({
      scene: this.config.scene,
      content: this.config.content,
      tile: tile.tile,
      encounter: tile.encounter,
      difficulty: this.config.difficulty,
      frame,
      orientation: tile.placement.orientation,
      footprint: tile.tile.footprint,
      hostiles: this.config.hostiles,
      friendlies: this.config.friendlies,
      playerPos: this.config.playerPos,
      fallbackTexture: this.config.fallbackTexture,
    });
  }

  private finishTile(tile: LiveTile): void {
    tile.finished = true;
    // A tile that scrolled away takes its content with it — anything still
    // alive on it is behind the player now and has nothing left to do.
    tile.runner?.destroy();
    tile.runner = null;
  }

  /**
   * One image per footprint column: the built-in art is a whole 1x1 square,
   * so a 2- or 3-wide tile shows one full copy per column rather than a
   * stretched one (matching `tileImages.ts`'s own note).
   *
   * Orientation is applied as `flipX` plus a **negated** rotation, because
   * Phaser flips in texture space before rotating while `levelLayout.ts`
   * rotates before flipping — and `flip ∘ rotate(θ)` is the same
   * transform as `rotate(-θ) ∘ flipTexture`.
   */
  private createArt(tile: AuthoredTile, placement: TilePlacement): Phaser.GameObjects.Image[] {
    if (!editorTileImageUrl(tile.imageId, tile.customImage)) return [];
    const key = editorTileTextureKey(tile.imageId, tile.id);
    if (!this.config.scene.textures.exists(key)) return [];

    const { rotation, flip } = placement.orientation;
    return Array.from({ length: tile.footprint }, () => {
      const image = this.config.scene.add.image(0, 0, key).setOrigin(0.5).setDepth(TILE_ART_DEPTH);
      image.setDisplaySize(TILE_UNIT, TILE_UNIT);
      image.setRotation(Phaser.Math.DegToRad(flip ? -rotation : rotation));
      image.setFlipX(flip);
      return image;
    });
  }

  private positionArt(tile: LiveTile, frame: TileFrame): void {
    // Nothing to draw once the whole tile is well past the bottom.
    const visible = frame.originY < GAME_HEIGHT && frame.originY + frame.heightPx > -TILE_UNIT;
    tile.art.forEach((image, column) => {
      image.setVisible(visible);
      if (!visible) return;
      image.setPosition(frame.originX + column * TILE_UNIT + TILE_UNIT / 2, frame.originY + TILE_UNIT / 2);
    });
  }
}
