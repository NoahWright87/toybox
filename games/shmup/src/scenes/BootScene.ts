import Phaser from "phaser";
import { copy } from "../content";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { requestMotionPermission } from "../debug/ShakeDetector";
import { SCENE_KEYS } from "./sceneData";

/**
 * Title card — proves the skeleton renders and that copy comes from the
 * content registry (specs/content-and-assets), not inline strings.
 * Press any key / tap to drop into the Season map (run-structure.spec.todo.md, F8 #136).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, GAME_HEIGHT * 0.34, copy("intro.presents"), {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ff6b00",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.46, copy("game.title"), {
        fontFamily: "monospace",
        fontSize: "64px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.57, copy("intro.sticker"), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#7b3dbe",
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, GAME_HEIGHT * 0.74, "PRESS ANY KEY OR TAP TO PLAY", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.2,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // iOS gates devicemotion (shake-to-open the debug overlay) behind a
    // permission prompt that only resolves from inside a user-gesture
    // handler — this tap is the only one guaranteed before PlayScene exists.
    const start = () => {
      requestMotionPermission();
      this.scene.start(SCENE_KEYS.map);
    };
    this.input.keyboard?.once("keydown", start);
    this.input.once("pointerdown", start);
  }
}
