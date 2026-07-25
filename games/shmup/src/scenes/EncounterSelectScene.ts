import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";
import { copy } from "../content";
import { createNewCareer } from "../systems/career";
import { loadAuthoredContent, playableTiles } from "../systems/encounters/authoredContent";
import type { AuthoredEncounter, AuthoredTile } from "../systems/encounters/authoredTypes";
import { SCENE_KEYS } from "./sceneData";
import type { EncounterSelectLaunchData, EpisodeLaunchData } from "./sceneData";

const ROW_HEIGHT = 62;
const ROW_GAP = 8;
const LIST_TOP = 250;
const MAX_VISIBLE_ROWS = 11;

/**
 * Picks one `/shmup-editor` Encounter to play in the real engine.
 *
 * This is the door between the authoring tool and the game: the editor
 * saves into the Doors 97 filesystem, this scene reads it back on the same
 * origin (`systems/encounters/authoredContent.ts`), and PlayScene runs the
 * result with the real ship, weapons, Hype and coins — not a simulation of
 * them. The list refreshes from the FS on every visit, so authoring in one
 * tab and playing in another only needs a scene change, not a reload.
 *
 * The Difficulty control is not a nicety. `resolveScaling` floors an
 * instance's count at **zero**, so an encounter played at a Difficulty
 * below its instances' `minCostPerInstance` correctly spawns nothing at
 * all. Being able to see that — and to dial up until the swarm appears — is
 * most of what makes an authored scaling curve testable.
 */
export class EncounterSelectScene extends Phaser.Scene {
  private tiles: AuthoredTile[] = [];
  private tile: AuthoredTile | null = null;
  private difficulty: number = TUNING.encounters.playtestDifficultyDefault;
  private lastResult: EncounterSelectLaunchData | null = null;

  constructor() {
    super(SCENE_KEYS.encounterSelect);
  }

  init(data: EncounterSelectLaunchData | undefined) {
    this.lastResult = data && data.outcome ? data : null;
    if (data?.difficulty) this.difficulty = data.difficulty;
  }

  create() {
    this.tiles = playableTiles(loadAuthoredContent({ refresh: true }));
    // Coming back from a run, land on the tile that was just played rather
    // than at the top of the list — the loop is "tweak, play, tweak."
    this.tile = this.lastResult ? this.tiles.find((t) => t.id === this.lastResult?.tileId) ?? null : null;
    this.render();
  }

  private render(): void {
    this.children.removeAll();
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 60, copy("encounter.title"), { fontFamily: "monospace", fontSize: "34px", color: "#ff6b00" })
      .setOrigin(0.5);
    this.add
      .text(cx, 104, this.tile ? this.tile.name : copy("encounter.subtitle"), {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    this.renderResultBanner(cx);
    this.renderDifficulty(cx);

    if (this.tiles.length === 0) {
      this.add
        .text(cx, GAME_HEIGHT * 0.45, copy("encounter.empty"), {
          fontFamily: "monospace",
          fontSize: "15px",
          color: "#888888",
          align: "center",
          wordWrap: { width: GAME_WIDTH - 120 },
        })
        .setOrigin(0.5);
    } else if (this.tile) {
      this.renderRows(this.tile.encounters.map((e) => ({ label: `${e.name}  (${e.units.length}u)`, onSelect: () => this.play(e) })));
    } else {
      this.renderRows(
        this.tiles.map((t) => ({
          label: `${t.name}  (${t.encounters.length})`,
          onSelect: () => {
            this.tile = t;
            this.render();
          },
        }))
      );
    }

    this.renderBackButton(cx);
  }

  private renderResultBanner(cx: number): void {
    if (!this.lastResult) return;
    const cleared = this.lastResult.outcome === "complete";
    this.add
      .text(
        cx,
        140,
        copy(cleared ? "encounter.result.complete" : "encounter.result.death", { score: this.lastResult.score }),
        { fontFamily: "monospace", fontSize: "15px", color: cleared ? "#66dd66" : "#ff6666" }
      )
      .setOrigin(0.5);
  }

  private renderDifficulty(cx: number): void {
    const y = 190;
    this.add
      .text(cx, y, copy("encounter.difficulty", { difficulty: this.difficulty }), {
        fontFamily: "monospace",
        fontSize: "17px",
        color: "#ffcc00",
      })
      .setOrigin(0.5);
    this.addButton(cx - 150, y, 56, 44, "-", () => this.nudgeDifficulty(-TUNING.encounters.playtestDifficultyStep));
    this.addButton(cx + 150, y, 56, 44, "+", () => this.nudgeDifficulty(TUNING.encounters.playtestDifficultyStep));
  }

  private nudgeDifficulty(delta: number): void {
    this.difficulty = Phaser.Math.Clamp(this.difficulty + delta, 0, TUNING.encounters.playtestDifficultyMax);
    this.render();
  }

  private renderRows(rows: { label: string; onSelect: () => void }[]): void {
    const cx = GAME_WIDTH / 2;
    rows.slice(0, MAX_VISIBLE_ROWS).forEach((row, i) => {
      this.addButton(cx, LIST_TOP + i * (ROW_HEIGHT + ROW_GAP), GAME_WIDTH - 100, ROW_HEIGHT, row.label, row.onSelect);
    });
    if (rows.length > MAX_VISIBLE_ROWS) {
      this.add
        .text(cx, LIST_TOP + MAX_VISIBLE_ROWS * (ROW_HEIGHT + ROW_GAP) + 10, copy("encounter.more", { count: rows.length - MAX_VISIBLE_ROWS }), {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#888888",
        })
        .setOrigin(0.5);
    }
  }

  private renderBackButton(cx: number): void {
    this.addButton(cx, GAME_HEIGHT - 70, GAME_WIDTH - 100, 60, copy("encounter.back"), () => {
      if (this.tile) {
        this.tile = null;
        this.render();
        return;
      }
      this.scene.start(SCENE_KEYS.mainMenu);
    });
  }

  private addButton(x: number, y: number, width: number, height: number, label: string, onSelect: () => void): void {
    const box = this.add.rectangle(x, y, width, height, 0x2a1000).setStrokeStyle(3, 0x7b3dbe);
    this.add.text(x, y, label, { fontFamily: "monospace", fontSize: "15px", color: "#ffffff" }).setOrigin(0.5);
    box.setInteractive({ useHandCursor: true });
    box.on("pointerover", () => box.setStrokeStyle(4, 0xffcc88));
    box.on("pointerout", () => box.setStrokeStyle(3, 0x7b3dbe));
    box.on("pointerdown", onSelect);
  }

  /**
   * Builds a throwaway episode around the chosen encounter, using a fresh
   * career's **starting** build rather than whatever a save happens to be
   * carrying — so how an encounter feels here doesn't depend on an
   * unrelated run, and never drifts from the real opening loadout either.
   * The career object is discarded, never saved.
   */
  private play(encounter: AuthoredEncounter): void {
    if (!this.tile) return;
    const build = createNewCareer();
    this.scene.start(SCENE_KEYS.play, {
      nodeId: `playtest:${this.tile.id}:${encounter.id}`,
      nodeType: "standard",
      season: build.season,
      D: this.difficulty,
      ratings: 0,
      chassisId: build.chassisId,
      weapons: build.weapons,
      items: build.items,
      statPicks: build.statPicks,
      level: build.level,
      isSeriesFinale: false,
      playtest: { tileId: this.tile.id, encounterId: encounter.id, difficulty: this.difficulty },
    } satisfies EpisodeLaunchData);
  }
}
