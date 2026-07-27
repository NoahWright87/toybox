import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { copy } from "../content";
import { SCENE_KEYS } from "./sceneData";

/**
 * Settings stub (S3 #173) — the real screen is a later Epic 4 issue. This
 * proves the menu -> stub -> back transition exists now so wiring the real
 * screen later is a content swap, not new plumbing.
 */
export class SettingsScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.settings);
  }

  create() {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, GAME_HEIGHT * 0.42, copy("menu.settings"), {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffcc00",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.49, copy("menu.stub.comingSoon"), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, GAME_HEIGHT * 0.62, copy("menu.stub.back"), {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#888888",
      })
      .setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    const back = () => this.scene.start(SCENE_KEYS.mainMenu);
    this.input.keyboard?.once("keydown", back);
    this.input.once("pointerdown", back);
  }
}
