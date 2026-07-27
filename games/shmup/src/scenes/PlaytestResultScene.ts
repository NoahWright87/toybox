import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { copy } from "../content";
import { EDITOR_URL } from "./playtestRequest";
import { SCENE_KEYS } from "./sceneData";
import type { PlaytestResultData } from "./sceneData";

/**
 * Where a playtest run lands when it ends.
 *
 * Deliberately *not* `ResolveScene`: that one applies Ratings, gold and EXP
 * to the persisted career, and trying out content you're in the middle of
 * authoring must never be able to cost or pay a real run. This screen has
 * exactly the two doors the authoring loop needs — run it again, or go back
 * to the editor and change something.
 *
 * "Back to editor" is a real page navigation, because the editor is a route
 * in the Doors 97 app and this is a separately-built bundle. That's the same
 * crossing the editor's own Play Test buttons make in the other direction.
 */
export class PlaytestResultScene extends Phaser.Scene {
  private result!: PlaytestResultData;

  constructor() {
    super(SCENE_KEYS.playtestResult);
  }

  init(data: PlaytestResultData) {
    this.result = data;
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cleared = this.result.outcome === "complete";

    this.add
      .text(cx, GAME_HEIGHT * 0.3, copy(cleared ? "encounter.result.title.complete" : "encounter.result.title.death"), {
        fontFamily: "monospace",
        fontSize: "40px",
        color: cleared ? "#66dd66" : "#ff6666",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.38, copy("encounter.result.score", { score: this.result.score }), {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.43, copy("encounter.result.difficulty", { difficulty: this.result.difficulty }), {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ffcc00",
      })
      .setOrigin(0.5);

    this.addButton(cx, GAME_HEIGHT * 0.58, copy("encounter.result.replay"), () => this.replay());
    this.addButton(cx, GAME_HEIGHT * 0.58 + 100, copy("encounter.result.backToEditor"), () => {
      window.location.href = EDITOR_URL;
    });
  }

  /**
   * Re-runs by reloading the page rather than restarting the scene, so the
   * run picks up whatever the editor has saved since — including edits made
   * in another tab while this result screen was sitting here. The playtest
   * request lives in the URL, so the reload replays exactly the same thing.
   */
  private replay(): void {
    window.location.reload();
  }

  private addButton(x: number, y: number, label: string, onSelect: () => void): void {
    const box = this.add.rectangle(x, y, GAME_WIDTH - 140, 78, 0x2a1000).setStrokeStyle(3, 0x7b3dbe);
    this.add.text(x, y, label, { fontFamily: "monospace", fontSize: "18px", color: "#ffffff" }).setOrigin(0.5);
    box.setInteractive({ useHandCursor: true });
    box.on("pointerover", () => box.setStrokeStyle(4, 0xffcc88));
    box.on("pointerout", () => box.setStrokeStyle(3, 0x7b3dbe));
    box.on("pointerdown", onSelect);
  }
}
